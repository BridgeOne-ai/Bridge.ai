# Bridge.ai

**Bridge.ai notices how you feel when you talk to AI chatbots, using a model that runs on your own computer. Nothing you write is stored or sent anywhere.**

🎥 **Demo video (hackathon version):** https://www.youtube.com/watch?v=xlw9YbbXYfk

Started at ShellHacks 2026.

## Two modes

- **Parent mode**, for adults: see which feelings came up in your AI chats this week (stress, loneliness, happiness…). It stays on your computer and nothing is shared. Nothing is blocked; treating a chatbot as a friend or partner gets a warning you can send past.
- **Child mode**, set up by a parent: messages that look dangerous (self-harm, abuse at home, meeting someone met online, sexual content, violence, or making the chatbot a friend or partner) are held back before the chatbot gets them, and the parent dashboard shows the week's topics and times, **never the words**. Leaving Child mode needs a parent PIN.

Switch between them in the toolbar popup.

## What it does

- **Reads meaning on the device.** Messages are scored by [EmbeddingGemma](https://huggingface.co/onnx-community/embeddinggemma-300m-ONNX), run in the browser with [Transformers.js](https://huggingface.co/docs/transformers.js) (WebGPU, or WASM without a GPU). It compares each message with example sentences for 27 feelings (from stress and loneliness to calm, gratitude and pride), relationship warning signs (relying on the bot, pulling away from people, bots that guilt-trip you into staying) and safety risks.
- **Protects personal information.** Phone numbers, emails, addresses, IDs and passwords are caught before sending, and you can send without them. Card, bank and Social Security numbers can never be sent. The model also notices when a message says where you live or go to school, or that you're home alone.
- **Looks at patterns, not single words.** A rolling 7-day score per chatbot, so a slow drift ("you're the only one who gets me") is noticed even when no single message is alarming.
- **A dashboard built into the extension.** Open it from the popup: the week's feelings, the hours they came up, the 7-day pattern score and what's behind it, and time per chatbot. It reads this browser's own data, so it needs no server or account. In Child mode it asks for the parent PIN.
- **Gives parents insight, not surveillance** (Child mode). Topics and counts, time of day, hours per tool, "a message was held back". Sensitive topics (sexuality, abuse at home, sexual health, religion) never reach the parent.

Works on Gemini and ChatGPT. Claude and Character.AI get time tracking. Details: [docs/DESIGN.md](docs/DESIGN.md).

## Project structure

| Folder | What it is |
|---|---|
| `core/` | TypeScript detection core: the on-device model and semantic matching (`src/semantic/`), the safety gate, phrase rules, and pattern scoring |
| `extension/` | Chrome extension (Manifest V3): reads the chat, runs the model in an offscreen worker, the privacy guard, Parent/Child modes, and the dashboard page (`src/dashboard/`, Chart.js) |
| `api/` | Sync API for Child mode (FastAPI + MongoDB): accounts and weekly counts only. The database schema rejects anything that could hold message text, and data expires after 8 weeks |
| `dashboard/` | Optional web dashboard (React + Mantine) for viewing a child's week from another device, through the sync API |
| `eval/` | Python evaluation harness: synthetic dataset, keyword baseline, metrics ([eval/README.md](eval/README.md)) |

## Running it

**You need:** Node 20+ and Chrome. For Child mode's parent dashboard, also Python 3.13 with [uv](https://docs.astral.sh/uv/) and a MongoDB Atlas connection string.

**1. Build and load the extension**

```bash
npm install
npm run build             # core + extension
```

Open `chrome://extensions`, turn on Developer mode, click **Load unpacked** and pick `extension/dist`. The Options page opens: choose Parent or Child mode. The first time, the model downloads once (about 200 MB); until it's ready, only the built-in phrase checks run.

**2. Optional: viewing a child's week from another device.** The dashboard in the popup works on its own. To see a Child-mode browser's week from elsewhere, run the sync API and web dashboard: copy `.env.example` to `.env`, set `MONGODB_URI`, then:

```bash
uv run --group api uvicorn api.main:app --reload     # API on http://localhost:8000
npm run dev:dashboard                                # dashboard on http://localhost:5173
```

Create an account on the dashboard (this also logs the extension in), then chat on [gemini.google.com](https://gemini.google.com) or [chatgpt.com](https://chatgpt.com).

## Tests

```bash
npm test                                         # core + extension
npm run test:model -w core                       # the real model on held-out sentences (downloads it)
uv run --group api --group dev pytest api        # starts its own throwaway MongoDB
```

## License

[MIT](LICENSE). The on-device model, EmbeddingGemma, is not part of this repository: it's downloaded from Hugging Face at first run and is provided under Google's [Gemma Terms of Use](https://ai.google.dev/gemma/terms).

Bridge.ai is a supplement to talking with each other, not a safety guarantee or a medical tool. If you or someone you know is in crisis, contact local emergency services or a crisis line.

## Team

- Rukaiya Khan
- Krishna Niveditha
- Atul
- Vivek C
