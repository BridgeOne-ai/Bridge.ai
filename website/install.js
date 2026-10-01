// "Installing Bridge.ai" guide. Chrome doesn't let any website install an extension (only the Chrome Web
// Store can), so a Download link starts the zip download and this walks through the rest, step by step.
// Used by every link with data-install. No network requests, no storage, no tracking.
(() => {
  const STEPS = [
    {
      title: "Downloading Bridge.ai",
      body: "Your download has started: <b>bridge-ai-extension.zip</b>. If it didn't, <a data-again href=\"#\">download it again</a>.",
      auto: true,
    },
    {
      title: "Unzip it",
      body: "Open your <b>Downloads</b> folder and double-click <b>bridge-ai-extension.zip</b>. Move the <b>bridge-ai</b> folder it makes to <b>Documents</b> and keep it there: Chrome runs Bridge.ai from that folder.",
    },
    {
      title: "Open Chrome's extensions page",
      body: "Websites can't open this page for you. Copy the address, paste it into a new tab, and press Enter.<div class=\"bi-copy\"><code>chrome://extensions</code><button type=\"button\" data-copy>Copy</button></div>",
    },
    {
      title: "Turn on Developer mode",
      body: "Switch on <b>Developer mode</b> in the top-right corner of that page. Chrome asks for this for any extension that isn't from the Chrome Web Store.",
    },
    {
      title: "Load Bridge.ai",
      body: "Click <b>Load unpacked</b> and choose the <b>bridge-ai</b> folder in Documents. Bridge.ai appears in the list.",
    },
    {
      title: "Finish setup",
      body: "Bridge.ai's setup page opens by itself. Read what it reads and keeps, choose Parent or Child mode, and agree. Then pin it from the puzzle-piece menu in Chrome's toolbar.",
    },
  ];

  const CSS = `
    .bi { --bg:#fff; --text:#1a1a1a; --muted:#5c5c5c; --line:#e6e6e6; --soft:#f5f5f5; --accent:#3b3bd1; --on:#fff; --ok:#1a1a1a; --warn:#7a4d00; --warn-bg:#f5f5f5;
      border:1px solid var(--line); padding:0; border-radius:12px; width:min(560px, calc(100vw - 24px)); max-height:calc(100dvh - 24px);
      background:var(--bg); color:var(--text); box-shadow:0 12px 40px rgba(0,0,0,.18); font:15px/1.55 system-ui,-apple-system,"Segoe UI",sans-serif; }
    .bi::backdrop { background:rgba(0,0,0,.45); }
    .bi-head { display:flex; align-items:center; gap:12px; padding:22px 24px 0; }
    .bi-head h2 { margin:0; font-size:20px; flex:1; }
    .bi-x { border:0; background:none; color:var(--muted); font-size:24px; line-height:1; cursor:pointer; padding:4px 8px; border-radius:8px; }
    .bi-x:hover { background:var(--soft); }
    .bi-bar { display:none; margin:16px 24px 6px; height:6px; border-radius:3px; background:var(--soft); overflow:hidden; }
    .bi-bar i { display:block; height:100%; width:0; background:var(--accent); border-radius:3px; transition:width .35s ease; }
    .bi-count { margin:6px 24px 0; font-size:13px; color:var(--muted); }
    .bi-note { margin:14px 24px 0; padding:10px 14px; border-radius:10px; background:var(--warn-bg); color:var(--warn); font-size:14px; }
    .bi ol { list-style:none; margin:14px 0 0; padding:0 24px; overflow:auto; max-height:calc(100dvh - 260px); }
    .bi li { display:grid; grid-template-columns:28px 1fr; gap:12px; padding:12px 0; border-top:1px solid var(--line); }
    .bi li:first-child { border-top:0; }
    .bi-dot { width:28px; height:28px; border-radius:50%; display:grid; place-items:center; font-size:13px; font-weight:700;
      border:2px solid var(--line); color:var(--muted); box-sizing:border-box; }
    .bi li h3 { margin:3px 0 0; font-size:15.5px; color:var(--muted); font-weight:600; }
    .bi li .bi-body { display:none; color:var(--muted); margin-top:6px; }
    .bi li.now .bi-dot { border-color:var(--accent); color:var(--accent); }
    .bi li.now h3 { color:var(--text); }
    .bi li.now .bi-body { display:block; }
    .bi li.done .bi-dot { border-color:var(--ok); background:var(--ok); color:var(--bg); }
    .bi li.done h3 { color:var(--text); }
    .bi-body b { color:var(--text); }
    .bi-body a { color:var(--accent); }
    .bi-copy { display:flex; align-items:center; gap:8px; margin-top:10px; }
    .bi-copy code { flex:1; padding:8px 12px; border-radius:8px; background:var(--soft); border:1px solid var(--line); font:14px ui-monospace,Menlo,Consolas,monospace; color:var(--text); }
    .bi-copy button, .bi-next { border:0; border-radius:8px; padding:8px 16px; font:600 14px system-ui,-apple-system,sans-serif; cursor:pointer; background:var(--accent); color:var(--on); }
    .bi-next { margin-top:12px; }
    .bi-spin { display:inline-block; width:12px; height:12px; border:2px solid var(--line); border-top-color:var(--accent); border-radius:50%; animation:bi-spin .8s linear infinite; vertical-align:-1px; margin-right:6px; }
    @keyframes bi-spin { to { transform:rotate(360deg); } }
    @media (prefers-reduced-motion: reduce) { .bi-bar i { transition:none; } .bi-spin { animation:none; } }
    .bi-done { padding:18px 24px 24px; text-align:center; display:none; }
    .bi-done.show { display:block; }
    .bi-done b { display:block; font-size:18px; margin-bottom:4px; }
    .bi-done p { margin:0 0 14px; color:var(--muted); }
    .bi-foot { padding:14px 24px 22px; }
  `;

  // Chrome on a computer is the only place it runs.
  const ua = navigator.userAgent;
  const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
  const chromium = /Chrome\//.test(ua) && !/Firefox|FxiOS/.test(ua);
  const note = mobile
    ? "Bridge.ai needs Chrome on a computer. You can download it here, but install it on a Windows, Mac or Linux computer."
    : !chromium ? "Bridge.ai needs Google Chrome. Open this page in Chrome to install it." : "";

  let dialog, step = 0, href = "";

  function build() {
    const style = document.createElement("style");
    style.textContent = CSS;
    document.head.append(style);
    dialog = document.createElement("dialog");
    dialog.className = "bi";
    dialog.setAttribute("aria-labelledby", "bi-title");
    dialog.innerHTML = `
      <div class="bi-head"><h2 id="bi-title">Installing Bridge.ai</h2><button class="bi-x" type="button" aria-label="Close">×</button></div>
      <div class="bi-bar" aria-hidden="true"><i></i></div>
      <p class="bi-count" aria-live="polite"></p>
      ${note ? `<p class="bi-note">${note}</p>` : ""}
      <ol>${STEPS.map((s, i) => `<li><span class="bi-dot">${i + 1}</span><div><h3>${s.title}</h3><div class="bi-body">${s.body}${
        s.auto ? "" : `<div><button class="bi-next" type="button">${i === STEPS.length - 1 ? "All done" : "Done, next step"}</button></div>`
      }</div></div></li>`).join("")}</ol>
      <div class="bi-done"><b>Bridge.ai is installed</b><p>Finish setup in the Bridge.ai page that opened, then open ChatGPT or Gemini.</p><button class="bi-next" type="button" data-close>Close</button></div>`;
    document.body.append(dialog);
    dialog.querySelector(".bi-x").addEventListener("click", () => dialog.close());
    dialog.querySelector("[data-close]").addEventListener("click", () => dialog.close());
    dialog.addEventListener("click", (e) => { if (e.target === dialog) dialog.close(); }); // click outside
    dialog.querySelectorAll("li .bi-next").forEach((b) => b.addEventListener("click", () => go(step + 1)));
    dialog.querySelector("[data-again]").addEventListener("click", (e) => { e.preventDefault(); download(); });
    const copy = dialog.querySelector("[data-copy]");
    copy.addEventListener("click", async () => {
      try { await navigator.clipboard.writeText("chrome://extensions"); copy.textContent = "Copied ✓"; }
      catch { copy.textContent = "Select and copy it"; }
      setTimeout(() => (copy.textContent = "Copy"), 2500);
    });
  }

  function go(n) {
    step = n;
    const items = dialog.querySelectorAll("li");
    items.forEach((li, i) => {
      li.classList.toggle("done", i < n);
      li.classList.toggle("now", i === n);
      li.querySelector(".bi-dot").textContent = i < n ? "✓" : String(i + 1);
    });
    const finished = n >= STEPS.length;
    dialog.querySelector(".bi-done").classList.toggle("show", finished);
    dialog.querySelector(".bi-bar i").style.width = `${Math.min(n, STEPS.length) / STEPS.length * 100}%`;
    dialog.querySelector(".bi-count").textContent = finished ? "All steps done" : `Step ${n + 1} of ${STEPS.length}`;
    items[n]?.querySelector(".bi-next")?.focus({ preventScroll: true });
    items[n]?.scrollIntoView({ block: "nearest" });
  }

  function download() {
    const a = document.createElement("a");
    a.href = href;
    a.download = "bridge-ai-extension.zip";
    document.body.append(a);
    a.click();
    a.remove();
  }

  function start(e) {
    e.preventDefault();
    href = e.currentTarget.href;
    if (!dialog) build();
    download();
    dialog.showModal();
    go(0);
    // Step 1 shows a spinner briefly, then counts as done: the browser has the download from here.
    const h3 = dialog.querySelector("li h3");
    h3.innerHTML = `<span class="bi-spin" aria-hidden="true"></span>${STEPS[0].title}`;
    setTimeout(() => { h3.textContent = "Downloaded"; go(1); }, 1600);
  }

  document.querySelectorAll("a[data-install]").forEach((a) => a.addEventListener("click", start));
})();
