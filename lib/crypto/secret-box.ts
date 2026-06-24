import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";

// Authenticated symmetric encryption for small secrets (user-supplied AI keys). AES-256-GCM gives
// confidentiality + integrity (a tampered ciphertext fails the auth-tag check on decrypt). The
// master key is held ONLY in the server env (AI_KEY_ENC_SECRET), never in the database, so a DB
// leak alone is useless. Wire format: base64( iv(12) || authTag(16) || ciphertext ).

const ALGO = "aes-256-gcm";
const IV_LEN = 12; // 96-bit nonce - the recommended size for GCM
const TAG_LEN = 16; // GCM auth tag
const KEY_LEN = 32; // AES-256

// Decode + validate the master key once. Accepts base64 (preferred, e.g. `openssl rand -base64 32`)
// or 64-char hex. Throws (FAILS CLOSED) if absent or the wrong length, so a misconfigured instance
// can never silently store keys under a weak/empty secret.
function masterKey(): Buffer {
  const raw = process.env.AI_KEY_ENC_SECRET;
  if (!raw) {
    throw new Error("AI_KEY_ENC_SECRET is not set - cannot encrypt/decrypt user AI keys");
  }
  let key: Buffer;
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    key = Buffer.from(raw, "hex");
  } else {
    key = Buffer.from(raw, "base64");
  }
  if (key.length !== KEY_LEN) {
    throw new Error(
      `AI_KEY_ENC_SECRET must decode to ${KEY_LEN} bytes (got ${key.length}). Generate one with: openssl rand -base64 32`
    );
  }
  return key;
}

// True when a valid master key is configured. Never throws - used to gate UI/availability.
export function isEncryptionConfigured(): boolean {
  try {
    masterKey();
    return true;
  } catch {
    return false;
  }
}

export function encryptSecret(plaintext: string): string {
  const key = masterKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]).toString("base64");
}

export function decryptSecret(blob: string): string {
  const key = masterKey();
  const buf = Buffer.from(blob, "base64");
  if (buf.length < IV_LEN + TAG_LEN + 1) {
    throw new Error("ciphertext is too short / malformed");
  }
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const ct = buf.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  // .final() throws if the auth tag does not verify (tampered ciphertext / wrong key).
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}
