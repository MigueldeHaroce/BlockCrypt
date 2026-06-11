// BlockCrypt shared configuration.
//
// Loaded as a plain <script> in both the extension and the website, so the
// network list, contract addresses and ABI live in exactly ONE place. After
// editing this file, copy it over docs/config.js (they must be identical).

(function (root) {
  const CONFIG = {
    // ---- networks -----------------------------------------------------------
    // The Keychain contract (pass.sol) can be deployed on any EVM network.
    // Deploy it per network (see DEPLOY.md) and paste the address into
    // contractAddress below. A zero address means "not deployed there yet";
    // the UI will refuse that network with a clear message.
    //
    // ⚠️ Solana is listed for the UI but NOT functional: it is not an EVM
    // chain (no Solidity, no EIP-1193 wallets, different signatures). True
    // Solana support requires a separate on-chain program + wallet stack.
    NETWORKS: {
      ethereum: {
        key: "ethereum",
        label: "Ethereum",
        evm: true,
        // ⚠️ Deploy pass.sol on Ethereum mainnet and paste the address here.
        contractAddress: "0x0000000000000000000000000000000000000000",
        chainIdHex: "0x1",
        chainParams: {
          chainId: "0x1",
          chainName: "Ethereum Mainnet",
          nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
          rpcUrls: ["https://ethereum-rpc.publicnode.com"],
          blockExplorerUrls: ["https://etherscan.io"],
        },
      },
      base: {
        key: "base",
        label: "Base",
        evm: true,
        // ⚠️ Deploy pass.sol on Base and paste the address here.
        contractAddress: "0x0000000000000000000000000000000000000000",
        chainIdHex: "0x2105",
        chainParams: {
          chainId: "0x2105",
          chainName: "Base",
          nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
          rpcUrls: ["https://mainnet.base.org"],
          blockExplorerUrls: ["https://basescan.org"],
        },
      },
      sepolia: {
        key: "sepolia",
        label: "Sepolia · test",
        evm: true,
        contractAddress: "0x7a3c1c5DA22095506396Acc3a34f71eeEA576FAC",
        chainIdHex: "0xaa36a7",
        chainParams: {
          chainId: "0xaa36a7",
          chainName: "Sepolia",
          nativeCurrency: { name: "Sepolia Ether", symbol: "ETH", decimals: 18 },
          rpcUrls: ["https://ethereum-sepolia-rpc.publicnode.com"],
          blockExplorerUrls: ["https://sepolia.etherscan.io"],
        },
      },
      solana: {
        key: "solana",
        label: "Solana",
        evm: false, // not supported — see the note above
      },
    },

    // Network preselected in the UI until the user picks another one.
    DEFAULT_NETWORK: "sepolia",

    // ABI of the Keychain contract (identical on every EVM network).
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
    // Chain-agnostic: the same wallet+password derive the same key everywhere
    // (each network still gets its own random salt at registration).
    KDF_ITERATIONS: 600000,
    KDF_HASH: "SHA-256",
    AES_KEY_BITS: 256,

    // Fixed message the wallet signs to derive the second key factor. Versioned
    // so we can rotate later. NEVER change this without a migration path.
    KEY_DERIVATION_MESSAGE:
      "BlockCrypt vault key derivation\n" +
      "Version: 1\n" +
      "Sign this ONLY inside the BlockCrypt extension or blockcrypt website.\n" +
      "This signature unlocks your password vault and is never shared.",
  };

  // Resolve a network entry, falling back to the default.
  CONFIG.getNetwork = function (key) {
    return CONFIG.NETWORKS[key] || CONFIG.NETWORKS[CONFIG.DEFAULT_NETWORK];
  };

  root.BLOCKCRYPT_CONFIG = CONFIG;
})(typeof window !== "undefined" ? window : globalThis);
