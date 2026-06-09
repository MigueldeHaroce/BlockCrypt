// BlockCrypt extension — application logic.
//
// Pipeline per page:
//   index.html    : connect any wallet (EIP-6963) + master password -> derive
//                   AES key (PBKDF2 over password+signature) -> unlock vault.
//   save.html     : add/update the password for the current site, re-encrypt
//                   the whole vault, write it on-chain (setVault).
//   retrieve.html : decrypt the vault, fill in the password for the current site.
//
// The derived AES key is cached for the popup session in chrome.storage.session
// (in-memory, wiped when the browser closes) so the three pages can share it
// without re-prompting the wallet each time.

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
        ["providerUuid", "account", "keyHex"],
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
  function ethersProvider(uuid) {
    const shim = W.eip1193(uuid);
    return new ethers.providers.Web3Provider(shim, "any");
  }

  function readContract(uuid) {
    return new ethers.Contract(
      CFG.CONTRACT_ADDRESS,
      CFG.CONTRACT_ABI,
      ethersProvider(uuid)
    );
  }

  function writeContract(uuid, account) {
    const provider = ethersProvider(uuid);
    return new ethers.Contract(
      CFG.CONTRACT_ADDRESS,
      CFG.CONTRACT_ABI,
      provider.getSigner(account)
    );
  }

  // ---- minimal wallet picker (only shown when >1 wallet is installed) -------
  function pickWallet(list) {
    if (list.length === 1) return Promise.resolve(list[0].uuid);
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
          resolve(w.uuid);
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
    const uuid = await pickWallet(wallets);
    const accounts = await W.request(uuid, "eth_requestAccounts", []);
    if (!accounts || !accounts.length) throw new Error("No account authorized");
    await W.ensureChain(uuid); // switch to the contract's network
    return { uuid, account: accounts[0] };
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

    let session = { uuid: null, account: null };

    async function restore() {
      const s = await getSession();
      if (s.account && s.providerUuid) {
        session = { uuid: s.providerUuid, account: s.account };
        if (userLabel) userLabel.textContent = shortAddr(s.account);
        if (connectBtn) connectBtn.style.display = "none";
      }
    }
    restore();

    if (connectBtn) {
      connectBtn.addEventListener("click", async () => {
        try {
          assertConfigured();
          const { uuid, account } = await connectWallet();
          session = { uuid, account };
          await setSession({ providerUuid: uuid, account });
          if (userLabel) userLabel.textContent = shortAddr(account);
          connectBtn.style.display = "none";
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

        await W.ensureChain(session.uuid); // guard against a mid-session switch
        const provider = ethersProvider(session.uuid);
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
        const signature = await W.request(session.uuid, "personal_sign", [
          msgHex,
          session.account,
        ]);

        const key = await C.deriveKey(master, signature, C.hexToBytes(saltHex));

        // Verify the password by decrypting the existing vault.
        if (cipherHex && cipherHex !== "0x") {
          await C.decryptFromHex(key, cipherHex); // throws if wrong
        }

        const keyHex = await C.exportRawKeyHex(key);
        await setSession({
          providerUuid: session.uuid,
          account: session.account,
          keyHex,
        });
        location.href = "save.html";
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
  //  shared loader for save.html / retrieve.html
  // =====================================================================
  async function loadVaultContext() {
    assertConfigured();
    const s = await getSession();
    if (!s.account || !s.keyHex || !s.providerUuid) {
      alert("Vault locked. Open the extension and unlock first.");
      location.href = "index.html";
      throw new Error("locked");
    }
    await W.ensureChain(s.providerUuid); // make sure reads/writes hit the right chain
    const key = await C.importRawKeyHex(s.keyHex);
    const host = await getActiveHost();
    return { ...s, key, host };
  }

  async function readVault(ctx) {
    const contract = readContract(ctx.providerUuid);
    const [, cipherHex] = await contract.getVaultOf(ctx.account);
    if (!cipherHex || cipherHex === "0x") return C.emptyVault();
    const plain = await C.decryptFromHex(ctx.key, cipherHex);
    return C.parseVault(plain);
  }

  // =====================================================================
  //  save.html
  // =====================================================================
  if (location.href.includes("save.html")) {
    const submit = document.getElementById("submit");
    if (submit) {
      submit.addEventListener("click", async () => {
        try {
          const ctx = await loadVaultContext();
          if (!ctx.host) {
            alert("Could not read the current site.");
            return;
          }
          const password = document.getElementById("inputText1").value;
          if (!password) {
            alert("Enter a password to save.");
            return;
          }

          const vault = await readVault(ctx);
          vault.entries[ctx.host] = password;
          const cipherHex = await C.encryptToHex(
            ctx.key,
            C.serializeVault(vault)
          );

          const contract = writeContract(ctx.providerUuid, ctx.account);
          const tx = await contract.setVault(cipherHex);
          await tx.wait();
          alert("Password saved on-chain for " + ctx.host);
        } catch (e) {
          if (e.message === "locked") return;
          alert("Error saving password: " + (e.message || e));
          console.error(e);
        }
      });
    }
  }

  // =====================================================================
  //  retrieve.html
  // =====================================================================
  if (location.href.includes("retrieve.html")) {
    const getBtn = document.getElementById("get");
    if (getBtn) {
      getBtn.addEventListener("click", async () => {
        try {
          const ctx = await loadVaultContext();
          const vault = await readVault(ctx);
          const password = vault.entries[ctx.host];
          const field = document.getElementById("inputText");
          if (password) {
            field.value = password;
          } else {
            field.value = "";
            alert("No password stored for " + ctx.host);
          }
        } catch (e) {
          if (e.message === "locked") return;
          alert("Error retrieving password: " + (e.message || e));
          console.error(e);
        }
      });
    }
  }
})();
