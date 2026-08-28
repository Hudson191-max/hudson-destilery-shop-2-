// ── Password hashing (scrypt with transparent legacy migration) ──────────────
// New accounts / password resets use scrypt (memory-hard KDF) with a per-user
// random salt. Legacy accounts created with the original scheme
// (sha256(salt + pw + salt)) still verify, and are transparently upgraded to
// scrypt on their next successful login so the whole table migrates over time.
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "crypto";

const SCRYPT_PREFIX = "scrypt$";
const KEYLEN = 64;

export interface StoredPassword {
  password_hash: string;
  salt: string;
}

function legacyHash(salt: string, password: string): string {
  return createHash("sha256").update(salt + password + salt).digest("hex");
}

export function hashPassword(password: string): StoredPassword {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, KEYLEN).toString("hex");
  return { password_hash: `${SCRYPT_PREFIX}${salt}$${hash}`, salt };
}

export function verifyPassword(
  password: string,
  stored: { password_hash: string; salt: string }
): { ok: boolean; upgrade?: StoredPassword } {
  const storedHash = String(stored.password_hash || "");

  if (storedHash.startsWith(SCRYPT_PREFIX)) {
    const [, salt, hash] = storedHash.split("$");
    if (!salt || !hash) return { ok: false };
    try {
      const candidate = scryptSync(password, salt, KEYLEN);
      const a = Buffer.from(hash, "hex");
      if (a.length !== candidate.length) return { ok: false };
      return { ok: timingSafeEqual(a, candidate) };
    } catch {
      return { ok: false };
    }
  }

  // Legacy scheme — verify, and request an upgrade on success.
  const candidate = legacyHash(String(stored.salt || ""), password);
  try {
    const a = Buffer.from(candidate, "hex");
    const b = Buffer.from(storedHash, "hex");
    if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false };
    return { ok: true, upgrade: hashPassword(password) };
  } catch {
    return { ok: false };
  }
}
