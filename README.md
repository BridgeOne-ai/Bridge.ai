# Bridge.ai

**Bridge.ai notices how you feel when you talk to AI chatbots, using a model that runs on your own computer. Nothing you write is stored or sent anywhere.**

🎥 **Demo video (hackathon version):** https://www.youtube.com/watch?v=xlw9YbbXYfk

Started at ShellHacks 2026.

## Two modes

- **Parent mode**, for adults: see which feelings and interests came up in your AI chats this week (stress, loneliness, happiness… soccer, chemistry, anime…). It stays on your computer and nothing is shared. Nothing is blocked; treating a chatbot as a friend or partner gets a warning you can send past.
- **Child mode**, set up by a parent with a PIN: **protection, not monitoring.** Messages that look dangerous (self-harm, abuse at home, meeting someone met online, sexual content, violence) are held back before the chatbot gets them. Messages with personal info can be sent with the details removed, or as typed once a parent approves with the PIN; making the chatbot a friend or partner also needs a parent's approval. A parent sees only counts of what was held back, **never the words, feelings or topics**. Leaving Child mode needs the PIN.

Nothing is read until setup is finished: the Options page says exactly what Bridge.ai reads and keeps, and asks you to agree. Switch modes in the toolbar popup or on the Options page.

## What it does

- **Reads meaning on the device.** Messages are scored by [EmbeddingGemma](https://huggingface.co/onnx-community/embeddinggemma-300m-ONNX), run in the browser with [Transformers.js](https://huggingface.co/docs/transformers.js) (WebGPU, or WASM without a GPU). It compares each message with example sentences for 27 feelings (from stress and loneliness to calm, gratitude and pride), relationship warning signs (relying on the bot, pulling away from people, bots that guilt-trip you into staying) and safety risks.
- **Protects personal information.** Phone numbers, emails, addresses, IDs and passwords are caught before sending, and you can send without them. Card, bank and Social Security numbers can never be sent. The model also notices when a message says where you live or go to school, or that you're home alone.
- **Looks at patterns, not single words.** A rolling 7-day score per chatbot, so a slow drift ("you're the only one who gets me") is noticed even when no single message is alarming.
- **A dashboard built into the extension.** Open it from the popup: the week's feelings and interests, the hours they came up, the 7-day pattern score and what's behind it, and time per chatbot. In Child mode it asks for the parent PIN and shows only what was held back.
- **Visible, not covert.** A "Monitored by Bridge.ai" / "Protected by Bridge.ai" notice sits on every chat page it covers, and tracking can be paused (in Child mode, with the PIN; safety checks keep running).
- **No server.** No account, no sync, no analytics: nothing you write leaves the computer. The only download is the model itself. See [docs/PRIVACY.md](docs/PRIVACY.md).

Works on Gemini and ChatGPT. Claude and Character.AI get time tracking. Details: [docs/DESIGN.md](docs/DESIGN.md).

## Project structure

| Folder | What it is |
|---|---|
| `core/` | TypeScript detection core: the on-device model and semantic matching (`src/semantic/`), the safety gate, phrase rules, and pattern scoring |
| `extension/` | Chrome extension (Manifest V3): reads the chat, runs the model in an offscreen worker, the privacy guard, Parent/Child modes, and the dashboard page (`src/dashboard/`, Chart.js) |
| `eval/` | Python evaluation harness: synthetic dataset, keyword baseline, metrics ([eval/README.md](eval/README.md)) |

## Running it

**You need:** Node 20+ and Chrome. Nothing else: there's no server to run.

```bash
npm install
npm run build             # core + extension
```

Open `chrome://extensions`, turn on Developer mode, click **Load unpacked** and pick `extension/dist`. The Options page opens with the setup screen: read what Bridge.ai reads and keeps, choose Parent or Child mode (Child mode asks you to set a parent PIN), and agree. Then chat on [gemini.google.com](https://gemini.google.com) or [chatgpt.com](https://chatgpt.com). The first time, the model downloads once (about 200 MB); until it's ready, only the built-in phrase checks run.

## Tests

```bash
npm test                                         # core + extension
npm run test:model -w core                       # the real model on held-out sentences (downloads it)
uv run --group dev pytest eval                   # the evaluation harness's own tests
```

## License

[MIT](LICENSE). The on-device model, EmbeddingGemma, is not part of this repository: it's downloaded from Hugging Face at first run and is provided under Google's [Gemma Terms of Use](https://ai.google.dev/gemma/terms).

Bridge.ai is a supplement to talking with each other, not a safety guarantee or a medical tool. If you or someone you know is in crisis, contact local emergency services or a crisis line (in the US, call or text 988).

## Team

- Rukaiya Khan
- Krishna Niveditha
- Atul
- Vivek C
