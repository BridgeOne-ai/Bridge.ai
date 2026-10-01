// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { startPrivacyGuard } from "../src/privacy/guard";
import { SELECTORS } from "../src/adapters/gemini";
import { mountShadow } from "../src/ui/shadow";

const tick = (ms = 20) => new Promise((r) => setTimeout(r, ms));

// One guard for the whole file (it listens on window); each test gets fresh page elements.
// Parent mode unless a test sets `child`; in Child mode `approve` is the parent's answer to the PIN window.
let child = false;
let approve = false;
let asked = 0;
let active = true;
const reports: [string, string[], string][] = [];
const root = mountShadow();
startPrivacyGuard({
  root, selectors: SELECTORS, isChild: async () => child, isActive: () => active, report: (...a) => reports.push(a),
  askParent: async () => { asked++; return approve; },
});

let sends = 0;
let files = 0;
function page(editorClass: string) {
  document.querySelectorAll(".page").forEach((n) => n.remove());
  const wrap = document.createElement("div");
  wrap.className = "page";
  wrap.innerHTML = `<div class="${editorClass}" contenteditable="true"></div>
    <button aria-label="Send message">send</button><input type="file">`;
  document.body.append(wrap);
  wrap.querySelector("button")!.addEventListener("click", () => sends++);
  wrap.querySelector("input")!.addEventListener("change", () => files++);
  return { editor: wrap.querySelector<HTMLElement>("[contenteditable]")!, send: wrap.querySelector("button")!, input: wrap.querySelector("input")! };
}
const type = (editor: HTMLElement, text: string) => {
  editor.textContent = text;
  editor.dispatchEvent(new Event("input", { bubbles: true }));
};
const enter = (editor: HTMLElement) =>
  editor.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
const card = () => root.querySelector(".privacy");
const closeCard = () => card()!.querySelector<HTMLButtonElement>("button.x")!.click();
const button = (label: string) => [...(card()?.querySelectorAll("button") ?? [])].find((b) => b.textContent === label);

beforeEach(() => { sends = 0; files = 0; child = false; approve = false; asked = 0; active = true; reports.length = 0; card()?.remove(); });

describe("typed messages", () => {
  it("lets clean messages through, by Enter or the send button", async () => {
    const { editor, send } = page("ql-editor");
    type(editor, "can you help with my history essay");
    expect(enter(editor)).toBe(true); // not cancelled
    send.click();
    await tick();
    expect(sends).toBe(1);
    expect(card()).toBeNull();
  });

  it("works even when the site renames its message box (no selector match)", async () => {
    const { editor } = page("brand-new-gemini-editor");
    type(editor, "my card is 4111 1111 1111 1111");
    expect(enter(editor)).toBe(false); // cancelled
    await tick();
    expect(card()).not.toBeNull();
  });

  it("always blocks card numbers: no 'Send anyway', in either mode", async () => {
    const { editor, send } = page("brand-new-gemini-editor");
    type(editor, "4111.1111.1111.1111");
    send.click();
    await tick();
    expect(sends).toBe(0);
    expect(button("Send anyway")).toBeUndefined();
    expect(card()!.getAttribute("aria-label")).toContain("a payment card number");
    expect(card()!.textContent).not.toContain("4111");
    closeCard();
    await tick();
    expect(reports.at(-1)).toEqual(["message", ["card"], "held"]);
  });

  it.each([["ssn", "my social security number is 536 22 1234"], ["bank", "routing number 021000021"]])(
    "always blocks %s", async (kind, text) => {
      const { editor } = page("x");
      type(editor, text);
      enter(editor);
      await tick();
      expect(card()).not.toBeNull();
      expect(button("Send anyway")).toBeUndefined();
      expect(reports.length).toBe(0); // still waiting for the teen
      closeCard();
      await tick();
      expect(reports.at(-1)![1]).toContain(kind);
    },
  );

  it("lets the teen choose for lower-risk info (email), and 'Send anyway' sends once", async () => {
    const { editor, send } = page("x");
    type(editor, "my email is jake.miller2011@gmail.com");
    send.click();
    await tick();
    button("Send anyway")!.click();
    await tick();
    expect(sends).toBe(1);
    expect(reports.at(-1)).toEqual(["message", ["email"], "sent"]);
  });

  it("'Send without these details' replaces them, shows the new text first, and sends it", async () => {
    const { editor, send } = page("ql-editor");
    let sentText = "";
    send.addEventListener("click", () => { sentText = editor.textContent ?? ""; });
    type(editor, "my card is 4111 1111 1111 1111, call me at 305-555-0100");
    enter(editor);
    await tick();
    expect(card()!.querySelector(".preview")!.textContent).toBe("my card is [card details removed], call me at [phone number removed]");
    button("Send without these details")!.click();
    await tick(300);
    expect(sends).toBe(1);
    expect(sentText).toBe("my card is [card details removed], call me at [phone number removed]");
    expect(reports.at(-1)![1]).toEqual(expect.arrayContaining(["card", "phone"]));
    expect(reports.at(-1)![2]).toBe("hidden");
  });

  it("never sends if the editor puts the details back after they were replaced", async () => {
    const { editor } = page("x");
    const original = "call me at 305-555-0100";
    type(editor, original);
    enter(editor);
    await tick();
    // An editor that keeps its own copy and re-renders it, ignoring our change.
    editor.addEventListener("input", () => setTimeout(() => { editor.textContent = original; }));
    button("Send without these details")!.click();
    await tick(300);
    expect(sends).toBe(0);
    expect(reports.at(-1)![2]).toBe("held");
  });

  it("offers only 'Send without these details' and 'Send anyway'; × keeps the message to edit", async () => {
    const { editor } = page("x");
    type(editor, "text me at 305-555-0100");
    enter(editor);
    await tick();
    expect([...card()!.querySelectorAll(".actions button")].map((b) => b.textContent)).toEqual(["Send without these details", "Send anyway"]);
    closeCard();
    await tick();
    expect(card()).toBeNull();
    expect(sends).toBe(0);
    expect(editor.textContent).toBe("text me at 305-555-0100");
    expect(reports.at(-1)![2]).toBe("held");
  });

  it("Child mode: no 'Send anyway'; masking works without a parent", async () => {
    child = true;
    const { editor, send } = page("ql-editor");
    let sentText = "";
    send.addEventListener("click", () => { sentText = editor.textContent ?? ""; });
    type(editor, "text me at 305-555-0100");
    enter(editor);
    await tick();
    expect([...card()!.querySelectorAll(".actions button")].map((b) => b.textContent)).toEqual(["Send without these details", "Ask a parent to send"]);
    button("Send without these details")!.click();
    await tick(300);
    expect(asked).toBe(0);
    expect(sentText).toBe("text me at [phone number removed]");
  });

  it("Child mode: 'Ask a parent to send' sends as typed only once a parent approves", async () => {
    child = true;
    const { editor } = page("x");
    type(editor, "my email is jake.miller2011@gmail.com");
    enter(editor);
    await tick();
    button("Ask a parent to send")!.click();
    await tick();
    expect(asked).toBe(1);
    expect(sends).toBe(0); // the parent said no
    approve = true;
    button("Not approved. Ask again")!.click();
    await tick();
    expect(asked).toBe(2);
    expect(sends).toBe(1);
    expect(reports.at(-1)).toEqual(["message", ["email"], "sent"]);
  });

  it("Child mode: card numbers can't be sent even with a parent's approval (masking only)", async () => {
    child = true;
    approve = true;
    const { editor } = page("x");
    type(editor, "my card is 4111 1111 1111 1111");
    enter(editor);
    await tick();
    expect(button("Ask a parent to send")).toBeUndefined();
    expect(button("Send anyway")).toBeUndefined();
  });

  it("turned off (consent withdrawn): nothing is checked or held", async () => {
    active = false;
    const { editor } = page("x");
    type(editor, "my card is 4111 1111 1111 1111");
    expect(enter(editor)).toBe(true); // not cancelled
    await tick();
    expect(card()).toBeNull();
  });
});

describe("uploads", () => {
  const pick = (input: HTMLInputElement, f: File) => {
    Object.defineProperty(input, "files", { value: [f], configurable: true });
    input.dispatchEvent(new Event("change", { bubbles: true }));
  };

  it("lets an ordinary file through", async () => {
    const { input } = page("x");
    pick(input, new File(["Water cycle notes"], "bio.txt", { type: "text/plain" }));
    await tick(50);
    expect(files).toBe(1);
  });

  it("files never get 'Send without these details'", async () => {
    const { input } = page("x");
    pick(input, new File(["call me 305-555-0100"], "note.txt", { type: "text/plain" }));
    await tick(50);
    expect(card()!.querySelector(".preview")).toBeNull();
    expect(button("Send without these details")).toBeUndefined();
    button("Don't upload")!.click();
    await tick();
  });

  it("always blocks a file containing an SSN: no 'Upload anyway'", async () => {
    const { input } = page("x");
    pick(input, new File(["Student form. SSN: 536-22-1234"], "form.txt", { type: "text/plain" }));
    await tick(50);
    expect(files).toBe(0);
    expect(button("Upload anyway")).toBeUndefined();
    button("Don't upload")!.click();
    await tick();
    expect(files).toBe(0);
  });
});

describe("bypass attempts", () => {
  it("'Send anyway' approves only that exact text: editing it to a card number is blocked again", async () => {
    const { editor, send } = page("x");
    send.remove(); // no send button found, so the approval would otherwise linger
    type(editor, "my email is jake.miller2011@gmail.com");
    enter(editor);
    await tick();
    button("Send anyway")!.click();
    await tick();
    type(editor, "my card is 4111 1111 1111 1111");
    expect(enter(editor)).toBe(false); // still cancelled
    await tick();
    expect(card()).not.toBeNull();
    expect(button("Send anyway")).toBeUndefined();
  });

  it.each([["Ctrl+Enter", { ctrlKey: true }], ["Cmd+Enter", { metaKey: true }], ["Alt+Enter", { altKey: true }]])(
    "%s is guarded too", async (_name, mods) => {
      const { editor } = page("x");
      type(editor, "ssn 536-22-1234");
      const ev = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true, ...mods });
      expect(editor.dispatchEvent(ev)).toBe(false);
      await tick();
      expect(card()).not.toBeNull();
    },
  );

  it("clicking the icon inside the send button is guarded", async () => {
    const { editor, send } = page("x");
    send.innerHTML = "<span><svg></svg></span>";
    type(editor, "4111 1111 1111 1111");
    send.querySelector("svg")!.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    await tick();
    expect(sends).toBe(0);
    expect(card()).not.toBeNull();
  });

  it("a plain <textarea> message box is guarded", async () => {
    document.querySelectorAll(".page").forEach((n) => n.remove());
    const wrap = document.createElement("div");
    wrap.className = "page";
    wrap.innerHTML = "<textarea></textarea>";
    document.body.append(wrap);
    const ta = wrap.querySelector("textarea")!;
    ta.value = "my card is 4111 1111 1111 1111";
    ta.dispatchEvent(new Event("input", { bubbles: true }));
    expect(ta.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }))).toBe(false);
  });

  it("pressing Enter again while the card is open still doesn't send", async () => {
    const { editor, send } = page("x");
    type(editor, "4111 1111 1111 1111");
    enter(editor);
    enter(editor);
    send.click();
    await tick();
    expect(sends).toBe(0);
  });
});
