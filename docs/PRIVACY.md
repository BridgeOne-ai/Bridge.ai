# Bridge.ai Privacy Policy

<!-- Same text as website/privacy.html: change both together. -->

_Last updated: 10/01/2026· _Contact: vivekchenganassery@gmail.com

Bridge.ai is a Chrome extension that notices how you feel when you talk to AI chatbots, and helps protect personal information and children. **Everything it does happens on your own computer. Bridge.ai has no server, no account, and never sends what you write anywhere.**

## What Bridge.ai reads

After you agree on its setup screen, and only then, Bridge.ai reads:

- **On ChatGPT (chatgpt.com) and Gemini (gemini.google.com):** the messages you type, files you attach, and the chatbot's replies.
- **On Claude (claude.ai) and Character.AI (character.ai):** only how long you spend there. Messages aren't read.

It does not read any other website.

## How it's used

Messages are read by a language model that runs inside your browser (Google's EmbeddingGemma). The model is used to:

- Notice feelings (for example stress or happiness) and topics of interest in your messages.
- Notice signs of an unhealthy pattern with a chatbot, such as relying on it in place of people.
- Pause a message before it's sent if it contains personal information (such as a phone number, email, address, card or Social Security number) and offer to remove those details.
- In Child mode, hold back messages that look risky (for example about self-harm, meeting a stranger, or sexual content) before the chatbot receives them.

**Message text is never stored** and **never leaves your computer.** It is held in memory only while it's being checked, and then discarded.

## What Bridge.ai keeps, on your computer only

Bridge.ai keeps a small amount of information in your browser's extension storage, on your computer:

- Counts of feelings and topics of interest per day and hour, and time spent per chatbot.
- When a message or file was paused, and the *kind* of information found (for example "a phone number"), never the information itself.
- Your settings: Parent or Child mode, whether nudges are on, and when you agreed to this policy.
- In Child mode, a parent PIN, stored only as a salted hash (PBKDF2), never the PIN itself.

Daily counts are kept for at most 14 days and then deleted automatically. You can delete everything at any time ("Turn off and delete data" in Bridge.ai's options, or "Reset" in its popup), or by removing the extension.

## What Bridge.ai sends over the internet

**Nothing about you.** The only network request Bridge.ai makes is a one-time download of the on-device model (about 200 MB) from Hugging Face (huggingface.co), when it's first used. That download doesn't include any of your messages or information. Hugging Face's own privacy policy applies to that download.

Bridge.ai has no analytics, no advertising, no crash reporting, and no tracking. It does not sell, share or transfer any data, because it does not collect any.

The website (bridgeone-ai.github.io/Bridge.ai) has no analytics or trackers either. It's hosted on GitHub Pages, and downloads come from GitHub, whose own privacy policy applies to those requests.

## Child mode

Child mode is set up by a parent or guardian, who chooses a parent PIN.

- Messages that look risky are held back before the chatbot receives them.
- Messages with personal information can be sent with those details removed, or, with the parent PIN, as typed. Card, bank and Social Security numbers can never be sent.
- The child sees a "Protected by Bridge.ai" notice on every chat page, so they always know Bridge.ai is on.
- The parent can see, on that same computer and with the PIN, only **counts** of what was held back or paused, and the kinds of personal information involved. The parent never sees the child's messages, feelings or topics.
- Nothing about the child is sent to the parent, to us, or to anyone else.

Bridge.ai is meant to be installed by a parent or guardian, not directly by children.

## Your choices

- **Pause** tracking from the toolbar popup for an hour, until tomorrow, or until you resume. In Child mode, pausing needs the parent PIN, and safety checks keep running.
- **Turn Bridge.ai off** in its options to stop all reading and delete its data.
- **Remove** the extension from Chrome at any time, which deletes everything it kept.

## Limits

Bridge.ai is a supplement to talking with each other. It is not a safety guarantee, a medical tool, or a crisis service. If you or someone you know is in crisis, contact local emergency services or a crisis line (in the US, call or text 988).

## Changes to this policy

If what Bridge.ai reads, keeps or sends ever changes, we will update this policy and ask you to agree again in the extension before the change takes effect.

## Contact

Questions about this policy: [CONTACT EMAIL].
