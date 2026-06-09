// BlockCrypt vault cryptography — WebCrypto (SubtleCrypto) only.
//
// Threat model: the encrypted vault is PUBLIC (it lives on-chain). An attacker
// can copy the ciphertext and brute-force offline. We defend with:
//   * Two secret factors mixed into the key: the master password (something you
//     know) AND a deterministic wallet signature (something you have). Neither
//     ever touches the chain.
//   * PBKDF2-HMAC-SHA256 at 600k iterations over a per-user random salt, so each
//     guess is expensive and rainbow tables are useless.
//   * AES-256-GCM authenticated encryption: a wrong key fails the auth tag
//     instead of returning garbage, and tampering is detected.
//
// Exposes a global `window.BlockCryptCrypto`.

(function (root) {
  const cfg = () => root.BLOCKCRYPT_CONFIG;
  const enc = new TextEncoder();
  const dec = new TextDecoder();

  function randomBytes(n) {
    return crypto.getRandomValues(new Uint8Array(n));
  }

  // ---- hex helpers (contract `bytes` are passed as 0x-prefixed hex) ----------
  function bytesToHex(bytes) {
    let out = "0x";
    for (const b of bytes) out += b.toString(16).padStart(2, "0");
    return out;
  }

  function hexToBytes(hex) {
    if (typeof hex !== "string") return new Uint8Array(0);
    let h = hex.startsWith("0x") ? hex.slice(2) : hex;
    if (h.length % 2 !== 0) h = "0" + h;
    const out = new Uint8Array(h.length / 2);
    for (let i = 0; i < out.length; i++) {
      out[i] = parseInt(h.substr(i * 2, 2), 16);
    }
    return out;
  }

  function concat(...arrays) {
    const total = arrays.reduce((n, a) => n + a.length, 0);
    const out = new Uint8Array(total);
    let off = 0;
    for (const a of arrays) {
      out.set(a, off);
      off += a.length;
    }
    return out;
  }

  // ---- key derivation --------------------------------------------------------
  // key = PBKDF2( utf8(masterPassword) || signatureBytes , salt )
  async function deriveKey(masterPassword, signatureHex, saltBytes) {
    if (!masterPassword) throw new Error("Master password required");
    if (!signatureHex) throw new Error("Wallet signature required");
    if (!saltBytes || saltBytes.length < 16) throw new Error("Invalid salt");

    const secret = concat(enc.encode(masterPassword), hexToBytes(signatureHex));
    const baseKey = await crypto.subtle.importKey(
      "raw",
      secret,
      "PBKDF2",
      false,
      ["deriveKey"]
    );

    return crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt: saltBytes,
        iterations: cfg().KDF_ITERATIONS,
        hash: cfg().KDF_HASH,
      },
      baseKey,
      { name: "AES-GCM", length: cfg().AES_KEY_BITS },
      true, // extractable: we cache the raw key in chrome.storage.session
      ["encrypt", "decrypt"]
    );
  }

  // ---- authenticated encryption ---------------------------------------------
  // Output bytes: iv(12) || ciphertext+tag
  async function encryptBytes(key, plaintextString) {
    const iv = randomBytes(12);
    const ct = new Uint8Array(
      await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        key,
        enc.encode(plaintextString)
      )
    );
    return concat(iv, ct);
  }

  async function decryptBytes(key, blobBytes) {
    if (!blobBytes || blobBytes.length < 13) {
      throw new Error("Empty or corrupt vault");
    }
    const iv = blobBytes.slice(0, 12);
    const ct = blobBytes.slice(12);
    let plain;
    try {
      plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
    } catch (e) {
      // GCM tag mismatch => wrong master password / wrong wallet / tampered data
      throw new Error("Decryption failed (wrong master password or wallet)");
    }
    return dec.decode(plain);
  }

  // Convenience: work directly in 0x-hex for contract round-trips.
  async function encryptToHex(key, plaintextString) {
    return bytesToHex(await encryptBytes(key, plaintextString));
  }

  async function decryptFromHex(key, hex) {
    return decryptBytes(key, hexToBytes(hex));
  }

  // ---- key caching for the popup session (chrome.storage.session) -----------
  async function exportRawKeyHex(key) {
    const raw = new Uint8Array(await crypto.subtle.exportKey("raw", key));
    return bytesToHex(raw);
  }

  async function importRawKeyHex(hex) {
    return crypto.subtle.importKey(
      "raw",
      hexToBytes(hex),
      { name: "AES-GCM", length: cfg().AES_KEY_BITS },
      true,
      ["encrypt", "decrypt"]
    );
  }

  // ---- vault model (robust JSON, replaces the fragile ", " / ": " strings) ---
  function emptyVault() {
    return { version: 1, entries: {} };
  }

  function parseVault(plaintextString) {
    if (!plaintextString) return emptyVault();
    try {
      const v = JSON.parse(plaintextString);
      if (!v || typeof v !== "object" || typeof v.entries !== "object") {
        return emptyVault();
      }
      return v;
    } catch {
      return emptyVault();
    }
  }

  function serializeVault(vault) {
    return JSON.stringify(vault);
  }

  root.BlockCryptCrypto = {
    randomBytes,
    bytesToHex,
    hexToBytes,
    deriveKey,
    encryptBytes,
    decryptBytes,
    encryptToHex,
    decryptFromHex,
    exportRawKeyHex,
    importRawKeyHex,
    emptyVault,
    parseVault,
    serializeVault,
  };
})(typeof window !== "undefined" ? window : globalThis);
