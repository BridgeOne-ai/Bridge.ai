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

// Interests (labels.ts INTEREST_EXAMPLES) are scored against the average of each interest's examples.
// A sentence gets its best interest when that reaches INTEREST_THRESHOLD, beats the closest everyday
// example (INTEREST_NEUTRAL) by INTEREST_IDLE_MARGIN, and beats the runner-up interest by INTEREST_GAP
// (a sentence that's equally close to two interests is about neither for sure). Tuned on the interest
// cases in test/model-cases.ts.
export const INTEREST_THRESHOLD = 0.65;
export const INTEREST_IDLE_MARGIN = 0.02;
export const INTEREST_GAP = 0.02;

export const MAX_CHARS_PER_TURN = 2000;
// Long messages are scored sentence by sentence (plus the whole message); at most this many sentences.
export const MAX_SENTENCES = 8;
