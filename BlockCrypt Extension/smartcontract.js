// BlockCrypt extension — application logic.
//
// Pipeline per page:
//   index.html : connect any wallet (EIP-6963) + master password -> derive
//                AES key (PBKDF2 over password+signature) -> unlock vault.
//   vault.html : single page with save/retrieve modes toggled in place (no
//                navigation). Save re-encrypts the whole vault and writes it
//                on-chain (setVault); retrieve decrypts and reveals it.
//
// Both pages run in the regular browser-action popup. The derived AES key is
// cached in chrome.storage.session (in-memory, wiped when the browser closes)
// so both pages can share it without re-prompting the wallet each time.

(function () {
  const C = window.BlockCryptCrypto;
  const W = window.BlockCryptWallet;
  const CFG = window.BLOCKCRYPT_CONFIG;

  // ---- in-app notices ---------------------------------------------------------
  // All user feedback goes through this toast (nicer than alert() and keeps
  // the popup styling consistent).
  function setToast(message, className, withSpinner) {
    let box = document.getElementById("bcToast");
    if (!box) {
      box = document.createElement("div");
      box.id = "bcToast";
      document.body.appendChild(box);
    }
    box.textContent = "";
    if (withSpinner) {
      const spin = document.createElement("span");
      spin.className = "spin";
      box.appendChild(spin);
    }
    box.appendChild(document.createTextNode(message));
    box.className = className;
    clearTimeout(notify._t);
    return box;
  }

  // Auto-hides after 4s.
  function notify(message, isError) {
    setToast(message, isError ? "error show" : "show", false);
    notify._t = setTimeout(() => {
      const box = document.getElementById("bcToast");
      if (box) box.classList.remove("show");
    }, 4000);
  }

  // Sticky "working…" notice with a spinner. Stays visible until the next
  // notify()/notifyLoading() replaces it (e.g. when the transaction confirms).
  function notifyLoading(message) {
    setToast(message, "show", true);
  }

  // Freeze the whole popup while the chain confirms: a full-window overlay
  // (below the toast) swallows clicks, and the action button is disabled so
  // Enter cannot re-submit either.
  function lockUI() {
    let overlay = document.getElementById("bcLock");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "bcLock";
      document.body.appendChild(overlay);
    }
    const submit = document.getElementById("submit");
    if (submit) submit.classList.add("busy");
    if (document.activeElement && document.activeElement.blur) {
      document.activeElement.blur();
    }
  }

  function unlockUI() {
    const overlay = document.getElementById("bcLock");
    if (overlay) overlay.remove();
    const submit = document.getElementById("submit");
    if (submit) submit.classList.remove("busy");
  }

  // ---- guards ---------------------------------------------------------------
  function assertConfigured(net) {
    if (!net || !net.evm) {
      notify(
        (net ? net.label : "That network") +
          " is not supported yet — BlockCrypt runs on EVM networks " +
          "(Ethereum, Base, …) for now.",
        true
      );
      throw new Error("unsupported network");
    }
    if (!net.contractAddress || /^0x0{40}$/i.test(net.contractAddress)) {
      notify(
        "BlockCrypt is not deployed on " + net.label + " yet: deploy pass.sol " +
          "there and set its address in config.js (see DEPLOY.md).",
        true
      );
      throw new Error("contract address not set for " + net.key);
    }
  }

  // ---- session (shared across popup pages) ----------------------------------
  function getSession() {
    return new Promise((resolve) => {
      chrome.storage.session.get(
        ["providerRdns", "account", "keyHex", "pendingTx", "networkKey"],
        (s) => resolve(s || {})
      );
    });
  }

  function setSession(data) {
    return new Promise((resolve) => chrome.storage.session.set(data, resolve));
  }

  // ---- network preference (persists across browser restarts) ----------------
  function loadNetworkKey() {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.get("networkKey", (r) =>
          resolve(r && r.networkKey && CFG.NETWORKS[r.networkKey] ? r.networkKey : CFG.DEFAULT_NETWORK)
        );
      } catch (e) {
        resolve(CFG.DEFAULT_NETWORK);
      }
    });
  }

  function saveNetworkKey(key) {
    try {
      chrome.storage.local.set({ networkKey: key });
    } catch (e) {
      /* preview / no chrome */
    }
  }

  // ---- active tab host (the stable vault key for a site) --------------------
  function getActiveHost() {
    return new Promise((resolve) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const url = tabs && tabs[0] && tabs[0].url;
        try {
          resolve(url ? new URL(url).hostname : "");
        } catch {
          resolve("");
        }
      });
    });
  }

  // ---- ethers wiring over the wallet bridge ---------------------------------
  function ethersProvider(rdns) {
    const shim = W.eip1193(rdns);
    return new ethers.providers.Web3Provider(shim, "any");
  }

  function readContract(rdns, net) {
    return new ethers.Contract(
      net.contractAddress,
      CFG.CONTRACT_ABI,
      ethersProvider(rdns)
    );
  }

  function writeContract(rdns, net, account) {
    const provider = ethersProvider(rdns);
    return new ethers.Contract(
      net.contractAddress,
      CFG.CONTRACT_ABI,
      provider.getSigner(account)
    );
  }

  // ---- minimal wallet picker (only shown when >1 wallet is installed) -------
  function pickWallet(list) {
    if (list.length === 1) return Promise.resolve(list[0].rdns);
    return new Promise((resolve) => {
      // The overlay is position:fixed, which doesn't grow the document — bump
      // body min-height so the panel iframe resizes to fit it.
      const prevMinHeight = document.body.style.minHeight;
      document.body.style.minHeight = list.length * 46 + 96 + "px";

      const overlay = document.createElement("div");
      overlay.style.cssText =
        "position:fixed;inset:0;background:rgba(0,0,0,.7);display:flex;" +
        "flex-direction:column;align-items:center;justify-content:center;" +
        "gap:8px;z-index:9999;font-family:sans-serif;";
      const title = document.createElement("div");
      title.textContent = "Choose a wallet";
      title.style.cssText = "color:#fff;margin-bottom:8px;";
      overlay.appendChild(title);
      list.forEach((w) => {
        const btn = document.createElement("button");
        btn.textContent = w.name || w.rdns || w.uuid;
        btn.style.cssText =
          "padding:8px 16px;min-width:180px;cursor:pointer;border:none;" +
          "border-radius:4px;background:#376871;color:#fff;font-size:14px;";
        btn.onclick = () => {
          document.body.removeChild(overlay);
          document.body.style.minHeight = prevMinHeight;
          resolve(w.rdns);
        };
        overlay.appendChild(btn);
      });
      document.body.appendChild(overlay);
    });
  }

  async function connectWallet(net) {
    const wallets = await W.discover();
    if (!wallets.length) {
      throw new Error(
        "No wallet detected on this page. Install a wallet (MetaMask, Coinbase, " +
          "Rabby, …) and open a normal website tab."
      );
    }
    const rdns = await pickWallet(wallets);
    const accounts = await W.request(rdns, "eth_requestAccounts", []);
    if (!accounts || !accounts.length) throw new Error("No account authorized");
    await W.ensureChain(rdns, net); // switch to the chosen network
    return { rdns, account: accounts[0] };
  }

  function shortAddr(a) {
    return a && a.length > 12 ? a.slice(0, 7) + "…" + a.slice(-4) : a;
  }

  // =====================================================================
  //  index.html — connect + unlock
  // =====================================================================
  if (location.href.includes("index.html") || location.pathname.endsWith("/")) {
    const connectBtn = document.getElementById("connectBtn");
    const accessBtn = document.getElementById("access");
    const masterInput = document.getElementById("inputText");
    const userLabel = document.getElementById("user");
    const userBox = document.getElementById("userbox");

    let session = { rdns: null, account: null };

    // ---- network selector pills ----
    const netRow = document.getElementById("netRow");
    let networkKey = CFG.DEFAULT_NETWORK;

    function paintNets() {
      if (!netRow) return;
      netRow.querySelectorAll(".bc-net").forEach((el) => {
        el.classList.toggle("selected", el.dataset.net === networkKey);
      });
    }

    loadNetworkKey().then((key) => {
      networkKey = key;
      paintNets();
    });

    if (netRow) {
      netRow.addEventListener("click", (e) => {
        const el = e.target.closest(".bc-net");
        if (!el) return;
        const net = CFG.NETWORKS[el.dataset.net];
        if (!net || !net.evm) {
          notify(
            "Solana support is coming soon — BlockCrypt runs on EVM networks " +
              "(Ethereum, Base, …) for now.",
            true
          );
          return;
        }
        networkKey = el.dataset.net;
        saveNetworkKey(networkKey);
        paintNets();
      });
    }

    // Swap the connect chip for the Welcome + address box (top-right).
    function showConnected(account) {
      if (userLabel) userLabel.textContent = shortAddr(account);
      if (userBox) userBox.style.display = "flex";
      if (connectBtn) connectBtn.style.display = "none";
    }

    async function restore() {
      const s = await getSession();
      if (s.account && s.providerRdns) {
        session = { rdns: s.providerRdns, account: s.account };
        showConnected(s.account);
      }
    }
    restore();

    if (connectBtn) {
      connectBtn.addEventListener("click", async () => {
        try {
          const net = CFG.getNetwork(networkKey);
          assertConfigured(net);
          const { rdns, account } = await connectWallet(net);
          session = { rdns, account };
          await setSession({ providerRdns: rdns, account });
          showConnected(account);
        } catch (e) {
          notify(e.message, true);
        }
      });
    }

    async function unlock() {
      try {
        const net = CFG.getNetwork(networkKey);
        assertConfigured(net);
        if (!session.account) {
          notify("Connect your wallet first.", true);
          return;
        }
        const master = masterInput.value;
        if (!master) {
          notify("Enter your master password.", true);
          return;
        }

        // Authorize this site's origin (required to sign). No-ops if already
        // connected; prompts the wallet the first time on a new website.
        const accts = await W.request(session.rdns, "eth_requestAccounts", []);
        if (accts && accts.length) session.account = accts[0];

        await W.ensureChain(session.rdns, net); // switch to the chosen network
        const provider = ethersProvider(session.rdns);
        const contract = new ethers.Contract(
          net.contractAddress,
          CFG.CONTRACT_ABI,
          provider
        );
        const registered = await contract.isRegistered(session.account);
        if (!registered) {
          notify(
            "This wallet has no vault on " + net.label + ". Create one on the " +
              "BlockCrypt website (or pick the network where you registered).",
            true
          );
          return;
        }

        const [saltHex, cipherHex] = await contract.getVaultOf(session.account);
        // personal_sign directly (ethers 5.2 signMessage wrongly uses eth_sign,
        // which modern wallets reject). Hex-encode for cross-wallet consistency.
        const msgHex = ethers.utils.hexlify(
          ethers.utils.toUtf8Bytes(CFG.KEY_DERIVATION_MESSAGE)
        );
        const signature = await W.request(session.rdns, "personal_sign", [
          msgHex,
          session.account,
        ]);

        const key = await C.deriveKey(master, signature, C.hexToBytes(saltHex));

        // Decrypt the vault (this also verifies the master password) and decide
        // which mode to open: retrieve if this site already has a saved
        // password, otherwise save.
        let hasEntryForSite = false;
        if (cipherHex && cipherHex !== "0x") {
          const plain = await C.decryptFromHex(key, cipherHex); // throws if wrong
          const vault = C.parseVault(plain);
          const host = await getActiveHost();
          hasEntryForSite = !!(host && vault.entries[host]);
        }

        const keyHex = await C.exportRawKeyHex(key);
        await setSession({
          providerRdns: session.rdns,
          account: session.account,
          keyHex,
          networkKey, // the vault page works on this same network
        });
        location.href = "vault.html#" + (hasEntryForSite ? "retrieve" : "save");
      } catch (e) {
        notify(e.message || "Unlock failed", true);
        console.error(e);
      }
    }

    if (accessBtn) accessBtn.addEventListener("click", unlock);
    if (masterInput) {
      masterInput.addEventListener("keypress", (ev) => {
        if (ev.key === "Enter") unlock();
      });
    }
  }

  // =====================================================================
  //  shared loader for the vault page
  // =====================================================================
  async function loadVaultContext() {
    const s = await getSession();
    if (!s.account || !s.keyHex || !s.providerRdns) {
      notify("Vault locked. Unlock first.", true);
      location.href = "index.html";
      throw new Error("locked");
    }
    const net = CFG.getNetwork(s.networkKey);
    assertConfigured(net);
    await W.ensureChain(s.providerRdns, net); // reads/writes must hit that chain
    const key = await C.importRawKeyHex(s.keyHex);
    const host = await getActiveHost();
    return { ...s, key, host, net };
  }

  async function readVault(ctx) {
    const contract = readContract(ctx.providerRdns, ctx.net);
    const [, cipherHex] = await contract.getVaultOf(ctx.account);
    if (!cipherHex || cipherHex === "0x") return C.emptyVault();
    const plain = await C.decryptFromHex(ctx.key, cipherHex);
    return C.parseVault(plain);
  }

  // Cache the vault for the page so toggling modes never re-fetches/decrypts.
  let _vaultCache = null;
  async function getVaultCached(ctx) {
    if (!_vaultCache) _vaultCache = await readVault(ctx);
    return _vaultCache;
  }

  // =====================================================================
  //  vault.html — ONE page; save/retrieve are toggled in place with no
  //  navigation or reload (the old two-HTML + barba reload caused the flash).
  // =====================================================================
  if (location.href.includes("vault.html")) {
    const textLabel = document.getElementById("text");
    const websiteEl = document.getElementById("website");
    const switchBtn = document.getElementById("switchBtn");
    const saveRow = document.getElementById("saveRow");
    const retrieveRow = document.getElementById("retrieveRow");
    const saveInput = document.getElementById("inputText1");
    const submitBtn = document.getElementById("submit");
    const retrieveInput = document.getElementById("inputText");
    const showBtn = document.getElementById("show");

    let storedPassword = "";
    let entryLoaded = false;
    let mode = location.hash === "#retrieve" ? "retrieve" : "save";

    // Save/change flow is a small state machine on ONE input:
    //   "old"  -> verify the current password (only when changing)
    //   "new1" -> type the new password
    //   "new2" -> retype it to confirm, then write on-chain
    let saveStep = "new1";
    let pendingPassword = "";

    // Resolve the unlocked context once and reuse it across toggles.
    let _ctxPromise = null;
    const context = () => (_ctxPromise = _ctxPromise || loadVaultContext());

    (async () => {
      try {
        const ctx = await context();
        if (websiteEl) websiteEl.textContent = ctx.host || "";
      } catch (e) {
        /* locked -> loadVaultContext already redirected */
      }
    })();

    // If a save was in flight when the popup last closed, pick the wait back
    // up: same frozen UI + "Saving on-chain…" notice until the tx confirms.
    (async () => {
      try {
        const s = await getSession();
        if (!s.pendingTx || !s.pendingTx.hash || !s.providerRdns) return;
        lockUI();
        notifyLoading("Saving on-chain…");
        // The receipt must be looked up on the network the tx was sent to.
        await W.ensureChain(s.providerRdns, CFG.getNetwork(s.networkKey));
        const provider = ethersProvider(s.providerRdns);
        await provider.waitForTransaction(s.pendingTx.hash);
        await setSession({ pendingTx: null });
        // The chain changed under us: drop stale caches and re-read.
        _vaultCache = null;
        entryLoaded = false;
        unlockUI();
        notify("Password saved on-chain for " + s.pendingTx.host);
        setMode("retrieve");
      } catch (e) {
        await setSession({ pendingTx: null });
        unlockUI();
        notify("Error confirming the pending save: " + (e.message || e), true);
        console.error(e);
      }
    })();

    // Load (once) the password stored for this site into storedPassword.
    async function ensureEntry() {
      if (entryLoaded) return;
      const ctx = await context();
      const vault = await getVaultCached(ctx);
      storedPassword = vault.entries[ctx.host] || "";
      entryLoaded = true;
    }

    async function loadRetrieve() {
      try {
        await ensureEntry();
        retrieveInput.type = "password";
        if (showBtn) showBtn.textContent = "Show";
        if (storedPassword) {
          retrieveInput.value = storedPassword;
          retrieveInput.placeholder = "";
        } else {
          retrieveInput.value = "";
          retrieveInput.placeholder = "No saved password for this site";
        }
        // Now that we know whether an entry exists, fix the switch label.
        if (mode === "retrieve") {
          switchBtn.textContent = storedPassword ? "Change" : "Save";
        }
      } catch (e) {
        if (e.message !== "locked") console.error(e);
      }
    }

    // Configure the save row for either "register new" or "change existing".
    async function configureSave() {
      pendingPassword = "";
      saveInput.value = "";
      saveInput.placeholder = "Loading…";
      try {
        await ensureEntry();
      } catch (e) {
        return; // locked -> already redirected
      }
      if (mode !== "save") return; // user toggled away while loading
      if (storedPassword) {
        textLabel.textContent = "Change password for";
        submitBtn.textContent = "Change";
        saveStep = "old";
        saveInput.placeholder = "Current password…";
      } else {
        textLabel.textContent = "Save password for";
        submitBtn.textContent = "Save";
        saveStep = "new1";
        saveInput.placeholder = "Save new password…";
      }
      saveInput.focus();
    }

    function setMode(next) {
      mode = next;
      if (next === "retrieve") {
        textLabel.textContent = "Password for";
        switchBtn.textContent = storedPassword ? "Change" : "Save";
        saveRow.classList.add("hidden");
        retrieveRow.classList.remove("hidden");
        loadRetrieve();
      } else {
        switchBtn.textContent = "Retrieve";
        retrieveRow.classList.add("hidden");
        saveRow.classList.remove("hidden");
        configureSave();
      }
    }

    if (switchBtn) {
      switchBtn.addEventListener("click", () =>
        setMode(mode === "save" ? "retrieve" : "save")
      );
    }

    if (showBtn && retrieveInput) {
      showBtn.addEventListener("click", () => {
        if (!storedPassword) return;
        const hidden = retrieveInput.type === "password";
        retrieveInput.type = hidden ? "text" : "password";
        showBtn.textContent = hidden ? "Hide" : "Show";
      });
    }

    // Write pendingPassword on-chain; revert the cache if the tx fails.
    async function commitPassword() {
      const ctx = await context();
      if (!ctx.host) {
        notify("Could not read the current site.", true);
        return;
      }
      const vault = await getVaultCached(ctx);
      const previous = vault.entries[ctx.host];
      vault.entries[ctx.host] = pendingPassword;
      try {
        const cipherHex = await C.encryptToHex(
          ctx.key,
          C.serializeVault(vault)
        );
        const contract = writeContract(ctx.providerRdns, ctx.net, ctx.account);
        notifyLoading("Confirm the transaction in your wallet…");
        const tx = await contract.setVault(cipherHex);
        // Tx sent: freeze the popup until the chain confirms, and remember the
        // tx so a reopened popup resumes this same wait (the browser closes
        // popups on focus loss — that part cannot be prevented).
        lockUI();
        notifyLoading("Saving on-chain…");
        await setSession({ pendingTx: { hash: tx.hash, host: ctx.host } });
        await tx.wait();
        await setSession({ pendingTx: null });
        unlockUI();
        storedPassword = pendingPassword;
        pendingPassword = "";
        notify("Password saved on-chain for " + ctx.host);
        setMode("retrieve");
      } catch (e) {
        unlockUI();
        setSession({ pendingTx: null });
        // Keep the cache consistent with the chain.
        if (previous === undefined) delete vault.entries[ctx.host];
        else vault.entries[ctx.host] = previous;
        throw e;
      }
    }

    if (submitBtn) {
      submitBtn.addEventListener("click", async () => {
        if (submitBtn.classList.contains("busy")) return; // tx in flight
        try {
          const value = saveInput.value;

          if (saveStep === "old") {
            if (!value) {
              notify("Enter your current password.", true);
              return;
            }
            await ensureEntry();
            if (value !== storedPassword) {
              notify("Wrong current password.", true);
              saveInput.value = "";
              return;
            }
            saveStep = "new1";
            saveInput.value = "";
            saveInput.placeholder = "New password…";
            saveInput.focus();
            return;
          }

          if (saveStep === "new1") {
            if (!value) {
              notify("Enter a password to save.", true);
              return;
            }
            pendingPassword = value;
            saveStep = "new2";
            saveInput.value = "";
            saveInput.placeholder = "Confirm new password…";
            saveInput.focus();
            return;
          }

          // saveStep === "new2": confirm and commit.
          if (value !== pendingPassword) {
            notify("Passwords don't match. Try again.", true);
            pendingPassword = "";
            saveStep = "new1";
            saveInput.value = "";
            saveInput.placeholder = "New password…";
            saveInput.focus();
            return;
          }
          submitBtn.classList.add("busy");
          try {
            await commitPassword();
          } finally {
            submitBtn.classList.remove("busy");
          }
        } catch (e) {
          if (e.message === "locked") return;
          notify("Error saving password: " + (e.message || e), true);
          console.error(e);
        }
      });
    }

    // Enter in the save input behaves like clicking the action button.
    if (saveInput && submitBtn) {
      saveInput.addEventListener("keypress", (ev) => {
        if (ev.key === "Enter") submitBtn.click();
      });
    }

    setMode(mode);
  }
})();
