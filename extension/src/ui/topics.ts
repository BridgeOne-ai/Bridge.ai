// How topics are named and grouped in the popup and the dashboard. Labels only: no message text is ever shown.
import type { Topic } from "../../../core/src/types";
import { EMOTIONAL } from "../../../core/src/score";

export const TOPIC_LABEL: Record<Topic, string> = {
  loneliness: "Loneliness",
  sadness: "Sadness",
  stress: "Stress",
  anxiety: "Anxiety",
  anger: "Anger",
  self_worth: "Self-worth",
  hopelessness: "Hopelessness",
  emptiness: "Emptiness",
  rejection: "Rejection",
  guilt_shame: "Guilt or shame",
  overwhelm: "Overwhelm",
  fear: "Fear",
  grief: "Grief",
  jealousy: "Jealousy",
  frustration: "Frustration",
  disappointment: "Disappointment",
  embarrassment: "Embarrassment",
  confusion: "Confusion",
  exhaustion: "Exhaustion",
  happiness: "Happiness",
  calm: "Calm",
  gratitude: "Gratitude",
  excitement: "Excitement",
  pride: "Pride",
  hope: "Hope",
  affection: "Love and closeness",
  curiosity: "Curiosity",
  school: "School",
  friends: "Friends",
  family: "Family",
  romance: "Romance",
  body_image: "Body image",
  boredom: "Boredom",
};

// Feelings that weigh on someone. The pattern score counts only EMOTIONAL (core/src/score.ts); the rest
// are here because they're still hard to feel, even though they don't raise the level.
const HARD: readonly Topic[] = [...EMOTIONAL, "stress", "anger", "disappointment", "embarrassment", "confusion", "exhaustion"];
const GOOD: readonly Topic[] = ["happiness", "calm", "gratitude", "excitement", "pride", "hope", "affection", "curiosity"];

export type FeelingGroup = "hard" | "good" | "other" | "life";

export function feelingGroup(t: Topic): FeelingGroup {
  if (HARD.includes(t)) return "hard";
  if (GOOD.includes(t)) return "good";
  return t === "boredom" ? "other" : "life"; // school, friends, family, romance, body image
}
