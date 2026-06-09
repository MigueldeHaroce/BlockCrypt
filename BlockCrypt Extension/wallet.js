// BlockCrypt wallet layer for the EXTENSION POPUP.
//
// A popup runs in its own page; it cannot see the website's injected
// `window.ethereum`. To support EVERY browser wallet (not just MetaMask) we
// inject code into the active tab's MAIN world via chrome.scripting and talk to
// whatever wallet(s) the user has, discovered with EIP-6963
// (https://eips.ethereum.org/EIPS/eip-6963). The selected provider is then
// exposed to ethers.js through a thin EIP-1193 shim.
//
// Requirement: the active tab must be a normal http(s) page (where wallets
// inject). That's exactly where you use a password manager anyway.
//
// Exposes a global `window.BlockCryptWallet`.

(function (root) {
  // ---- functions injected into the page's MAIN world -------------------------
  // These run in the website context (not the popup). They are serialized by
  // chrome.scripting, so they may only use their `args` and page globals.

  // Discover EIP-6963 providers, cache them on window.__blockcrypt, return info.
  function pageDiscover() {
    return new Promise((resolve) => {
      const store = (window.__blockcrypt = window.__blockcrypt || { providers: {} });
      const found = {};
      const onAnnounce = (event) => {
        const d = event.detail;
        if (!d || !d.info || !d.provider) return;
        store.providers[d.info.uuid] = d.provider;
        found[d.info.uuid] = {
          uuid: d.info.uuid,
          name: d.info.name,
          rdns: d.info.rdns,
          icon: d.info.icon,
        };
      };
      window.addEventListener("eip6963:announceProvider", onAnnounce);
      window.dispatchEvent(new Event("eip6963:requestProvider"));
      setTimeout(() => {
        window.removeEventListener("eip6963:announceProvider", onAnnounce);
        // Fallback for wallets that only expose the legacy injected provider.
        if (Object.keys(found).length === 0 && window.ethereum) {
          store.providers["injected-legacy"] = window.ethereum;
          found["injected-legacy"] = {
            uuid: "injected-legacy",
            name: window.ethereum.isMetaMask ? "MetaMask" : "Injected Wallet",
            rdns: "legacy.injected",
            icon: "",
          };
        }
        resolve(Object.values(found));
      }, 400);
    });
  }

  // Forward a single EIP-1193 request to the chosen provider.
  function pageRequest(args) {
    const { uuid, method, params } = args;
    async function getProvider() {
      const store = (window.__blockcrypt = window.__blockcrypt || { providers: {} });
      if (store.providers[uuid]) return store.providers[uuid];
      // Provider cache lost (e.g. page navigated) — re-discover quickly.
      await new Promise((res) => {
        const onAnnounce = (event) => {
          const d = event.detail;
          if (d && d.info && d.provider) store.providers[d.info.uuid] = d.provider;
        };
        window.addEventListener("eip6963:announceProvider", onAnnounce);
        window.dispatchEvent(new Event("eip6963:requestProvider"));
        setTimeout(() => {
          window.removeEventListener("eip6963:announceProvider", onAnnounce);
          if (!store.providers["injected-legacy"] && window.ethereum) {
            store.providers["injected-legacy"] = window.ethereum;
          }
          res();
        }, 400);
      });
      return store.providers[uuid];
    }

    return getProvider().then(async (provider) => {
      if (!provider) {
        return { ok: false, error: { code: -1, message: "Wallet not found in page" } };
      }
      try {
        const result = await provider.request({ method, params: params || [] });
        return { ok: true, result };
      } catch (err) {
        return {
          ok: false,
          error: {
            code: (err && err.code) || -1,
            message: (err && err.message) || String(err),
          },
        };
      }
    });
  }

  // ---- popup-side API --------------------------------------------------------
  async function getActiveTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) throw new Error("No active tab");
    if (!/^https?:/i.test(tab.url || "")) {
      throw new Error(
        "Open a normal website tab (http/https) to connect your wallet."
      );
    }
    return tab;
  }

  async function inject(func, arg) {
    const tab = await getActiveTab();
    const [res] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: "MAIN",
      func,
      args: arg === undefined ? [] : [arg],
    });
    return res ? res.result : undefined;
  }

  // List installed wallets in the active tab.
  async function discover() {
    return (await inject(pageDiscover)) || [];
  }

  // Raw EIP-1193 request via the chosen wallet. Throws on wallet errors.
  async function request(uuid, method, params) {
    const res = await inject(pageRequest, { uuid, method, params });
    if (!res) throw new Error("No response from page");
    if (!res.ok) {
      const e = new Error(res.error.message);
      e.code = res.error.code;
      throw e;
    }
    return res.result;
  }

  // An EIP-1193 object ethers.js can consume (new ethers.providers.Web3Provider).
  // ethers v5 detects and uses `.request` when present, routing every RPC call
  // through our page bridge to the user's wallet.
  function eip1193(uuid) {
    return {
      isBlockCryptBridge: true,
      request: ({ method, params }) => request(uuid, method, params),
    };
  }

  // Make sure the wallet is on the network where the contract lives. Switches
  // (or adds) the chain via the standard wallet RPCs if needed.
  async function ensureChain(uuid) {
    const cfg = root.BLOCKCRYPT_CONFIG;
    if (!cfg || !cfg.EXPECTED_CHAIN_ID_HEX) return;
    const current = await request(uuid, "eth_chainId", []);
    if (
      String(current).toLowerCase() === cfg.EXPECTED_CHAIN_ID_HEX.toLowerCase()
    ) {
      return;
    }
    try {
      await request(uuid, "wallet_switchEthereumChain", [
        { chainId: cfg.EXPECTED_CHAIN_ID_HEX },
      ]);
    } catch (e) {
      if (e && e.code === 4902 && cfg.CHAIN_PARAMS) {
        await request(uuid, "wallet_addEthereumChain", [cfg.CHAIN_PARAMS]);
      } else {
        throw new Error(
          "Wrong network. Switch your wallet to " +
            (cfg.CHAIN_PARAMS ? cfg.CHAIN_PARAMS.chainName : "the right network") +
            " and try again."
        );
      }
    }
  }

  root.BlockCryptWallet = { discover, request, eip1193, ensureChain };
})(typeof window !== "undefined" ? window : globalThis);
