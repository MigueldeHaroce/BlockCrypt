// Floating-panel glue. When a page runs embedded in the floating panel's
// iframe (instead of as a top-level page), it posts its content height to the
// host page so the iframe can match it exactly. No-ops when not embedded.
(function () {
  if (window === window.top) return;

  let last = 0;
  function post() {
    const h = Math.ceil(document.documentElement.scrollHeight);
    if (!h || h === last) return;
    last = h;
    parent.postMessage({ type: "__blockcrypt_resize", height: h }, "*");
  }

  document.addEventListener("DOMContentLoaded", post);
  window.addEventListener("load", post);
  new ResizeObserver(post).observe(document.documentElement);
})();
