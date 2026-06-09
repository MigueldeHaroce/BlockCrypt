### BlockCrypt Extension

BlockCrypt is a web application designed to securely retrieve and manage passwords using decentralized technologies. By leveraging blockchain and cryptographic libraries, this project ensures that user passwords are encrypted and stored in a highly secure manner, reducing the risk of filtrations that happens on normal servers or localy saved passwords.

### Core functionality

The core functionality of the BlockCrypt Extension is built with Solidity and
plain JavaScript:

- **WebCrypto (SubtleCrypto)**: PBKDF2 key derivation and AES-256-GCM
  authenticated encryption — all in the browser, no third-party crypto library.
- **Ethers.js**: interaction with the Ethereum blockchain for decentralized
  storage and retrieval of the encrypted vault.
- **EIP-6963 multi-wallet discovery**: works with **any** common browser wallet
  (MetaMask, Coinbase Wallet, Rabby, Brave, Trust, …), not just MetaMask. The
  extension popup reaches the page's wallet through a `chrome.scripting` bridge.

Key files: `config.js` (contract address + ABI — single source of truth),
`crypto.js` (vault encryption), `wallet.js` / `walletWeb.js` (wallet discovery),
`smartcontract.js` (extension logic), `docs/keychainSingUp.js` (vault creation).

#### Decentralization and Security
Your vault is tied to your **wallet address** and unlocked with a **master
password**. The encryption key is derived (PBKDF2-HMAC-SHA256, 600k iterations)
from the master password **combined with a deterministic wallet signature** — two
independent secrets that never leave your browser. The vault is sealed with
AES-256-GCM and stored on-chain, so passwords live on no centralized server.
Because everything on-chain is public, security comes entirely from the off-chain
secrets: an attacker who copies the ciphertext still needs **both** your master
password and your wallet's private key. See [`DEPLOY.md`](DEPLOY.md) for the full
security model and setup/deploy steps.


![Screenshot 2024-08-01 214125](https://github.com/user-attachments/assets/f327b497-94ea-4fff-aa28-0859143b7237)
![Screenshot 2024-08-01 214241](https://github.com/user-attachments/assets/a948f0b1-3fa6-4c5c-965a-2ebec6d839bc)
