# BlockCrypt — Deploy & Configure

BlockCrypt is **multi-network**: the same `Keychain` contract
(`BlockCrypt Extension/pass.sol`) can be deployed on any EVM network. The user
picks the network on the sign-up website and in the extension. Networks are
defined in `config.js` → `NETWORKS` (Ethereum, Base, Sepolia testnet; Solana is
listed in the UI but disabled — see the note at the bottom).

Currently deployed:

| Network  | Contract address                              |
|----------|-----------------------------------------------|
| Sepolia  | `0x7a3c1c5DA22095506396Acc3a34f71eeEA576FAC`  |
| Ethereum | `0x40eDA2aB385b89582b405E706dd97896e84913dA`  |
| Base     | `0x40eDA2aB385b89582b405E706dd97896e84913dA`  |

## 1. Deploy the contract on a network (Remix, ~3 min each)

1. Open <https://remix.ethereum.org>.
2. Create `pass.sol` and paste the contents of
   [`BlockCrypt Extension/pass.sol`](BlockCrypt%20Extension/pass.sol).
3. **Solidity Compiler** tab → compiler `0.8.20` or newer → **Compile**.
4. **Deploy & Run** tab:
   - Environment: **Injected Provider** (connect your wallet).
   - Switch your wallet to the **target network** (Ethereum, Base, Sepolia…).
     On mainnets this costs **real ETH**; Base is far cheaper than Ethereum L1.
   - Select the `Keychain` contract → **Deploy** → confirm in your wallet.
5. Copy the deployed contract address from the **Deployed Contracts** panel.

## 2. Point the app at the new address

Edit **`BlockCrypt Extension/config.js`** and paste the address into that
network's entry:

```js
NETWORKS: {
  base: {
    ...
    contractAddress: "0xYOUR_BASE_ADDRESS", // ← here
    ...
  },
}
```

Then copy that file over the website's copy so they stay identical:

```powershell
Copy-Item "BlockCrypt Extension/config.js" docs/config.js -Force
```

> `config.js` is the single source of truth for the network list, addresses
> **and** the ABI. If you ever change `pass.sol`, update the ABI here too and
> re-copy to `docs/`. A zero address means "not deployed there yet" — the UI
> refuses that network with a clear message.
>
> Each network is independent: a vault registered on Sepolia does **not** exist
> on Base. The user selects the network at sign-up and again in the extension
> (the choice is remembered).
>
> **Why Solana is disabled:** Solana is not an EVM chain — it cannot run
> Solidity contracts, its wallets don't speak EIP-1193, and signatures work
> differently. Real Solana support requires a separate on-chain program (Rust)
> plus a Solana wallet adapter; it is a future project, not a config change.

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
