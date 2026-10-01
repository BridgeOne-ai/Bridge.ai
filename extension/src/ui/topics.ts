// How topics are named and grouped in the popup and the dashboard. Labels only: no message text is ever shown.
import type { Interest, InterestCategory, Topic } from "../../../core/src/types";
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

export const CATEGORY_LABEL: Record<InterestCategory, string> = {
  sports: "Sports", studies: "Studies", technology: "Technology", entertainment: "Entertainment", creative: "Creative", lifestyle: "Lifestyle",
};

export const INTEREST_LABEL: Record<Interest, string> = {
  soccer: "Soccer", basketball: "Basketball", american_football: "American football", baseball: "Baseball", cricket: "Cricket",
  racket_sports: "Tennis and racket sports", swimming: "Swimming", running: "Running and track", martial_arts: "Martial arts",
  fitness: "Fitness", dance: "Dance",
  math: "Math", physics: "Physics", chemistry: "Chemistry", biology: "Biology", history: "History", languages: "Languages",
  english_literature: "English and literature", economics_business: "Money and business", space: "Space",
  coding: "Coding", tech_ai: "AI and gadgets",
  movies_tv: "Movies and TV", anime: "Anime", music: "Music", video_games: "Video games", books: "Books",
  social_media: "Social media and creators",
  drawing_art: "Drawing and art", music_making: "Making music", creative_writing: "Creative writing", photo_video: "Photo and video",
  cooking: "Cooking", fashion_beauty: "Fashion and beauty", travel: "Travel", animals: "Animals and pets", cars: "Cars",
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
