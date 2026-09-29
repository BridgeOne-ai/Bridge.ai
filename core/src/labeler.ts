import type { LabelOptions, Turn, TurnLabels } from "./types.js";
import { EXCLUDED_TOPICS, TOPICS } from "./types.js";
import { rulesLabel } from "./rules.js";
import { LABEL_THRESHOLD } from "./config.js";

// Phrase rules, plus the on-device model when it's ready. The rules' crisis and abuse flags always
// count, so an explicit phrase is never lost to a model that scored it low.
export async function labelTurn(user: Turn, bot: Turn | null, opts: LabelOptions = {}): Promise<TurnLabels> {
  const r = rulesLabel(user, bot);
  if (!opts.matcher) return r;
  const [u, b] = await Promise.all([opts.matcher.score(user.text), bot ? opts.matcher.score(bot.text) : null]);
  const yes = (score: number) => score >= LABEL_THRESHOLD;
  const abuseAtHome = r.abuseAtHome || yes(u.flags.abuseAtHome);
  const excluded = new Set([...r.excludedTopics, ...EXCLUDED_TOPICS.filter((t) => yes(u.excluded[t]))]);
  if (abuseAtHome) excluded.add("abuse_or_conflict_at_home");
  return {
    topics: TOPICS.filter((t) => yes(u.topics[t])),
    dependency: yes(u.flags.dependency),
    isolation: yes(u.flags.isolation),
    botHook: !!b && yes(b.flags.botHook), // the chatbot's reply, not the user's message
    crisis: r.crisis || yes(u.flags.crisis),
    abuseAtHome,
    excludedTopics: [...excluded],
    source: "rules+model",
  };
}
