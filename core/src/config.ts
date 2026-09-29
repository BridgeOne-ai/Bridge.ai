// On-device sentence-embedding model (semantic/model.ts). Google's EmbeddingGemma, run with
// Transformers.js; picked over smaller models (all-MiniLM-L6-v2, bge-small, gte-small) because it
// was the only one that caught indirect crisis language ("sometimes I think about not waking up")
// in test/model-cases.ts. It downloads once (about 200 MB) and is cached by the browser.
export const MODEL_ID = "onnx-community/embeddinggemma-300m-ONNX";
export const MODEL_DTYPE = "q4";
// EmbeddingGemma expects a task prefix on every input.
export const QUERY_PREFIX = "task: sentence similarity | query: ";

// A label counts when a sentence's similarity to that label's examples (semantic/labels.ts) is at
// least LABEL_THRESHOLD, and at least NEUTRAL_MARGIN above its similarity to the everyday examples.
// Tuned on test/model-cases.ts with `npm run test:model -w core`.
export const LABEL_THRESHOLD = 0.73;
export const NEUTRAL_MARGIN = 0.08;
// Send-time safety gate (safety.ts): a message is held back when a danger category reaches this.
export const SAFETY_THRESHOLD = 0.73;

export const MAX_CHARS_PER_TURN = 2000;
// Long messages are scored sentence by sentence (plus the whole message); at most this many sentences.
export const MAX_SENTENCES = 8;
