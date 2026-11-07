/**
 * Pure helpers for the mock TOTP two-factor layer.
 *
 * No I/O and no logging here. Secrets, provisioning URIs and recovery codes
 * must never reach console output or non-auth endpoints.
 *
 * Randomness comes from WebCrypto `getRandomValues` (CSPRNG). Recovery codes
 * carry exactly 128 bits of entropy (16 random bytes, base32, no padding).
 */
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

/** RFC 4648 base32, no padding. */
export function base32Encode(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

/** 160-bit TOTP secret as base32 (20 bytes — RFC 6238 recommends ≥128). */
export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

/** Recovery code: 16 random bytes = 128 bits of entropy, grouped for reading. */
export function generateRecoveryCode(): string {
  const raw = base32Encode(randomBytes(16)); // 26 chars
  return [
    raw.slice(0, 5),
    raw.slice(5, 10),
    raw.slice(10, 15),
    raw.slice(15, 20),
    raw.slice(20),
  ].join('-');
}

/** Generates a fresh, non-recoverable-from-each-other code set. */
export function generateRecoveryCodes(count: number): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i += 1) codes.push(generateRecoveryCode());
  return codes;
}

/** Normalizes a recovery code for comparison: uppercase, base32 chars only. */
export function normalizeRecoveryCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z2-7]/g, '');
}

/** Normalizes a TOTP code: digits only, leading zeros preserved (string). */
export function normalizeTotpCode(input: string): string {
  return input.replace(/[^0-9]/g, '');
}

/** SHA-256 hex digest — the only persisted form of a recovery code. */
export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Unpredictable identifier (16 random bytes, hex) for challenge ids. */
export function generateUnpredictableId(): string {
  return Array.from(randomBytes(16))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
