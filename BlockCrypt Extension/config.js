// BlockCrypt shared configuration.
//
// Loaded as a plain <script> in both the extension and the website, so the
// contract address and ABI live in exactly ONE place. After you redeploy
// pass.sol (see DEPLOY.md), paste the new address into CONTRACT_ADDRESS below
// and copy this file over docs/config.js (they must be identical).

(function (root) {
  const CONFIG = {
    // ⚠️ REPLACE AFTER DEPLOYING THE NEW pass.sol CONTRACT.
    // The old 0x0ac2...c4b contract uses the INSECURE ABI and will not work
    // with this code. Deploy the new Keychain contract and paste its address.
    CONTRACT_ADDRESS: "0x7a3c1c5DA22095506396Acc3a34f71eeEA576FAC",

    // ABI of the new Keychain contract (see pass.sol).
    CONTRACT_ABI: [
      { "anonymous": false, "inputs": [ { "indexed": true, "internalType": "address", "name": "user", "type": "address" } ], "name": "Registered", "type": "event" },
      { "anonymous": false, "inputs": [ { "indexed": true, "internalType": "address", "name": "user", "type": "address" }, { "indexed": false, "internalType": "uint256", "name": "length", "type": "uint256" } ], "name": "VaultUpdated", "type": "event" },
      { "inputs": [ { "internalType": "bytes", "name": "salt", "type": "bytes" }, { "internalType": "bytes", "name": "ciphertext", "type": "bytes" } ], "name": "register", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
      { "inputs": [ { "internalType": "bytes", "name": "ciphertext", "type": "bytes" } ], "name": "setVault", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
      { "inputs": [], "name": "getVault", "outputs": [ { "internalType": "bytes", "name": "salt", "type": "bytes" }, { "internalType": "bytes", "name": "ciphertext", "type": "bytes" } ], "stateMutability": "view", "type": "function" },
      { "inputs": [ { "internalType": "address", "name": "user", "type": "address" } ], "name": "getVaultOf", "outputs": [ { "internalType": "bytes", "name": "salt", "type": "bytes" }, { "internalType": "bytes", "name": "ciphertext", "type": "bytes" } ], "stateMutability": "view", "type": "function" },
      { "inputs": [ { "internalType": "address", "name": "user", "type": "address" } ], "name": "isRegistered", "outputs": [ { "internalType": "bool", "name": "", "type": "bool" } ], "stateMutability": "view", "type": "function" }
    ],

    // Key-derivation parameters. Must match across all clients or vaults won't
    // decrypt. 600k PBKDF2-HMAC-SHA256 iterations follows OWASP guidance.
    KDF_ITERATIONS: 600000,
    KDF_HASH: "SHA-256",
    AES_KEY_BITS: 256,

    // Network where the contract is deployed. The app makes sure the wallet is
    // on this chain before any contract call, switching/adding it if needed.
    // ⚠️ If you redeploy on another network, update these to match.
    EXPECTED_CHAIN_ID_HEX: "0xaa36a7", // 11155111 = Sepolia
    CHAIN_PARAMS: {
      chainId: "0xaa36a7",
      chainName: "Sepolia",
      nativeCurrency: { name: "Sepolia Ether", symbol: "ETH", decimals: 18 },
      rpcUrls: ["https://ethereum-sepolia-rpc.publicnode.com"],
      blockExplorerUrls: ["https://sepolia.etherscan.io"],
    },

    // Fixed message the wallet signs to derive the second key factor. Versioned
    // so we can rotate later. NEVER change this without a migration path.
    KEY_DERIVATION_MESSAGE:
      "BlockCrypt vault key derivation\n" +
      "Version: 1\n" +
      "Sign this ONLY inside the BlockCrypt extension or blockcrypt website.\n" +
      "This signature unlocks your password vault and is never shared.",
  };

  root.BLOCKCRYPT_CONFIG = CONFIG;
})(typeof window !== "undefined" ? window : globalThis);
