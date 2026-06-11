// BlockCrypt wallet layer for the WEBSITE.
//
// The website runs in the page itself, so it can talk to injected wallets
// directly. We still use EIP-6963 (https://eips.ethereum.org/EIPS/eip-6963) so
// EVERY browser wallet is supported, not just MetaMask, plus a window.ethereum
// fallback for older wallets.
//
// Exposes a global `window.BlockCryptWalletWeb`.

(function (root) {
  const providers = {}; // uuid -> EIP-1193 provider

  function discover() {
    return new Promise((resolve) => {
      const found = {};
      const onAnnounce = (event) => {
        const d = event.detail;
        if (!d || !d.info || !d.provider) return;
        providers[d.info.uuid] = d.provider;
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
        if (Object.keys(found).length === 0 && root.ethereum) {
          providers["injected-legacy"] = root.ethereum;
          found["injected-legacy"] = {
            uuid: "injected-legacy",
            name: root.ethereum.isMetaMask ? "MetaMask" : "Injected Wallet",
            rdns: "legacy.injected",
            icon: "",
          };
        }
        resolve(Object.values(found));
      }, 400);
    });
  }

  function request(uuid, method, params) {
    const provider = providers[uuid];
    if (!provider) return Promise.reject(new Error("Wallet not found"));
    return provider.request({ method, params: params || [] });
  }

  function eip1193(uuid) {
    const provider = providers[uuid];
    return {
      isBlockCryptBridge: true,
      request: ({ method, params }) =>
        provider.request({ method, params: params || [] }),
    };
  }

  // Make sure the wallet is on the given network (a NETWORKS entry from
  // config.js). Switches (or adds) the chain via the standard wallet RPCs.
  async function ensureChain(uuid, net) {
    if (!net || !net.chainIdHex) return;
    const current = await request(uuid, "eth_chainId", []);
    if (String(current).toLowerCase() === net.chainIdHex.toLowerCase()) {
      return;
    }
    try {
      await request(uuid, "wallet_switchEthereumChain", [
        { chainId: net.chainIdHex },
      ]);
    } catch (e) {
      if (e && e.code === 4902 && net.chainParams) {
        await request(uuid, "wallet_addEthereumChain", [net.chainParams]);
      } else {
        throw new Error(
          "Wrong network. Switch your wallet to " +
            (net.chainParams ? net.chainParams.chainName : net.label) +
            " and try again."
        );
      }
    }
  }

  root.BlockCryptWalletWeb = { discover, request, eip1193, ensureChain, providers };
})(typeof window !== "undefined" ? window : globalThis);
