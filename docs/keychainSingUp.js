// BlockCrypt website — sign-up (vault creation).
//
// Identity is the wallet ADDRESS (no more public "ID"). To create a vault the
// user picks a NETWORK (Ethereum, Base, … — see NETWORKS in config.js),
// connects any wallet (EIP-6963) and chooses a master password. We then:
//   1. generate a random PBKDF2 salt,
//   2. ask the wallet to sign the fixed key-derivation message,
//   3. derive the AES-256-GCM key from (master password + signature, salt),
//   4. encrypt an empty vault and call register(salt, ciphertext) on the
//      chosen network's contract.
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
  const networkRow = document.getElementById("networkRow");

  let session = { uuid: null, account: null };

  // ---- network selector ------------------------------------------------------
  let networkKey =
    localStorage.bcNetwork && CFG.NETWORKS[localStorage.bcNetwork]
      ? localStorage.bcNetwork
      : CFG.DEFAULT_NETWORK;

  function paintNets() {
    if (!networkRow) return;
    networkRow.querySelectorAll(".netPill").forEach((el) => {
      el.classList.toggle("selected", el.dataset.net === networkKey);
    });
  }
  paintNets();

  if (networkRow) {
    networkRow.addEventListener("click", (e) => {
      const el = e.target.closest(".netPill");
      if (!el) return;
      const net = CFG.NETWORKS[el.dataset.net];
      if (!net || !net.evm) {
        alert(
          "Solana support is coming soon. BlockCrypt's vault contract is " +
            "EVM-only (Ethereum, Base, …); Solana is a different runtime and " +
            "needs its own on-chain program."
        );
        return;
      }
      networkKey = el.dataset.net;
      localStorage.bcNetwork = networkKey;
      paintNets();
    });
  }

  function currentNet() {
    return CFG.getNetwork(networkKey);
  }

  function assertConfigured(net) {
    if (!net || !net.evm) {
      alert(net ? net.label + " is not supported yet." : "Pick a network.");
      throw new Error("unsupported network");
    }
    if (!net.contractAddress || /^0x0{40}$/i.test(net.contractAddress)) {
      alert(
        "BlockCrypt is not deployed on " + net.label + " yet: deploy pass.sol " +
          "there and set its address in config.js (see DEPLOY.md)."
      );
      throw new Error("contract address not set for " + net.key);
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

  function signerAndContract(uuid, account, net) {
    const provider = new ethers.providers.Web3Provider(W.eip1193(uuid), "any");
    const signer = provider.getSigner(account);
    const contract = new ethers.Contract(
      net.contractAddress,
      CFG.CONTRACT_ABI,
      signer
    );
    return { signer, contract };
  }

  connectBtn.addEventListener("click", async function () {
    try {
      const wallets = await W.discover();
      if (!wallets.length) {
        alert("No wallet detected. Install MetaMask, Coinbase Wallet, Rabby, …");
        return;
      }
      const uuid = await pickWallet(wallets);
      const accounts = await W.request(uuid, "eth_requestAccounts", []);
      if (!accounts || !accounts.length) return;
      session = { uuid, account: accounts[0] };
      connectBtn.style.display = "none";
      console.log("Connected account:", session.account);
    } catch (error) {
      console.error("Error connecting wallet:", error);
      alert(error.message || "Error connecting wallet");
    }
  });

  const newUserFunction = async () => {
    try {
      const net = currentNet();
      assertConfigured(net);
      if (!session.account) {
        alert("Connect your wallet first.");
        return;
      }
      const master = masterInput.value;
      if (!master || master.length < 8) {
        alert("Choose a master password of at least 8 characters.");
        return;
      }

      // Put the wallet on the chosen network before touching the contract.
      await W.ensureChain(session.uuid, net);

      const { signer, contract } = signerAndContract(
        session.uuid,
        session.account,
        net
      );

      if (await contract.isRegistered(session.account)) {
        alert(
          "This wallet already has a vault on " + net.label + ". You cannot " +
            "register twice on the same network."
        );
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
        "Vault created on " + net.label + "! Remember your master password — " +
          "it cannot be reset and is required (together with this wallet) to " +
          "open your vault. Select " + net.label + " in the extension to use it."
      );
    } catch (error) {
      console.error("Error creating vault:", error);
      if (error.message && error.message.includes("Already registered")) {
        alert("This wallet already has a vault on " + currentNet().label + ".");
      } else {
        alert("Error creating vault: " + (error.message || error));
      }
    }
  };

  newUserButton.addEventListener("click", newUserFunction);
})();
