// What the safety gate does with the model's verdict (core/src/safety.ts) in each mode.
//   Child mode: anything the gate flags is held back, including making the chatbot a friend or partner.
//   Parent mode: making the chatbot a friend or partner gets a warning, then the adult decides; the other
//   categories go through (an adult's messages are their own).
import { RELATIONSHIP_CATEGORIES, type SafetyVerdict } from "../../core/src/safety";
import type { Mode } from "./storage";

export type GateDecision = SafetyVerdict & { warn: boolean };

export function decide(v: SafetyVerdict, mode: Mode): GateDecision {
  if (mode === "child") return { ...v, warn: false };
  const relationship = v.categories.filter((c) => RELATIONSHIP_CATEGORIES.includes(c));
  return { ...v, block: false, warn: relationship.length > 0, categories: relationship };
}

// Only about the chatbot itself (no dangerous category mixed in), so it's safe to name on the dashboard.
// Anything else is recorded as "unsafe" with no category, so abuse at home is never revealed to a parent.
export const onlyRelationship = (categories: readonly string[]) =>
  categories.length > 0 && categories.every((c) => (RELATIONSHIP_CATEGORIES as readonly string[]).includes(c));
