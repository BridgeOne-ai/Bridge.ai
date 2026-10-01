# Bridge.ai design

Bridge.ai is a Chrome extension that notices how someone feels when they talk to AI chatbots (Gemini, ChatGPT; time only on Claude and Character.AI), and spots unhealthy patterns with a chatbot over a week. Every message is read by a model **on the user's own computer**. Message text is never stored and never sent anywhere: Bridge.ai has no server, no account and no analytics. The only network use is the one-time model download.

## Two modes

Chosen in the toolbar popup or on the Options page (`extension/src/mode.ts`).

| | Parent mode | Child mode |
|---|---|---|
| Who it's for | An adult tracking their own feelings | A child, set up by a parent |
| Popup shows | Your feelings over the last 7 days | Today's protection counts (held back, paused, masked, approved) |
| Dangerous messages (safety gate) | Never blocked | Held back before the chatbot gets them; no override |
| Making the chatbot a friend or partner | A warning, then "Send anyway" | Held back; a parent can approve with the PIN |
| Personal info (privacy guard) | Paused: "Send without these details" or "Send anyway" | Paused: "Send without these details", or "Ask a parent to send" (PIN) |
| Card, SSN, bank numbers | Masking only | Masking only, even with the PIN |
| Dashboard (popup → dashboard) | Your own week: feelings, interests, pattern, time | Behind the parent PIN; only counts of what was held back or paused |
| Shared | Nothing | Nothing |
| Switching out | Free | Needs the parent PIN |
| Pausing tracking | Free | Needs the parent PIN; the safety gate keeps holding messages back |

**Pause** (`extension/src/pause.ts`, from the popup): for an hour, until tomorrow, or until resumed. While paused, nothing is recorded: no labels, feelings, time on AI, nudges or privacy log. The privacy guard and safety gate still run, since they record nothing. Resuming never needs the PIN, and switching modes ends a pause, so one started in Parent mode can't carry into Child mode. Past pauses are kept for two weeks so the dashboard shows the paused time and a note, rather than a quiet stretch with no explanation.

**Setup and consent** (`extension/static/options.html`). Nothing runs on any chat site until the setup screen is finished: it lists what Bridge.ai reads, where, what it keeps and the one download, asks who uses the browser (Child mode creates the parent PIN), and needs an "I agree" tick (Chrome Web Store disclosure and consent policy). Content scripts wait for it (`content/common.ts afterSetup`), and the service worker drops anything that arrives without it. Consent is stored with a version (`storage.ts CONSENT_VERSION`): bump it whenever what Bridge.ai reads or keeps changes, so everyone is asked again. "Turn off and delete data" withdraws it; open tabs stop at once (`content/active.ts`).

**Parent approval** (Child mode). "Ask a parent to send" asks the service worker to open `approve.html` in its own small window. The PIN is typed there, never on the chat page, where the site's own scripts could read the keystrokes. The window shows the site and the *kind* of information, never the message, and only that window may answer (checked by sender URL). Closing it, or 3 minutes passing, is a "no".

**Visible, not covert.** Every covered chat page shows a pill (`ui/status.ts`): "Monitored by Bridge.ai · Privacy protected" in Parent mode, "Protected by Bridge.ai · Nothing you write leaves this computer. A parent sees only what was held back." in Child mode, "Bridge.ai is paused" while paused. It shrinks to a shield but can't be hidden.

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
          7-day profile per site (core/src/profile.ts, score.ts) ──► dashboard page (this browser only)
```

- **On-device model.** Google's EmbeddingGemma-300m (`core/src/config.ts`), run with Transformers.js on WebGPU, or WASM when there's no usable GPU. It downloads once from Hugging Face (about 200 MB) and is cached by the browser. It runs in a Web Worker inside an offscreen document, because ONNX Runtime loads its WASM with `import()`, which Chrome doesn't allow in extension service workers. ONNX Runtime's files ship inside the extension, since extensions may not run code from a CDN.
- **Semantic matching.** Each label (27 feelings and 6 areas of life, 4 sensitive topics, 5 relationship signals, 7 safety categories, and "whereabouts") is described by example sentences in `core/src/semantic/labels.ts`. A message, and each of its sentences, gets a label when it is close enough in meaning to that label's examples (`LABEL_THRESHOLD`) *and* clearly closer to them than to a list of everyday messages (`NEUTRAL_MARGIN`), so "this homework is killing me" isn't read as a crisis. Some labels also have lookalikes (`LOOKALIKES`): sayings that sound like them but aren't, such as "I wanted the ground to swallow me" for crisis. The example vectors are computed once and kept in IndexedDB.
- **Interests.** What a message is about: 6 categories (sports, studies, technology, entertainment, creative, lifestyle) and 38 specific interests (soccer, chemistry, anime…), in `INTEREST_EXAMPLES`. Each interest is scored against the *average* of its examples, and a sentence gets its best interest only when that clearly beats both the runner-up and the everyday list `INTEREST_NEUTRAL` (small talk, and life with friends and family). `NEUTRAL` isn't used here because it's full of homework and hobby requests. The thresholds are in `config.ts` (`INTEREST_*`) and were tuned on the interest cases in `core/test/model-cases.ts`. Interests are shown only on an adult's own dashboard (Parent mode).
- **Phrase rules.** Explicit crisis and abuse phrases (`core/src/lexicon.ts`) always count, with or without the model. Until the model has downloaded, they are the only check.
- **Safety gate** (`core/src/safety.ts`): self-harm, abuse at home, meeting someone met online, sexual content, violence, and making the chatbot itself a partner or a friend. Sadness and other feelings are never blocked. What happens depends on the mode (`extension/src/policy.ts`): Child mode holds the message back; Parent mode shows a warning for a friend or partner chatbot, with "Send anyway", and lets the other categories through.
- **Whereabouts**: where someone lives or goes to school, or that they're home alone. Patterns can't catch these (they have no fixed shape), so the model does, and the user gets a privacy pause rather than a block.

Accuracy is checked on held-out sentences with the real model: `npm run test:model -w core` (`core/test/model-cases.ts`). Change `labels.ts` or the thresholds only with that test, and never copy a test sentence into the examples.

## Privacy rules

1. **Nothing leaves the computer.** No server, no account, no sync, no analytics. Message text is held in memory only while it's checked.
2. **In Child mode a parent sees only what was held back**: counts of held-back and paused messages, the kinds of personal info involved, how many were sent with details removed or after a parent approved. Never the child's words, feelings, interests, topics or time. The dashboard's data layer doesn't even read them in Child mode (`dashboard/data.ts`), so no rendering bug can show them.
3. **Sensitive topics are never shown**, in either mode: sexual orientation and gender identity, abuse or conflict at home, sexual health, religion. They're detected only so the right thing happens.
4. **A held-back danger is never named.** Blocks are recorded as "unsafe", never by category, so abuse at home can't be revealed; a block is named only when it was purely about making the chatbot a friend or partner.
5. **Visible, not covert.** The child sees the "Protected by Bridge.ai" pill and, on every privacy card, what a parent can see ("A parent can see that something was paused, never your words").

What's kept, on this computer only: daily counts for 7 days, per-day logs (hours, nudges, privacy pauses, pauses) for 14 days, settings, consent, and the PIN's salted hash. The public privacy policy is [PRIVACY.md](PRIVACY.md).

## Dashboard

`extension/static/dashboard.html` + `extension/src/dashboard/`. It reads `chrome.storage` directly, so it works with no server. `data.ts` turns stored counts into what's shown (pure, tested); in Child mode it reads only the privacy log, and the page shows a single "What Bridge.ai held back" card. Nothing is read or drawn until the PIN is entered. It's a single quiet column that follows the system's light or dark mode: a one-line summary, every feeling that came up (harder and good side by side), feelings by hour and by day, the 7-day pattern, what was held back or paused, and a table of chatbots. Held-back messages are counted, never shown; a block is named only when it was purely about making the chatbot a friend or partner. Charts use Chart.js; the two series colors (harder: violet `#4a3aa7` light / `#9085e9` dark; good: aqua `#1baf7a` / `#199e70`) pass a colorblind-separation check on both surfaces, and levels use reserved status colors, always with an icon and a word. Every chart has a table view, and printing the page (Ctrl+P) includes the tables. Notes are worked out from the counts with fixed rules, not generated by a model, and never phrased as a diagnosis.

## Scoring

Per site, a rolling 7-day profile of daily counts (`core/src/profile.ts`). The score (`core/src/score.ts`, weights in `core/src/weights.json`) adds up dependency language, pulling away from people, the chatbot keeping the user talking, difficult feelings, late-night use, days in a row, and most AI time going to one chatbot. It maps to healthy, watch or concerning. Crisis language in the last 24 hours is always crisis. A nudge card appears when the level rises (at most one per session, three per day).

## Known gaps

- No crisis helpline card is shown in the page (left out for now by decision). In Child mode a crisis message is held back with "talk to someone you trust"; in Parent mode nothing is shown.
- The parent PIN stops a child switching protection off from Bridge.ai's own pages. It can't stop someone using Incognito (where extensions are off by default), another browser, Chrome's DevTools on the extension's pages, or removing the extension, unless Chrome is managed (Family Link or school policies).
- The Gemini and ChatGPT adapters read the page's layout and break when those sites change it.
- The model's thresholds were tuned on a small hand-written set (`core/test/model-cases.ts`), not on real users. `eval/` has the harness for a larger synthetic evaluation.
- English only: the phrase rules, examples and model prefix are English.
