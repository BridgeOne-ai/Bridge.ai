// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { showStatus, statusText } from "../src/ui/status";

describe("Monitored by Bridge.ai pill", () => {
  it("says what's watched and what stays private, per mode and site", () => {
    expect(statusText("chatgpt", "parent", false)).toEqual({
      title: "Monitored by Bridge.ai", line: "Privacy protected: your words never leave this computer.",
    });
    expect(statusText("gemini", "child", false)).toEqual({
      title: "Protected by Bridge.ai", line: "Nothing you write leaves this computer. A parent sees only what was held back.",
    });
    expect(statusText("claude", "child", false).line).toBe("Only time is counted here. Messages aren't read.");
    expect(statusText("gemini", "child", true)).toEqual({
      title: "Bridge.ai is paused", line: "Nothing is recorded. Safety checks still run.",
    });
  });

  it("shows open, and updates the same pill when the state changes", () => {
    const root = document.createElement("div").attachShadow({ mode: "open" });
    showStatus(root, statusText("chatgpt", "parent", false), false);
    showStatus(root, statusText("chatgpt", "parent", true), true);
    const pills = root.querySelectorAll(".status");
    expect(pills).toHaveLength(1);
    expect(pills[0].classList.contains("open")).toBe(true);
    expect(pills[0].classList.contains("paused")).toBe(true);
    expect(pills[0].getAttribute("aria-label")).toBe("Bridge.ai is paused. Nothing is recorded. Safety checks still run.");
  });
});
