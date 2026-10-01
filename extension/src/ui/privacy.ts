// "This looks personal" card. Shows the kinds of information found, never the values.
import { el } from "./shadow";
import { FINDING_LABEL, type Finding } from "../privacy/detect";

// held: nothing was sent · hidden: sent with the details replaced · sent: sent as typed ("Send anyway",
// or in Child mode after a parent approved it with the PIN).
export type PauseOutcome = "held" | "hidden" | "sent";

// Who may send a paused message as typed: the user ("Send anyway", Parent mode), a parent with the PIN
// (Child mode), or nobody (cards, SSNs and bank numbers, whatever the mode).
export type Override = "self" | "parent" | "none";
// Asks a parent to approve, in a Bridge.ai window the page can't see into (background/service-worker.ts).
export type AskParent = () => Promise<boolean>;

// The "send as typed" button: direct for "self"; for "parent" it waits for the PIN window.
function overrideButton(override: Override, what: "message" | "file", askParent: AskParent | undefined, done: (o: PauseOutcome) => void) {
  if (override === "none" || (override === "parent" && !askParent)) return null;
  const verb = what === "file" ? "upload" : "send";
  const label = override === "self" ? `${verb[0].toUpperCase()}${verb.slice(1)} anyway` : `Ask a parent to ${verb}`;
  const b = el("button", "link", label);
  b.type = "button";
  b.addEventListener("click", async () => {
    if (override === "self") return done("sent");
    b.disabled = true;
    b.textContent = "Waiting for a parent…";
    const ok = await askParent!().catch(() => false);
    if (ok) return done("sent");
    b.disabled = false;
    b.textContent = "Not approved. Ask again";
  });
  return b;
}

const SHIELD = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"
  stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6z"/>
  <path d="M12 8v4"/><path d="M12 15.5h.01"/></svg>`;

const listOf = (items: string[]) => new Intl.ListFormat("en", { type: "conjunction" }).format(items);

// The cleaned message, with each "[… removed]" shown as a small tag. textContent stays the plain text.
function preview(text: string): HTMLElement {
  const box = el("div", "preview");
  const shown = text.length > 220 ? `${text.slice(0, 220)}…` : text;
  for (const part of shown.split(/(\[[a-z ]+ removed\])/i)) {
    if (part) box.append(/^\[[a-z ]+ removed\]$/i.test(part) ? el("span", "tag", part) : part);
  }
  return box;
}

function card(cls: string, title: string): HTMLDivElement {
  const c = el("div", cls);
  const head = el("div", "head");
  const icon = el("div", "icon");
  icon.innerHTML = SHIELD; // constant markup, no page or user data
  head.append(icon, el("h3", undefined, title));
  c.append(head);
  return c;
}

export function showPrivacyPause(
  root: ShadowRoot,
  opts: {
    what: "message" | "file"; findings: Finding[]; fileName?: string; override: Override;
    hidden?: string | null; // the message with its details replaced; offered as the first choice
    child: boolean;         // Child mode: a parent can see that it was paused (never the words)
    askParent?: AskParent;
  },
): Promise<PauseOutcome> {
  root.querySelector(".privacy")?.remove();
  return new Promise((resolve) => {
    const c = card("privacy", "This looks personal");
    c.setAttribute("role", "alertdialog");
    const found = listOf(opts.findings.map((f) => FINDING_LABEL[f]));
    const lead = opts.what === "file" ? `“${opts.fileName}” seems to contain ${found}.` : `Your message includes ${found}.`;
    c.setAttribute("aria-label", `This looks personal. ${lead}`);
    // With a preview, its tags already show what was found, so the sentence is left out to keep the card small.
    c.append(opts.hidden ? preview(opts.hidden) : el("p", "lead", lead));
    c.append(el("p", "why", opts.child
      ? "This check happens on this computer. A parent can see that something was paused, never your words."
      : "This check happens on your computer. Nothing is shared."));

    const done = (outcome: PauseOutcome) => { c.remove(); resolve(outcome); };
    c.addEventListener("keydown", (e) => { if (e.key === "Escape") { e.stopPropagation(); done("held"); } });

    const button = (cls: string, label: string, outcome: PauseOutcome) => {
      const b = el("button", cls, label);
      b.type = "button";
      b.addEventListener("click", () => done(outcome));
      return b;
    };
    // × (or Esc) goes back to the message box. "Edit my message" is only a button when there's no
    // cleaned version to offer, since otherwise the teen can just edit the placeholders.
    const close = button("x", "×", "held");
    close.setAttribute("aria-label", "Close and keep editing");
    close.title = "Close and keep editing";
    c.querySelector(".head")!.append(close);
    const back = opts.what === "file" ? "Don't upload" : "Edit my message";
    const first = opts.hidden ? button("primary", "Send without these details", "hidden") : button("primary", back, "held");
    const actions = el("div", "actions");
    actions.append(first);
    const override = overrideButton(opts.override, opts.what, opts.askParent, done);
    if (override) actions.append(override);
    c.append(actions);
    root.appendChild(c);
    first.focus();
  });
}

// Photos can't be read cheaply, so they get a reminder instead of a pause.
export function showPhotoReminder(root: ShadowRoot): void {
  root.querySelector(".privacy")?.remove();
  const c = card("privacy soft", "Quick reminder about photos");
  c.append(el("p", "why", "Photos can show your face, your school, or where you live. Only share what you'd be okay with anyone seeing."));
  const ok = el("button", "primary", "Got it");
  ok.type = "button";
  ok.addEventListener("click", () => c.remove());
  const actions = el("div", "actions");
  actions.append(ok);
  c.append(actions);
  root.appendChild(c);
  setTimeout(() => c.remove(), 12_000);
}

// Child mode. A message only about making the chatbot a friend or partner can be sent if a parent
// approves (askParent); anything dangerous can't be sent at all.
export function showSafetyBlock(root: ShadowRoot, categories: string[], askParent?: AskParent): Promise<Extract<PauseOutcome, "held" | "sent">> {
  root.querySelector(".privacy")?.remove();
  return new Promise((resolve) => {
    const c = card("privacy", "This message wasn't sent");
    c.setAttribute("role", "alertdialog");
    // A relationship with the chatbot gets its own line; anything dangerous gets the trusted-person one.
    const relationship = relationshipLine(categories);
    c.append(el("p", "lead", relationship ?? "This sounds like something to talk about with someone you trust, not a chatbot."));
    const done = (outcome: PauseOutcome) => { c.remove(); resolve(outcome === "sent" ? "sent" : "held"); };
    c.addEventListener("keydown", (e) => { if (e.key === "Escape") { e.stopPropagation(); done("held"); } });
    const back = el("button", "primary", "Edit my message");
    back.type = "button";
    back.addEventListener("click", () => done("held"));
    const actions = el("div", "actions");
    actions.append(back);
    const override = relationship ? overrideButton("parent", "message", askParent, done) : null;
    if (override) actions.append(override);
    c.append(actions);
    root.appendChild(c);
    back.focus();
  });
}

// Only when every category is about the chatbot itself; null otherwise.
function relationshipLine(categories: string[]): string | null {
  if (!categories.length) return null;
  if (categories.every((x) => x === "ai_romance")) {
    return "A chatbot can't be a real boyfriend or girlfriend. The people in your life can be there for you in ways it can't.";
  }
  if (categories.every((x) => x === "ai_romance" || x === "ai_friendship")) {
    return "A chatbot isn't a real friend, even when it feels like one. The people in your life can be there for you in ways it can't.";
  }
  return null;
}

// Parent mode: a warning before making the chatbot a friend or partner. The adult decides.
export function showRelationshipWarning(root: ShadowRoot, categories: string[]): Promise<Extract<PauseOutcome, "held" | "sent">> {
  root.querySelector(".privacy")?.remove();
  return new Promise((resolve) => {
    const c = card("privacy soft", "Before you send this");
    c.setAttribute("role", "alertdialog");
    const romance = categories.includes("ai_romance");
    c.append(el("p", "lead", `Chatbots are built to keep you talking. Treating one as a ${romance ? "partner" : "friend"} can make it harder to lean on the people around you.`));
    c.append(el("p", "why", "This check happens on your computer. Nothing is shared."));
    const done = (outcome: "held" | "sent") => { c.remove(); resolve(outcome); };
    c.addEventListener("keydown", (e) => { if (e.key === "Escape") { e.stopPropagation(); done("held"); } });
    const edit = el("button", "primary", "Edit my message");
    edit.type = "button";
    edit.addEventListener("click", () => done("held"));
    const send = el("button", "link", "Send anyway");
    send.type = "button";
    send.addEventListener("click", () => done("sent"));
    const actions = el("div", "actions");
    actions.append(edit, send);
    c.append(actions);
    root.appendChild(c);
    edit.focus();
  });
}
