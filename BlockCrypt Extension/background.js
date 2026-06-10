// BlockCrypt service worker.
//
// All wallet/contract/crypto work happens in the popup (it has direct access to
// chrome.scripting, chrome.tabs and chrome.storage.session). Nothing needs to
// run in the background today, so this worker is intentionally a no-op. Keep the
// file referenced by manifest.json so the extension has a valid background entry.

self.addEventListener("install", () => self.skipWaiting());
