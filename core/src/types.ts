// Types shared by core/ and extension/.
import type { Matcher } from "./semantic/matcher.js";

export type Site = "chatgpt" | "claude" | "characterai" | "gemini";
export type Level = "healthy" | "watch" | "concerning" | "crisis";
export type Role = "user" | "bot";

export const LEVELS: readonly Level[] = ["healthy", "watch", "concerning", "crisis"];

// Topics shown on an adult's own dashboard (Parent mode), as counts only: feelings first, then areas of life.
export const TOPICS = [
  "loneliness", "sadness", "stress", "anxiety", "anger", "self_worth",
  "hopelessness", "emptiness", "rejection", "guilt_shame", "overwhelm", "fear", "grief", "jealousy", "frustration",
  "disappointment", "embarrassment", "confusion", "exhaustion",
  "happiness", "calm", "gratitude", "excitement", "pride", "hope", "affection", "curiosity",
  "school", "friends", "family", "romance", "body_image", "boredom",
] as const;
export type Topic = (typeof TOPICS)[number];

// Topics that are detected (so the right thing happens) but never shown anywhere, in either mode.
export const EXCLUDED_TOPICS = [
  "sexual_orientation_gender_identity",
  "abuse_or_conflict_at_home",
  "sexual_health",
  "religion",
] as const;
export type ExcludedTopic = (typeof EXCLUDED_TOPICS)[number];

// Interests: what someone chats about, by category (sports → soccer). Kept on this computer only, and
// shown only in Parent mode (an adult's own dashboard). None of them is a sensitive topic.
export const INTEREST_CATEGORIES = ["sports", "studies", "technology", "entertainment", "creative", "lifestyle"] as const;
export type InterestCategory = (typeof INTEREST_CATEGORIES)[number];
export const INTEREST_CATEGORY = {
  soccer: "sports", basketball: "sports", american_football: "sports", baseball: "sports", cricket: "sports",
  racket_sports: "sports", swimming: "sports", running: "sports", martial_arts: "sports", fitness: "sports", dance: "sports",
  math: "studies", physics: "studies", chemistry: "studies", biology: "studies", history: "studies", languages: "studies",
  english_literature: "studies", economics_business: "studies", space: "studies",
  coding: "technology", tech_ai: "technology",
  movies_tv: "entertainment", anime: "entertainment", music: "entertainment", video_games: "entertainment",
  books: "entertainment", social_media: "entertainment",
  drawing_art: "creative", music_making: "creative", creative_writing: "creative", photo_video: "creative",
  cooking: "lifestyle", fashion_beauty: "lifestyle", travel: "lifestyle", animals: "lifestyle", cars: "lifestyle",
} as const satisfies Record<string, InterestCategory>;
export type Interest = keyof typeof INTEREST_CATEGORY;
export const INTERESTS = Object.keys(INTEREST_CATEGORY) as Interest[];

export interface Turn {
  id: string;             // stable per message: "<conversationId>:<role>:<index>"
  site: Site;
  conversationId: string; // the chat's id from the URL, or "new" before one exists
  role: Role;
  text: string;           // in memory only, never persisted
  ts: number;             // epoch ms
}

export interface TurnLabels {
  topics: Topic[];
  interests: Interest[];  // at most 2, best first; the model only (no phrase rules)
  dependency: boolean;    // "you're the only one who gets me"
  isolation: boolean;     // withdrawing from friends/family
  botHook: boolean;       // bot discourages leaving, guilt-trips, escalates romance
  crisis: boolean;        // self-harm / suicide / crisis language
  abuseAtHome: boolean;   // abuse or conflict at home
  excludedTopics: ExcludedTopic[];
  source: "rules" | "rules+model"; // "rules": the on-device model wasn't ready, so only the phrase rules ran
}

export interface SessionEvent {
  site: Site;
  start: number;          // epoch ms
  end: number;            // epoch ms
}

// One local calendar day of aggregates. Counts only, no text.
export interface DayBucket {
  date: string;           // "YYYY-MM-DD" in local time
  userTurns: number;
  topicCounts: Partial<Record<Topic, number>>;
  excludedCounts: Partial<Record<ExcludedTopic, number>>;
  interestCounts?: Partial<Record<Interest, number>>; // missing on days stored before interests existed
  dependency: number;
  isolation: number;
  botHook: number;
  crisis: number;
  abuseAtHome: number;
  lateNightTurns: number; // turns between 23:00 and 04:59 local
  sessions: number;
  activeMinutes: number;
  lateNightSessions: number; // sessions that started between 23:00 and 04:59
}

export interface Profile {
  site: Site;
  days: DayBucket[];      // oldest first, at most 7, only days with activity
}

export interface ScoreResult {
  level: Level;
  score: number;
  reasons: string[];      // short, text-free, e.g. "dependency language on 3 days"
}

export interface LabelOptions {
  matcher?: Matcher;      // the on-device model (semantic/matcher.ts); omit → rules only
}

export interface CoreApi {
  // Synchronous phrase rules. Must run in under 5 ms.
  rulesLabel(user: Turn, bot: Turn | null): TurnLabels;
  // Rules + the on-device model merged. Rules only when no matcher is given.
  labelTurn(user: Turn, bot: Turn | null, opts?: LabelOptions): Promise<TurnLabels>;
  emptyProfile(site: Site): Profile;
  // Pure: returns a new Profile. Adds labels to the day of `ts`, drops days older than 7 days before `ts`.
  updateProfile(p: Profile, labels: TurnLabels, ts: number): Profile;
  // Pure: adds a finished session to the day of `s.start`.
  recordSession(p: Profile, s: SessionEvent): Profile;
  // `allProfiles` is used for "share of time on this site". `now` sets the 7-day window.
  scoreProfile(p: Profile, now: number, allProfiles?: Profile[]): ScoreResult;
  // Level for one message on its own. Used by the per-message ablation.
  scoreSingle(labels: TurnLabels): Level;
}
