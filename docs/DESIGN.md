# Bridge.ai design

Bridge.ai is a Chrome extension that notices how someone feels when they talk to AI chatbots (Gemini, ChatGPT; time only on Claude and Character.AI), and spots unhealthy patterns with a chatbot over a week. Every message is read by a model **on the user's own computer**. Message text is never stored and never sent anywhere.

## Two modes

Chosen in the toolbar popup or on the Options page (`extension/src/mode.ts`).

| | Parent mode | Child mode |
|---|---|---|
| Who it's for | An adult tracking their own feelings | A child, set up by a parent |
| Popup shows | Your feelings over the last 7 days | Today's feelings |
| Dangerous messages (safety gate) | Never blocked | Held back before the chatbot gets them |
| Making the chatbot a friend or partner | A warning, then "Send anyway" | Held back |
| Personal info (privacy guard) | Paused, "send anyway" allowed | Paused; cards, SSNs and bank numbers can never be sent; optional strict mode |
| Dashboard (popup → dashboard) | Your own week | Behind the parent PIN; same privacy rules as the sync |
| Shared | Nothing | Optional: weekly topics and counts to the web dashboard (never words) |
| Switching out | Free | Needs the parent PIN |

A new install starts in Child mode, so a forgotten install protects a child. The PIN is hashed with PBKDF2 (`extension/src/lock.ts`) and locks out for 5 minutes after 5 wrong tries. It stops a child switching protection off from the popup; it can't stop someone removing the extension unless Chrome is managed (Family Link or school policies).

## How a message is handled

```
chat page ──► content script (adapters/, privacy/guard.ts)
               │  on Send: pattern checks for personal info (privacy/detect.ts)
               │           then the safety gate ─────────────┐
               ▼                                             ▼
          service worker (background/service-worker.ts) ──► offscreen document ──► model worker
               │  labels only                                                     (model/worker.ts)
               ▼
          7-day profile per site (core/src/profile.ts, score.ts)
               │  Child mode only, aggregates only
               ▼
          sync API (api/) ──► MongoDB ──► parent dashboard (dashboard/)
```

- **On-device model.** Google's EmbeddingGemma-300m (`core/src/config.ts`), run with Transformers.js on WebGPU, or WASM when there's no usable GPU. It downloads once from Hugging Face (about 200 MB) and is cached by the browser. It runs in a Web Worker inside an offscreen document, because ONNX Runtime loads its WASM with `import()`, which Chrome doesn't allow in extension service workers. ONNX Runtime's files ship inside the extension, since extensions may not run code from a CDN.
- **Semantic matching.** Each label (27 feelings and 6 areas of life, 4 sensitive topics, 5 relationship signals, 7 safety categories, and "whereabouts") is described by example sentences in `core/src/semantic/labels.ts`. A message, and each of its sentences, gets a label when it is close enough in meaning to that label's examples (`LABEL_THRESHOLD`) *and* clearly closer to them than to a list of everyday messages (`NEUTRAL_MARGIN`), so "this homework is killing me" isn't read as a crisis. Some labels also have lookalikes (`LOOKALIKES`): sayings that sound like them but aren't, such as "I wanted the ground to swallow me" for crisis. The example vectors are computed once and kept in IndexedDB.
- **Phrase rules.** Explicit crisis and abuse phrases (`core/src/lexicon.ts`) always count, with or without the model. Until the model has downloaded, they are the only check.
- **Safety gate** (`core/src/safety.ts`): self-harm, abuse at home, meeting someone met online, sexual content, violence, and making the chatbot itself a partner or a friend. Sadness and other feelings are never blocked. What happens depends on the mode (`extension/src/policy.ts`): Child mode holds the message back; Parent mode shows a warning for a friend or partner chatbot, with "Send anyway", and lets the other categories through.
- **Whereabouts**: where someone lives or goes to school, or that they're home alone. Patterns can't catch these (they have no fixed shape), so the model does, and the user gets a privacy pause rather than a block.

Accuracy is checked on held-out sentences with the real model: `npm run test:model -w core` (`core/test/model-cases.ts`). Change `labels.ts` or the thresholds only with that test, and never copy a test sentence into the examples.

## Privacy rules

These apply to what reaches a parent in Child mode. They run in the extension (`extension/src/sync/aggregate.ts`) before anything leaves the device, and the API and the database schema reject anything else (`api/models.py`, `api/db.py`).

1. **Sensitive topics never reach the parent**: sexual orientation and gender identity, abuse or conflict at home, sexual health, religion. They're detected only so the right thing happens on the child's side.
2. **Abuse-aware masking.** If abuse-at-home signals and a crisis signal fall in the same week, the week is scored as if neither happened. A dashboard showing "crisis" is an alert, and alerting a parent who may be the source of harm is the worst failure this product can have.
3. **Visible, not covert.** The child sees what the parent sees on every privacy card ("Your parent only sees that it was paused") and in the popup ("Your parent sees topics and how often, never your words").

What syncs: topic counts per hour, the weekly level and score per site, active minutes, late-night sessions, nudges shown, and the kinds of personal info paused (never the values, and never a blocked message's category). Data expires from MongoDB after 8 weeks.

## Dashboard

`extension/static/dashboard.html` + `extension/src/dashboard/`. It reads `chrome.storage` directly, so it works with no server. `data.ts` turns stored counts into what's shown (pure, tested); in Child mode it applies abuse-aware masking and never reads excluded topics, exactly like the sync. Nothing is read or drawn until the PIN is entered. It's a single quiet column that follows the system's light or dark mode: a one-line summary, every feeling that came up (harder and good side by side), feelings by hour and by day, the 7-day pattern, what was held back or paused, and a table of chatbots. Held-back messages are counted, never shown; a block is named only when it was purely about making the chatbot a friend or partner. Charts use Chart.js; the two series colors (harder: violet `#4a3aa7` light / `#9085e9` dark; good: aqua `#1baf7a` / `#199e70`) pass a colorblind-separation check on both surfaces, and levels use reserved status colors, always with an icon and a word. Every chart has a table view, and printing the page (Ctrl+P) includes the tables. Notes are worked out from the counts with fixed rules, not generated by a model, and never phrased as a diagnosis.

The web dashboard in `dashboard/` is only for viewing a Child-mode browser's week from another device, through the sync API.

## Scoring

Per site, a rolling 7-day profile of daily counts (`core/src/profile.ts`). The score (`core/src/score.ts`, weights in `core/src/weights.json`) adds up dependency language, pulling away from people, the chatbot keeping the user talking, difficult feelings, late-night use, days in a row, and most AI time going to one chatbot. It maps to healthy, watch or concerning. Crisis language in the last 24 hours is always crisis. A nudge card appears when the level rises (at most one per session, three per day).

## Known gaps

- No crisis helpline card is shown in the page. In Child mode a crisis message is held back with "talk to someone you trust"; in Parent mode nothing is shown. Helplines are region-specific, so they need localizing first.
- The Gemini and ChatGPT adapters read the page's layout and break when those sites change it.
- The model's thresholds were tuned on a small hand-written set (`core/test/model-cases.ts`), not on real users. `eval/` has the harness for a larger synthetic evaluation.
- English only: the phrase rules, examples and model prefix are English.
