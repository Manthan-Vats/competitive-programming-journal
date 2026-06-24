import { randomBytes } from "node:crypto";

// Tests AES-256-GCM secret encryption: round-trip, tamper detection, and fail-closed behavior when
// the master key is missing/short. No network. Run:
//   npx tsx test/secret-box.test.ts

let passed = 0;
function check(name: string, cond: boolean) {
  if (!cond) {
    console.error("FAIL:", name);
    throw new Error("test failed: " + name);
  }
  passed++;
}

async function main() {
  // A valid 32-byte master key (base64) must be present before importing the module's functions.
  process.env.AI_KEY_ENC_SECRET = randomBytes(32).toString("base64");
  const { encryptSecret, decryptSecret, isEncryptionConfigured } = await import("../lib/crypto/secret-box");

  check("encryption configured with 32-byte key", isEncryptionConfigured() === true);

  // Round-trip.
  const secret = "AIzaSyD-EXAMPLE-key-1234567890abcdef";
  const blob = encryptSecret(secret);
  check("ciphertext differs from plaintext", blob !== secret);
  check("round-trips back to plaintext", decryptSecret(blob) === secret);

  // Two encryptions of the same plaintext differ (random IV).
  check("random IV -> distinct ciphertexts", encryptSecret(secret) !== encryptSecret(secret));

  // Tampering is detected (GCM auth tag fails).
  const raw = Buffer.from(blob, "base64");
  raw[raw.length - 1] ^= 0xff; // flip a byte in the ciphertext
  let tamperThrew = false;
  try {
    decryptSecret(raw.toString("base64"));
  } catch {
    tamperThrew = true;
  }
  check("tampered ciphertext is rejected", tamperThrew);

  // Wrong key cannot decrypt. masterKey() re-reads process.env on every call, so swapping the env
  // var and reusing the same functions is enough.
  const goodBlob = encryptSecret(secret);
  process.env.AI_KEY_ENC_SECRET = randomBytes(32).toString("base64");
  let wrongKeyThrew = false;
  try {
    decryptSecret(goodBlob);
  } catch {
    wrongKeyThrew = true;
  }
  check("wrong master key cannot decrypt", wrongKeyThrew);

  // Fail closed: a short/invalid master key disables encryption + throws on use.
  process.env.AI_KEY_ENC_SECRET = "too-short";
  check("short key -> not configured", isEncryptionConfigured() === false);
  let encThrew = false;
  try {
    encryptSecret("x");
  } catch {
    encThrew = true;
  }
  check("short key -> encrypt throws (fail closed)", encThrew);

  console.log(`\nALL PASS (${passed} checks)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
