// BlockCrypt service worker.
//
// There is NO browser-action popup: native popups cannot float, be dragged, or
// survive a click outside (the browser force-closes them). Instead, clicking
// the toolbar icon toggles a FLOATING PANEL injected into the current page: an
// <iframe> that loads the regular extension pages (index.html / vault.html), so
// the app keeps full extension privileges while the user can drag it around
// and it stays open until explicitly closed (✕ or clicking the icon again).

// Injected into the page (isolated world). Must be self-contained: it can only
// use its arguments and page globals — chrome.scripting serializes it.
function togglePanel(panelUrl) {
  const HOST_ID = "__blockcrypt_panel_host";
  const existing = document.getElementById(HOST_ID);
  if (existing) {
    existing.remove();
    return "closed";
  }

  const WIDTH = 420;

  const host = document.createElement("div");
  host.id = HOST_ID;
  host.style.cssText =
    "position:fixed;top:16px;right:16px;width:" +
    WIDTH +
    "px;z-index:2147483647;";

  // Closed shadow root so the page's CSS cannot restyle the panel.
  const shadow = host.attachShadow({ mode: "closed" });

  const style = document.createElement("style");
  style.textContent = [
    ".panel{border:1px solid #37687188;border-radius:2px;overflow:hidden;",
    "box-shadow:0 10px 30px rgba(0,0,0,.55);background:#101010;}",
    ".bar{height:30px;display:flex;align-items:center;justify-content:space-between;",
    "background:#1a1a1a;border-bottom:1px solid #37687188;cursor:grab;",
    "user-select:none;padding:0 10px;color:#f0f1e2;font-size:12px;",
    "font-family:sans-serif;letter-spacing:.5px;}",
    ".bar:active{cursor:grabbing;}",
    ".title{display:flex;align-items:center;gap:8px;}",
    ".dot{width:8px;height:8px;border-radius:50%;background:#376871;}",
    ".close{cursor:pointer;border:none;background:none;color:#686868;",
    "font-size:14px;line-height:1;padding:2px 5px;font-family:sans-serif;}",
    ".close:hover{color:#f0f1e2;}",
    "iframe{display:block;width:100%;height:200px;border:0;background:#101010;}",
  ].join("");

  const panel = document.createElement("div");
  panel.className = "panel";

  const bar = document.createElement("div");
  bar.className = "bar";
  const title = document.createElement("span");
  title.className = "title";
  const dot = document.createElement("span");
  dot.className = "dot";
  title.appendChild(dot);
  title.appendChild(document.createTextNode("BlockCrypt"));
  const closeBtn = document.createElement("button");
  closeBtn.className = "close";
  closeBtn.textContent = "✕";
  closeBtn.title = "Close";
  closeBtn.addEventListener("click", () => host.remove());
  bar.appendChild(title);
  bar.appendChild(closeBtn);

  const iframe = document.createElement("iframe");
  iframe.src = panelUrl;

  panel.appendChild(bar);
  panel.appendChild(iframe);
  shadow.appendChild(style);
  shadow.appendChild(panel);
  (document.body || document.documentElement).appendChild(host);

  // ---- dragging (pointer capture on the bar) ----
  let dragging = false;
  let offX = 0;
  let offY = 0;
  bar.addEventListener("pointerdown", (e) => {
    if (e.target === closeBtn) return;
    dragging = true;
    const r = host.getBoundingClientRect();
    offX = e.clientX - r.left;
    offY = e.clientY - r.top;
    bar.setPointerCapture(e.pointerId);
    // While dragging, keep the iframe from swallowing pointer events.
    iframe.style.pointerEvents = "none";
  });
  bar.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const w = host.offsetWidth;
    const h = host.offsetHeight;
    const x = Math.min(Math.max(0, e.clientX - offX), Math.max(0, innerWidth - w));
    const y = Math.min(Math.max(0, e.clientY - offY), Math.max(0, innerHeight - h));
    host.style.left = x + "px";
    host.style.top = y + "px";
    host.style.right = "auto";
  });
  const endDrag = () => {
    dragging = false;
    iframe.style.pointerEvents = "";
  };
  bar.addEventListener("pointerup", endDrag);
  bar.addEventListener("pointercancel", endDrag);

  // ---- auto-resize: the extension pages post their height (panel.js) ----
  window.__blockcrypt_panel_iframe = iframe;
  if (!window.__blockcrypt_resize_hook) {
    window.__blockcrypt_resize_hook = true;
    window.addEventListener("message", (e) => {
      const f = window.__blockcrypt_panel_iframe;
      if (!f || !e.data || e.data.type !== "__blockcrypt_resize") return;
      if (e.source !== f.contentWindow) return;
      const h = Math.max(120, Math.min(640, Number(e.data.height) || 0));
      if (h) f.style.height = h + "px";
    });
  }

  return "opened";
}

chrome.action.onClicked.addListener(async (tab) => {
  // Wallets (and our bridge) only exist on normal web pages.
  if (!tab || !tab.id || !/^https?:/i.test(tab.url || "")) return;
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: togglePanel,
      args: [chrome.runtime.getURL("index.html")],
    });
  } catch (e) {
    // Pages where injection is blocked (Chrome Web Store, etc.) — ignore.
  }
});
