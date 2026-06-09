// BlockCrypt extension — application logic.
//
// Pipeline per page:
//   index.html : connect any wallet (EIP-6963) + master password -> derive
//                AES key (PBKDF2 over password+signature) -> unlock vault.
//   vault.html : single page with save/retrieve modes toggled in place (no
//                navigation). Save re-encrypts the whole vault and writes it
//                on-chain (setVault); retrieve decrypts and reveals it.
//
// The derived AES key is cached for the popup session in chrome.storage.session
// (in-memory, wiped when the browser closes) so both pages can share it without
// re-prompting the wallet each time.

(function () {
  const C = window.BlockCryptCrypto;
  const W = window.BlockCryptWallet;
  const CFG = window.BLOCKCRYPT_CONFIG;

  // ---- guards ---------------------------------------------------------------
  function assertConfigured() {
    if (
      !CFG.CONTRACT_ADDRESS ||
      /^0x0{40}$/i.test(CFG.CONTRACT_ADDRESS)
    ) {
      alert(
        "BlockCrypt is not configured yet: deploy pass.sol and set " +
          "CONTRACT_ADDRESS in config.js (see DEPLOY.md)."
      );
      throw new Error("CONTRACT_ADDRESS not set");
    }
  }

  // ---- session (shared across popup pages) ----------------------------------
  function getSession() {
    return new Promise((resolve) => {
      chrome.storage.session.get(
        ["providerRdns", "account", "keyHex"],
        (s) => resolve(s || {})
      );
    });
  }

  function setSession(data) {
    return new Promise((resolve) => chrome.storage.session.set(data, resolve));
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

  function readContract(rdns) {
    return new ethers.Contract(
      CFG.CONTRACT_ADDRESS,
      CFG.CONTRACT_ABI,
      ethersProvider(rdns)
    );
  }

  function writeContract(rdns, account) {
    const provider = ethersProvider(rdns);
    return new ethers.Contract(
      CFG.CONTRACT_ADDRESS,
      CFG.CONTRACT_ABI,
      provider.getSigner(account)
    );
  }

  // ---- minimal wallet picker (only shown when >1 wallet is installed) -------
  function pickWallet(list) {
    if (list.length === 1) return Promise.resolve(list[0].rdns);
    return new Promise((resolve) => {
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
          resolve(w.rdns);
        };
        overlay.appendChild(btn);
      });
      document.body.appendChild(overlay);
    });
  }

  async function connectWallet() {
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
    await W.ensureChain(rdns); // switch to the contract's network
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
          assertConfigured();
          const { rdns, account } = await connectWallet();
          session = { rdns, account };
          await setSession({ providerRdns: rdns, account });
          showConnected(account);
        } catch (e) {
          alert(e.message);
        }
      });
    }

    async function unlock() {
      try {
        assertConfigured();
        if (!session.account) {
          alert("Connect your wallet first.");
          return;
        }
        const master = masterInput.value;
        if (!master) {
          alert("Enter your master password.");
          return;
        }

        // Authorize this site's origin (required to sign). No-ops if already
        // connected; prompts the wallet the first time on a new website.
        const accts = await W.request(session.rdns, "eth_requestAccounts", []);
        if (accts && accts.length) session.account = accts[0];

        await W.ensureChain(session.rdns); // guard against a mid-session switch
        const provider = ethersProvider(session.rdns);
        const contract = new ethers.Contract(
          CFG.CONTRACT_ADDRESS,
          CFG.CONTRACT_ABI,
          provider
        );
        const registered = await contract.isRegistered(session.account);
        if (!registered) {
          alert(
            "This wallet has no vault yet. Create one on the BlockCrypt website first."
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
        });
        location.href = "vault.html#" + (hasEntryForSite ? "retrieve" : "save");
      } catch (e) {
        alert(e.message || "Unlock failed");
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
    assertConfigured();
    const s = await getSession();
    if (!s.account || !s.keyHex || !s.providerRdns) {
      alert("Vault locked. Open the extension and unlock first.");
      location.href = "index.html";
      throw new Error("locked");
    }
    await W.ensureChain(s.providerRdns); // make sure reads/writes hit the right chain
    const key = await C.importRawKeyHex(s.keyHex);
    const host = await getActiveHost();
    return { ...s, key, host };
  }

  async function readVault(ctx) {
    const contract = readContract(ctx.providerRdns);
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
    let mode = location.hash === "#retrieve" ? "retrieve" : "save";

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

    async function loadRetrieve() {
      try {
        const ctx = await context();
        const vault = await getVaultCached(ctx);
        storedPassword = vault.entries[ctx.host] || "";
        retrieveInput.type = "password";
        if (showBtn) showBtn.textContent = "Show";
        if (storedPassword) {
          retrieveInput.value = storedPassword;
          retrieveInput.placeholder = "";
        } else {
          retrieveInput.value = "";
          retrieveInput.placeholder = "No saved password for this site";
        }
      } catch (e) {
        if (e.message !== "locked") console.error(e);
      }
    }

    function setMode(next) {
      mode = next;
      if (next === "retrieve") {
        textLabel.textContent = "Password for";
        switchBtn.textContent = "Save";
        saveRow.classList.add("hidden");
        retrieveRow.classList.remove("hidden");
        loadRetrieve();
      } else {
        textLabel.textContent = "Save password for";
        switchBtn.textContent = "Retrieve";
        retrieveRow.classList.add("hidden");
        saveRow.classList.remove("hidden");
        if (saveInput) saveInput.focus();
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

    if (submitBtn) {
      submitBtn.addEventListener("click", async () => {
        try {
          const ctx = await context();
          if (!ctx.host) {
            alert("Could not read the current site.");
            return;
          }
          const password = saveInput.value;
          if (!password) {
            alert("Enter a password to save.");
            return;
          }

          const vault = await getVaultCached(ctx);
          vault.entries[ctx.host] = password;
          const cipherHex = await C.encryptToHex(
            ctx.key,
            C.serializeVault(vault)
          );

          const contract = writeContract(ctx.providerRdns, ctx.account);
          const tx = await contract.setVault(cipherHex);
          await tx.wait();
          storedPassword = password;
          alert("Password saved on-chain for " + ctx.host);
          setMode("retrieve");
        } catch (e) {
          if (e.message === "locked") return;
          alert("Error saving password: " + (e.message || e));
          console.error(e);
        }
      });
    }

    setMode(mode);
  }
})();
