// BlockCrypt website — sign-up (vault creation).
//
// Identity is the wallet ADDRESS (no more public "ID"). To create a vault the
// user connects any wallet (EIP-6963) and picks a master password. We then:
//   1. generate a random PBKDF2 salt,
//   2. ask the wallet to sign the fixed key-derivation message,
//   3. derive the AES-256-GCM key from (master password + signature, salt),
//   4. encrypt an empty vault and call register(salt, ciphertext) on-chain.
//
// The master password and signature never leave the browser. Only the public
// salt and the (useless-without-the-secret) ciphertext are written on-chain.

(function () {
  const C = window.BlockCryptCrypto;
  const W = window.BlockCryptWalletWeb;
  const CFG = window.BLOCKCRYPT_CONFIG;

  const connectBtn = document.getElementById("connectBtn");
  const newUserButton = document.getElementById("newUser");
  const masterInput = document.getElementById("inputText");

  let session = { uuid: null, account: null };

  function assertConfigured() {
    if (!CFG.CONTRACT_ADDRESS || /^0x0{40}$/i.test(CFG.CONTRACT_ADDRESS)) {
      alert(
        "BlockCrypt is not configured yet: deploy pass.sol and set " +
          "CONTRACT_ADDRESS in config.js (see DEPLOY.md)."
      );
      throw new Error("CONTRACT_ADDRESS not set");
    }
  }

  function pickWallet(list) {
    if (list.length === 1) return Promise.resolve(list[0].uuid);
    return new Promise((resolve) => {
      const overlay = document.createElement("div");
      overlay.style.cssText =
        "position:fixed;inset:0;background:rgba(0,0,0,.7);display:flex;" +
        "flex-direction:column;align-items:center;justify-content:center;" +
        "gap:8px;z-index:9999;";
      const title = document.createElement("div");
      title.textContent = "Choose a wallet";
      title.style.cssText = "color:#fff;margin-bottom:8px;font-size:18px;";
      overlay.appendChild(title);
      list.forEach((w) => {
        const btn = document.createElement("button");
        btn.textContent = w.name || w.rdns || w.uuid;
        btn.style.cssText =
          "padding:10px 18px;min-width:200px;cursor:pointer;border:none;" +
          "border-radius:4px;background:#376871;color:#fff;font-size:15px;";
        btn.onclick = () => {
          document.body.removeChild(overlay);
          resolve(w.uuid);
        };
        overlay.appendChild(btn);
      });
      document.body.appendChild(overlay);
    });
  }

  function signerAndContract(uuid, account) {
    const provider = new ethers.providers.Web3Provider(W.eip1193(uuid), "any");
    const signer = provider.getSigner(account);
    const contract = new ethers.Contract(
      CFG.CONTRACT_ADDRESS,
      CFG.CONTRACT_ABI,
      signer
    );
    return { signer, contract };
  }

  connectBtn.addEventListener("click", async function () {
    try {
      assertConfigured();
      const wallets = await W.discover();
      if (!wallets.length) {
        alert("No wallet detected. Install MetaMask, Coinbase Wallet, Rabby, …");
        return;
      }
      const uuid = await pickWallet(wallets);
      const accounts = await W.request(uuid, "eth_requestAccounts", []);
      if (!accounts || !accounts.length) return;
      session = { uuid, account: accounts[0] };
      await W.ensureChain(uuid); // switch to the contract's network
      connectBtn.style.display = "none";
      console.log("Connected account:", session.account);
    } catch (error) {
      console.error("Error connecting wallet:", error);
      alert(error.message || "Error connecting wallet");
    }
  });

  const newUserFunction = async () => {
    try {
      assertConfigured();
      if (!session.account) {
        alert("Connect your wallet first.");
        return;
      }
      const master = masterInput.value;
      if (!master || master.length < 8) {
        alert("Choose a master password of at least 8 characters.");
        return;
      }

      await W.ensureChain(session.uuid); // guard against a mid-session switch

      const { signer, contract } = signerAndContract(
        session.uuid,
        session.account
      );

      if (await contract.isRegistered(session.account)) {
        alert("This wallet already has a vault. You cannot register twice.");
        return;
      }

      const salt = C.randomBytes(16);
      // personal_sign directly (ethers 5.2 signMessage wrongly uses eth_sign,
      // which modern wallets reject). Hex-encode for cross-wallet consistency.
      const msgHex = ethers.utils.hexlify(
        ethers.utils.toUtf8Bytes(CFG.KEY_DERIVATION_MESSAGE)
      );
      const signature = await W.request(session.uuid, "personal_sign", [
        msgHex,
        session.account,
      ]);
      const key = await C.deriveKey(master, signature, salt);
      const cipherHex = await C.encryptToHex(key, C.serializeVault(C.emptyVault()));

      const tx = await contract.register(C.bytesToHex(salt), cipherHex);
      await tx.wait();

      alert(
        "Vault created! Remember your master password — it cannot be reset and " +
          "is required (together with this wallet) to open your vault."
      );
    } catch (error) {
      console.error("Error creating vault:", error);
      if (error.message && error.message.includes("Already registered")) {
        alert("This wallet already has a vault.");
      } else {
        alert("Error creating vault: " + (error.message || error));
      }
    }
  };

  newUserButton.addEventListener("click", newUserFunction);
})();
