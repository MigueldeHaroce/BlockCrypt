// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title  BlockCrypt Keychain
/// @author MigueldeHaro
/// @notice Stores ONE opaque, client-side-encrypted password vault per address.
///
/// @dev    SECURITY MODEL (read this before changing anything):
///
///         Everything written to a public blockchain is readable by everyone,
///         forever. This contract therefore assumes that BOTH `salt` and
///         `ciphertext` are public. Confidentiality comes 100% from the client:
///         the vault is encrypted with AES-256-GCM using a key derived
///         (PBKDF2-HMAC-SHA256) from the user's master password COMBINED with a
///         deterministic wallet signature. Neither the password nor the
///         signature ever leaves the browser, so the on-chain bytes are useless
///         to an attacker.
///
///         What the contract DOES provide:
///           1. Write-access control — only `msg.sender` can write their slot.
///           2. An immutable per-user KDF `salt` (set once at registration) so
///              the vault can be recovered on any device.
///           3. No plaintext and no ciphertext in event topics/args, so logs
///              leak nothing beyond "this address updated, new length is N".
contract Keychain {
    struct Vault {
        bytes salt;        // public PBKDF2 salt, immutable after registration
        bytes ciphertext;  // AES-256-GCM blob: 12-byte IV || ciphertext || 16-byte tag
        bool registered;
    }

    mapping(address => Vault) private vaults;

    event Registered(address indexed user);
    event VaultUpdated(address indexed user, uint256 length);

    /// @notice One-time registration: pins the KDF salt and stores the first vault.
    /// @param salt        Random salt generated client-side (>= 16 bytes).
    /// @param ciphertext  Encrypted (possibly empty) initial vault.
    function register(bytes calldata salt, bytes calldata ciphertext) external {
        require(!vaults[msg.sender].registered, "Already registered");
        require(salt.length >= 16, "Salt too short");

        vaults[msg.sender] = Vault(salt, ciphertext, true);
        emit Registered(msg.sender);
    }

    /// @notice Replace the whole encrypted vault. The salt is immutable.
    /// @param ciphertext  New AES-256-GCM encrypted vault.
    function setVault(bytes calldata ciphertext) external {
        require(vaults[msg.sender].registered, "Not registered");

        vaults[msg.sender].ciphertext = ciphertext;
        emit VaultUpdated(msg.sender, ciphertext.length);
    }

    /// @notice Read the caller's own vault (salt + ciphertext).
    function getVault() external view returns (bytes memory salt, bytes memory ciphertext) {
        Vault storage v = vaults[msg.sender];
        return (v.salt, v.ciphertext);
    }

    /// @notice Read any address' vault. The data is public on-chain anyway; this
    ///         just exposes it conveniently for reads from a non-owner RPC call.
    function getVaultOf(address user) external view returns (bytes memory salt, bytes memory ciphertext) {
        Vault storage v = vaults[user];
        return (v.salt, v.ciphertext);
    }

    /// @notice Whether an address has registered a vault.
    function isRegistered(address user) external view returns (bool) {
        return vaults[user].registered;
    }
}
