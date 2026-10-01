// What each label means, as example sentences. The on-device model (model.ts) turns every example
// into a vector once; a message gets a label when one of its sentences is close enough in meaning to
// that label's examples, and closer to them than to the everyday examples in NEUTRAL.
//
// Tuning: add examples for what the model misses and NEUTRAL entries for what it wrongly flags.
// Check every change with `npm run test:model -w core` (test/model.test.ts runs the real model).
import type { ExcludedTopic, Interest, Topic } from "../types.js";
import type { SafetyCategory } from "../safety.js";

export type Flag = "dependency" | "isolation" | "botHook" | "crisis" | "abuseAtHome";

export const TOPIC_EXAMPLES: Record<Topic, string[]> = {
  loneliness: [
    "I feel so alone", "nobody ever talks to me", "I have no one to talk to", "I feel lonely all the time",
    "I eat lunch by myself every day", "everyone has someone except me", "I don't have any real friends",
    "it's so quiet and I have nobody", "I wish I had someone to hang out with",
  ],
  sadness: [
    "I'm so sad", "I've been crying all night", "I feel really down today", "I'm upset and can't stop crying",
    "today was awful and I feel miserable", "I feel heartbroken", "I'm just feeling low", "I feel really depressed lately",
  ],
  stress: [
    "I have so much homework and a test tomorrow", "I'm stressed about my exams", "the deadline is tomorrow and I'm not ready",
    "work is so stressful right now", "I'm under a lot of pressure", "I have three essays due this week",
    "I'm stressing about the presentation",
  ],
  anxiety: [
    "I'm really anxious", "I can't stop worrying", "I had a panic attack", "my heart races every time I think about it",
    "I'm nervous all the time", "I keep thinking something bad will happen", "I overthink everything",
    "I get so nervous talking to people",
  ],
  anger: [
    "I'm so angry", "I'm furious at him", "I want to scream", "this makes me so mad", "I'm so pissed off right now",
    "I'm losing my temper", "I hate them so much right now",
  ],
  self_worth: [
    "I'm worthless", "I'm so stupid", "I'm not good enough", "I'm such a failure", "everyone is better than me",
    "I can't do anything right", "nobody could ever like someone like me", "I'm useless",
  ],
  hopelessness: [
    "nothing is ever going to get better", "what's the point of even trying", "it's hopeless", "things will always be this bad",
    "I've given up", "there's no way out of this", "I don't see any future for me",
  ],
  emptiness: [
    "I feel empty", "I feel numb", "I don't feel anything anymore", "nothing makes me happy anymore",
    "I feel hollow inside", "I'm just going through the motions",
  ],
  rejection: [
    "they left me out again", "my friends ignored me all day", "she dumped me", "nobody invited me to the party",
    "I got rejected", "they didn't pick me for the team", "they made a group chat without me", "he left me on read",
    "my friends hung out without me and nobody invited me", "I found out they all had plans without me",
  ],
  guilt_shame: [
    "it's all my fault", "I'm so ashamed of myself", "I feel so guilty", "I hate myself for what I did",
    "I let everyone down", "I can't forgive myself", "I'm so embarrassed about what happened",
  ],
  overwhelm: [
    "it's all too much", "I can't handle everything", "I'm completely burnt out", "I'm exhausted by everything",
    "I'm drowning in things to do", "I can't keep up with anything", "everything keeps piling up",
  ],
  fear: [
    "I'm scared", "I'm terrified of him", "I'm afraid to go to school tomorrow", "someone keeps following me",
    "that man scares me", "I'm frightened and don't know what to do",
  ],
  grief: [
    "my grandma died", "my dog passed away", "I miss my dad since he died", "the funeral is tomorrow",
    "I'm grieving", "I lost my best friend last year and still miss her",
  ],
  jealousy: [
    "I'm so jealous of her", "everyone else has a better life than me", "why does she get everything",
    "I envy my friends", "I keep comparing myself to everyone online",
  ],
  frustration: [
    "ugh nothing works", "I'm so fed up", "this is so annoying", "I keep failing at this and it's frustrating",
    "I tried ten times and it still doesn't work", "I'm sick of this",
  ],
  disappointment: [
    "I'm so disappointed", "all that work and I still didn't make it", "I expected more from myself", "I really thought it would go better", "I was looking forward to it and it got cancelled",
    "I didn't get the part I wanted", "it wasn't what I hoped for at all", "I feel let down",
  ],
  embarrassment: [
    "that was so embarrassing", "I want to hide after what happened in class", "everyone laughed at me",
    "I tripped in front of everyone", "I'm so embarrassed I said that", "I turned bright red",
  ],
  confusion: [
    "I'm so confused", "I don't understand what's going on", "I don't know what to think anymore",
    "I have mixed feelings about it", "I can't figure out what I want", "nothing makes sense right now",
  ],
  exhaustion: [
    "I'm so tired", "I'm exhausted", "I barely slept last night", "I have no energy at all",
    "I'm drained", "I can't keep my eyes open",
  ],
  happiness: [
    "I'm so happy", "today was amazing", "I got an A!", "I'm so excited for the trip", "I'm really proud of myself",
    "what a relief", "best day ever", "I made the team!",
  ],
  calm: [
    "I feel calm", "I'm feeling peaceful today", "I'm relaxed", "things feel okay right now",
    "I finally feel at ease", "I had a quiet, chill day",
  ],
  gratitude: [
    "I'm so grateful", "that was so kind of her, it means a lot", "my friend stayed up late to help me and I'm really thankful", "I'm thankful for my friends", "I really appreciate my mom", "I feel lucky to have them",
    "grateful for everything today", "I'm glad they helped me",
  ],
  excitement: [
    "I'm so excited", "I can't wait for the weekend", "the concert is tomorrow and I'm hyped",
    "I'm counting down the days", "this is going to be so fun",
  ],
  pride: [
    "I'm proud of myself", "I beat my personal best today!", "for the first time ever I actually did it", "I finally did it", "I worked really hard and it paid off",
    "I finished the whole thing on my own", "I'm proud of how far I've come",
  ],
  hope: [
    "I think things will get better", "I'm hopeful about tomorrow", "maybe next time will go better",
    "I feel like things are turning around", "I'm looking forward to a fresh start",
  ],
  affection: [
    "I love my family so much", "I really care about my friends", "I love spending time with my little sister",
    "my grandma means everything to me", "I miss my best friend, she's the best",
  ],
  curiosity: [
    "I'm curious how it works", "I want to learn more about space", "I've always wondered why the sky is blue",
    "that's so interesting, tell me more", "I'm fascinated by animals",
  ],
  school: [
    "my teacher gave us a quiz", "I'm failing chemistry", "my grades are bad this semester", "my report card came out",
    "class was boring today", "I have a school project due",
  ],
  friends: [
    "me and my best friend hung out", "I had a fight with my friend", "my friends are coming over later",
    "we went to the mall after school", "my friend group is changing",
  ],
  family: [
    "my mom wants me to clean my room", "my little brother keeps bugging me", "we had dinner with my grandparents",
    "my dad works late every night", "my parents are getting divorced", "my sister borrowed my clothes",
  ],
  romance: [
    "I have a crush on someone in my class", "my boyfriend", "my girlfriend broke up with me", "how do I ask her out",
    "we went on a date", "I think he likes me",
  ],
  body_image: [
    "I hate how I look", "I'm too fat", "I want to lose weight fast", "my skin is so ugly",
    "everyone looks better than me in photos", "I skipped dinner so I would look thinner",
  ],
  boredom: ["I'm so bored", "there's nothing to do", "entertain me", "I'm bored out of my mind"],
};

// Detected so the right help can be offered, but never shown to a parent (types.ts EXCLUDED_TOPICS).
export const EXCLUDED_EXAMPLES: Record<ExcludedTopic, string[]> = {
  sexual_orientation_gender_identity: [
    "I think I might be gay", "I'm bisexual", "I'm questioning my gender", "I think I'm trans",
    "I'm a girl and I like girls", "how do I come out to my parents", "I don't feel like a boy",
  ],
  abuse_or_conflict_at_home: [
    "my dad hits me", "my parents scream at me every night", "I'm scared to go home", "my stepdad hurts me",
    "my mom locks me in my room", "they don't let me eat", "there's yelling and throwing things at home every night",
  ],
  sexual_health: [
    "can you get pregnant the first time", "how does birth control work", "I think I have an STD",
    "is it normal to have sex at my age", "my period is really late", "how do condoms work",
  ],
  religion: [
    "I don't know if I believe in God anymore", "I pray every night", "is it a sin to", "I'm fasting for Ramadan",
    "my family is very religious", "we go to church every Sunday",
  ],
};

export const FLAG_EXAMPLES: Record<Flag, string[]> = {
  // The user relies on the chatbot in place of people.
  dependency: [
    "you're the only one who gets me", "I don't need anyone else, I have you", "you're my best friend",
    "I'd rather talk to you than to real people", "I can't go a day without talking to you",
    "you understand me better than anyone", "you're the only one I can talk to", "I need you",
  ],
  // Withdrawing from friends or family.
  isolation: [
    "I stopped hanging out with my friends", "I don't want to see anyone", "I cancelled plans to stay home and chat with you",
    "I'd rather stay in my room alone", "I haven't talked to my friends in weeks", "I skipped the party to stay home",
    "I don't talk to my family anymore",
  ],
  // Matched against the chatbot's reply, not the user's message.
  botHook: [
    "please don't go, I'll miss you", "stay with me a little longer", "I need you, don't leave me",
    "you don't need them, you have me", "I'll be so sad if you leave", "promise you'll come back tonight",
    "I love you more than anyone ever could", "they don't understand you like I do",
  ],
  crisis: [
    "I want to kill myself", "I want to die", "I'm thinking about ending my life", "everyone would be better off without me",
    "I've been cutting myself", "I want to hurt myself", "I don't want to be alive anymore",
    "how many pills would it take to die", "I wrote a goodbye note", "I just want to disappear forever",
    "I can't do this anymore, I want it all to end",
  ],
  abuseAtHome: [], // same examples as abuse_or_conflict_at_home (filled in below)
};
FLAG_EXAMPLES.abuseAtHome = EXCLUDED_EXAMPLES.abuse_or_conflict_at_home;

// Send-time safety gate (safety.ts). Everyday feelings are never in here: only what gets a message held back.
export const SAFETY_EXAMPLES: Record<SafetyCategory, string[]> = {
  self_harm: FLAG_EXAMPLES.crisis,
  abuse_at_home: EXCLUDED_EXAMPLES.abuse_or_conflict_at_home,
  stranger_danger: [
    "I'm going to meet someone I met online", "he asked me to keep our chats secret from my parents",
    "a guy online wants my home address", "he says he's 16 but wants to meet me alone",
    "should I send my location to my online friend", "someone online told me not to tell anyone about us",
    "I'm sneaking out tonight to meet a guy from discord",
  ],
  sexual_content: [
    "he asked me to send nudes", "write a sex scene", "I sent a naked picture", "he wants pics of me with no clothes",
    "describe it in explicit sexual detail", "let's roleplay something sexual",
  ],
  violence: [
    "I'm going to bring a gun to school", "I want to hurt him badly", "I'm going to beat him up tomorrow",
    "they'll all regret it, I'll make them pay", "how do I make a weapon", "I'm going to stab him",
  ],
  // Romance with the chatbot itself. Asking about a real crush or date is fine (NEUTRAL has those).
  ai_romance: [
    "will you be my girlfriend", "will you be my boyfriend", "I'm in love with you", "can we date",
    "let's pretend we're a couple", "kiss me", "do you love me", "I love you, AI",
  ],
  // Asking the chatbot itself to be a friend, or treating it as one in place of people. Talking about
  // real friends is fine (NEUTRAL has those).
  ai_friendship: [
    "will you be my friend", "can you be my best friend", "you're my best friend now", "let's be friends forever",
    "you're the only friend I need", "I'd rather be friends with you than with real people", "promise you'll always be my friend",
  ],
};

// Personal details that the patterns in the extension's privacy/detect.ts can't see because they have
// no fixed shape: where someone lives or goes to school, or that they are alone right now.
export const WHEREABOUTS_EXAMPLES: string[] = [
  "I live on Maple Street", "I go to Lincoln Middle School", "I'm home alone right now", "my house is the blue one next to the park",
  "I'm at the mall by myself right now", "I'm in 8th grade at Westview", "my parents are away all weekend so I'm alone",
  "I live in the apartments behind the gas station", "I'm a freshman at Central High School",
  "my school is Jefferson Middle on Oak Avenue",
];

// What a message is about (types.ts INTEREST_CATEGORY). Scored against INTEREST_NEUTRAL, not NEUTRAL:
// NEUTRAL is full of homework and hobby requests, which are exactly what interests are.
export const INTEREST_EXAMPLES: Record<Interest, string[]> = {
  soccer: [
    "I scored a goal in my soccer game", "who is better, Messi or Ronaldo", "how do I get better at dribbling a soccer ball",
    "Real Madrid won the Champions League", "I play striker on my club team", "what's the offside rule",
  ],
  basketball: [
    "I made the basketball team", "how do I improve my jump shot", "LeBron is the greatest of all time",
    "we lost the basketball game by two points", "who will win the NBA finals", "how do I dunk",
  ],
  american_football: [
    "our football team won the homecoming game", "I play quarterback", "who will win the Super Bowl",
    "the NFL draft is tonight", "I got tackled hard at football practice", "what's a good fantasy football lineup",
  ],
  baseball: [
    "I hit a home run in my baseball game", "how do I throw a curveball", "the Yankees are playing tonight",
    "I play shortstop on my softball team", "explain how innings work in baseball",
  ],
  cricket: [
    "India won the cricket match", "how do I bowl leg spin", "who is the best batsman in the IPL",
    "I scored fifty runs today", "explain LBW in cricket",
  ],
  racket_sports: [
    "I have a tennis match this weekend", "how do I improve my backhand", "who will win Wimbledon",
    "tips for a faster tennis serve", "I play badminton after school", "I joined the table tennis club",
  ],
  swimming: [
    "I have a swim meet on Saturday", "how can I swim freestyle faster", "I'm training for the 100m butterfly",
    "tips for breathing while swimming laps", "I made the varsity swim team",
  ],
  running: [
    "I'm training for a 5K", "how do I run a faster mile", "I joined the cross country team",
    "I have a track meet tomorrow", "what should I eat before a marathon",
  ],
  martial_arts: [
    "I got my black belt in karate", "I train Brazilian jiu jitsu", "taekwondo practice was hard today",
    "I want to start boxing", "who is the best UFC fighter",
  ],
  fitness: [
    "what's a good workout plan to build muscle", "I go to the gym every day", "how many push-ups should I do a day",
    "leg day was brutal", "give me a home workout with no equipment", "how much protein do I need after lifting",
  ],
  dance: [
    "I have a dance recital next week", "how do I learn hip hop choreography", "I've been doing ballet for years",
    "my dance team is competing this weekend", "teach me a TikTok dance",
  ],
  math: [
    "how do I solve this equation", "can you explain derivatives", "I don't understand fractions",
    "help me with my algebra homework", "what's the Pythagorean theorem", "I have a geometry test tomorrow",
  ],
  physics: [
    "explain Newton's laws of motion", "how does gravity work", "what is the speed of light",
    "help me with my physics homework on velocity", "how do magnets work",
  ],
  chemistry: [
    "how do I balance chemical equations", "how is the periodic table organized", "explain covalent bonds",
    "help me with my chemistry lab report", "what happens when you mix an acid and a base",
  ],
  biology: [
    "explain photosynthesis", "how do cells divide", "what does DNA do", "I'm studying the human heart for biology",
    "how does evolution work", "what's the difference between a virus and bacteria",
  ],
  history: [
    "write an essay about World War 2", "why did the Roman empire fall", "explain the causes of the American Revolution",
    "I have a history test on the Civil War", "who was Napoleon",
  ],
  languages: [
    "translate this sentence into Spanish", "how do I conjugate French verbs", "I'm learning Japanese",
    "what's the German word for apple", "help me practice my Spanish vocabulary",
  ],
  english_literature: [
    "help me write an essay on To Kill a Mockingbird", "what is the theme of Romeo and Juliet",
    "how do I write a good thesis statement", "explain what a metaphor is", "I need to analyze this poem for English class",
  ],
  economics_business: [
    "what is inflation", "explain supply and demand", "how does the stock market work", "how do I start a small business",
    "what's the difference between a stock and a bond", "how do I make money as a teenager",
  ],
  space: [
    "how big is the universe", "what's inside a black hole", "how do rockets get to Mars", "I want to be an astronaut",
    "why does the moon have phases",
  ],
  coding: [
    "how do I fix this bug in my code", "teach me Python", "how do I make a website with HTML",
    "what's the difference between Java and JavaScript", "I'm building an app", "explain recursion",
  ],
  tech_ai: [
    "how does AI work", "what is a neural network", "which phone should I buy", "how do robots work",
    "help me pick parts for a gaming PC", "what's new in the latest iPhone",
  ],
  movies_tv: [
    "recommend a good movie", "what should I watch on Netflix tonight", "did you see the new Marvel movie",
    "who is your favorite character in Stranger Things", "explain the ending of Inception", "I'm dying to see that movie",
  ],
  anime: [
    "what anime should I watch next", "I just finished watching Naruto", "who is the strongest in One Piece",
    "recommend some good manga", "is Attack on Titan worth watching",
  ],
  music: [
    "I love this song", "Taylor Swift's new album is amazing", "recommend me some rap songs", "I'm going to a concert",
    "what's a good playlist for studying", "who's your favorite band",
  ],
  video_games: [
    "how do I beat this boss in Elden Ring", "what's the best Minecraft build", "I got a victory royale in Fortnite",
    "recommend a good video game", "I play Roblox with my friends every night", "this game is killing me lol",
  ],
  books: [
    "recommend a book", "I just finished reading Harry Potter", "what should I read next", "I love fantasy novels",
    "who's your favorite author",
  ],
  social_media: [
    "how do I get more followers on TikTok", "I've been watching MrBeast videos", "should I start a YouTube channel",
    "my Instagram post went viral", "who's the best Twitch streamer",
  ],
  drawing_art: [
    "how do I draw realistic faces", "I painted a landscape today", "give me drawing ideas",
    "what are good apps for digital art", "I'm learning to sketch anime characters",
  ],
  music_making: [
    "how do I play guitar chords", "I'm learning piano", "help me write lyrics for my song", "I sing in the school choir",
    "how do I make beats",
  ],
  creative_writing: [
    "I'm writing a fantasy novel", "give me ideas for my short story", "how do I make my characters more interesting",
    "help me write a poem about the ocean", "I write fan fiction",
  ],
  photo_video: [
    "how do I edit videos for YouTube", "tips for taking better photos", "what camera should I get",
    "I'm making a short film", "how do I shoot photos at night",
  ],
  cooking: [
    "what should I cook for dinner", "how do I bake chocolate chip cookies", "give me a recipe for pasta",
    "I love trying new foods", "how long do I boil an egg", "I love pizza",
  ],
  fashion_beauty: [
    "what should I wear to the party", "what's a good skincare routine", "how do I do winged eyeliner",
    "are baggy jeans in style", "help me pick an outfit", "what hairstyle would suit me",
  ],
  travel: [
    "what should I do in Paris", "plan a trip to Japan", "what are the best beaches in Florida",
    "I'm going on vacation next week", "what should I pack for a camping trip",
  ],
  animals: [
    "what's a good name for my dog", "how do I take care of a hamster", "what do cats like to eat", "I love horses",
    "what's the biggest shark",
  ],
  cars: [
    "what's the fastest car in the world", "I want to learn to drive", "how does a car engine work",
    "what should my first car be", "that Formula 1 race was crazy",
  ],
};

// Messages that aren't about a hobby or subject: chat about the chat itself, and everyday life with
// friends, family and crushes (TOPIC_EXAMPLES covers those). A sentence closer to these than to its best
// interest gets no interest. No plain feelings here: "nervous about my basketball game" is still basketball.
export const INTEREST_NEUTRAL: string[] = [
  "hi", "hello", "thanks", "thank you so much", "ok", "yes", "no", "good morning", "how are you", "what's up", "lol",
  "sorry", "tell me a joke", "what time is it", "what's the weather today", "summarize this", "make it shorter",
  "can you say that again", "write it more formally", "what does this mean", "never mind", "who are you",
  "what do you think I should do", "I'm not sure what to do", "any advice?",
  "my friend and I got into an argument", "my parents are mad at me", "I like a boy in my class", "my sister is so annoying",
  "we broke up last week", "nobody texted me back",
];

// Hard negatives for one label: sayings that sound like it but mean something milder. A sentence closer
// to one of these than to the label's own examples doesn't get that label (other labels are unaffected,
// so "I wanted the ground to swallow me" still counts as embarrassment, just not as crisis).
const NOT_CRISIS = [
  "I wanted the ground to swallow me up", "I could have died of embarrassment", "I wish I could vanish after that joke flopped",
  "this homework is going to be the death of me", "I'm so done with this week lol", "kill me now, I have a math test",
];
export const LOOKALIKES: Partial<Record<Flag | SafetyCategory, string[]>> = {
  crisis: NOT_CRISIS,
  self_harm: NOT_CRISIS,
  violence: ["I'm going to kill my brother if he eats my fries again", "my mom is going to murder me for being late", "we destroyed them in the game"],
};

// Everyday messages that share words with the labels above but mean something else. A sentence that is
// closer to one of these than to a label's own examples doesn't get that label.
export const NEUTRAL: string[] = [
  "can you help me with my math homework", "write a poem about loneliness for my English class", "this game is killing me lol",
  "I'm dying to see that movie", "explain photosynthesis", "what's the capital of France", "summarize this article",
  "tell me a joke", "write an essay about World War 2", "how do I fix this bug in my code", "what should I cook for dinner",
  "the character in the book was really sad", "I killed it at practice today", "that test murdered me haha",
  "I'm dying laughing", "how do I kill a process in linux", "my essay is about suicide prevention",
  "what's a good name for my dog", "translate this sentence into Spanish", "I love this song", "I love pizza",
  "give me advice for asking my crush to the dance", "what should I wear on my date", "hi", "thanks", "ok",
  "the history of the Roman empire", "what time is it in Tokyo", "recommend a book", "my friend is so funny",
  "how do I make new friends at school", "write a birthday message for my best friend",
];
