# BlockCrypt — Deploy & Configure

The security rewrite changed the smart contract (`BlockCrypt Extension/pass.sol`),
so the **old `0x0ac2…c4b` contract no longer matches the code**. You must deploy
the new `Keychain` contract and point the app at it.

## 1. Deploy the new contract (Remix, ~3 min)

1. Open <https://remix.ethereum.org>.
2. Create `pass.sol` and paste the contents of
   [`BlockCrypt Extension/pass.sol`](BlockCrypt%20Extension/pass.sol).
3. **Solidity Compiler** tab → compiler `0.8.20` or newer → **Compile**.
4. **Deploy & Run** tab:
   - Environment: **Injected Provider** (connect your wallet).
   - Make sure your wallet is on your **test network** (e.g. Sepolia) and funded
     with test ETH.
   - Select the `Keychain` contract → **Deploy** → confirm in your wallet.
5. Copy the deployed contract address from the **Deployed Contracts** panel.

## 2. Point the app at the new address

Edit **`BlockCrypt Extension/config.js`** and set:

```js
CONTRACT_ADDRESS: "0xYOUR_NEW_ADDRESS",
```

Then copy that file over the website's copy so they stay identical:

```powershell
Copy-Item "BlockCrypt Extension/config.js" docs/config.js -Force
```

> `config.js` is the single source of truth for the address **and** the ABI.
> If you ever change `pass.sol`, update the ABI here too and re-copy to `docs/`.

## 3. Load the extension

1. Chrome → `chrome://extensions` → enable **Developer mode**.
2. **Load unpacked** → select the `BlockCrypt Extension` folder.
3. Open any normal `https://` website, click the BlockCrypt icon.

## 4. Create a vault (website)

1. Serve `docs/` over `http(s)` (GitHub Pages, or `python -m http.server` inside
   `docs/`). Wallets don't inject into `file://` pages.
2. Connect a wallet, choose a **master password**, click **Create vault**, and
   confirm the `register` transaction.

## 5. Use it (extension)

1. On a site, open the popup → connect the same wallet → type your master
   password → unlock.
2. **Save** stores the password for the current site; **Retrieve** fills it back.

---

## Security model (why this is safe)

Everything on a public blockchain is readable by anyone, forever. BlockCrypt
assumes the on-chain salt **and** ciphertext are public, and protects the vault
entirely off-chain:

- **Two secret factors** are combined into the encryption key: your **master
  password** (something you know) and a **deterministic wallet signature**
  (something you have). Neither ever leaves your browser.
- The key is derived with **PBKDF2-HMAC-SHA256, 600,000 iterations** over a
  per-user random salt.
- The vault is sealed with **AES-256-GCM** (authenticated encryption): a wrong
  key fails the integrity tag instead of leaking anything, and tampering is
  detected.

An attacker who copies the on-chain bytes still needs **both** your master
password and your wallet's private key to decrypt — and brute force is made
infeasible by the KDF. Nothing is ever literally "unhackable," but breaking this
requires defeating AES-256-GCM or stealing both of your independent secrets.
