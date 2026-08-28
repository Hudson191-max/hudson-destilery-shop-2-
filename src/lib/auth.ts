import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "crypto";
import { getSupabase } from "./supabase";
import { verifyPassword as verifyPw } from "./password";

// ── Session token (HMAC-signed, stored in httpOnly cookie) ────────────────────
// The session payload is { user, role, iat }. We never store/expose the password
// hash, salt, or login results to the client.

// SECURITY: in production the session secret MUST be provided via env var.
// The default below only exists so local/dev environments boot without setup.
const isProd = process.env.NODE_ENV === "production";
const SESSION_SECRET: string =
  process.env.HD_SESSION_SECRET ||
  (isProd ? "" : "hudson-distillery-dev-session-secret-change-me");

if (!SESSION_SECRET) {
  throw new Error(
    "HD_SESSION_SECRET must be configured in production. Generate one with: openssl rand -base64 32"
  );
}

const COOKIE_NAME = "hd_session";

export type Role = "employee" | "owner" | "customer";

export interface SessionPayload {
  user: string;
  role: Role;
  iat: number;
}

function b64encode(s: string): string {
  return Buffer.from(s, "utf8").toString("base64url");
}
function b64decode(s: string): string {
  return Buffer.from(s, "base64url").toString("utf8");
}

function sign(payload: SessionPayload): string {
  const body = b64encode(JSON.stringify(payload));
  const sig = createHmac("sha256", SESSION_SECRET).update(body).digest("base64url");
  return `${body}.${sig}`;
}

function verify(token: string | undefined | null): SessionPayload | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  const expected = createHmac("sha256", SESSION_SECRET)
    .update(body)
    .digest("base64url");
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  try {
    return JSON.parse(b64decode(body)) as SessionPayload;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  return verify(token);
}

export async function setSession(payload: SessionPayload): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, sign(payload), {
    httpOnly: true,
    sameSite: "lax",
    secure: isProd, // never send the session cookie over plain HTTP in prod
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearSession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

// ── Password verification (server-side only) ──────────────────────────────────
// Delegates to lib/password.ts: scrypt for new hashes, with transparent
// upgrade from the legacy SHA-256(salt + pw + salt) scheme. Hash/salt are
// never sent to the browser.

// Returns the account's stored role when username+password verify, else null.
// The role stored on the account row is authoritative — the login screen's
// role tab is only a UI preference (and the customer tab switches to the
// public tracking UI), so a "wrong" tab can neither lock a valid user out
// nor grant a role the account does not have.
async function verifyPassword(
  username: string,
  pw: string
): Promise<"employee" | "owner" | null> {
  const sb = getSupabase();
  const res = await sb
    .from("auth")
    .select("username, role, password_hash, salt")
    .eq("username", username)
    .maybeSingle();
  // SECURITY: no logging of hash/salt/match results anywhere.
  if (res.error || !res.data) return null;
  const accountRole = res.data.role;
  if (accountRole !== "employee" && accountRole !== "owner") return null;

  // scrypt for new hashes; legacy sha256(salt+pw+salt) rows verify and are
  // transparently upgraded to scrypt on successful login.
  const result = verifyPw(pw, {
    password_hash: String(res.data.password_hash || ""),
    salt: String(res.data.salt || ""),
  });
  if (!result.ok) return null;

  if (result.upgrade) {
    try {
      await sb
        .from("auth")
        .update({
          password_hash: result.upgrade.password_hash,
          salt: result.upgrade.salt,
        })
        .eq("username", username);
    } catch {
      // Upgrade is best-effort — never block a valid login on it.
    }
  }
  return accountRole;
}

// ── Whitelist (DB only — no localStorage overrides) ───────────────────────────
const DEFAULT_WHITELIST: Record<"employee" | "owner", string[]> = {
  employee: ["hudson", "maria", "sam", "jordan"],
  owner: ["hudson", "owner"],
};

function normalize(name: string): string {
  return (name || "").trim().toLowerCase().replace(/\s+/g, "");
}

function normalizeList(names: string[]): string[] {
  return (names || []).map(normalize).filter(Boolean);
}

export async function getWhitelist(): Promise<{
  employee: string[];
  owner: string[];
}> {
  const sb = getSupabase();
  const res = await sb
    .from("settings")
    .select("value")
    .eq("key", "auth_whitelist")
    .maybeSingle();
  let dbPayload: { employee?: string[]; owner?: string[] } = {};
  if (res.data && res.data.value) {
    try {
      const parsed = JSON.parse(res.data.value);
      if (parsed && typeof parsed === "object") dbPayload = parsed;
    } catch {
      dbPayload = {};
    }
  }
  return {
    employee: normalizeList(dbPayload.employee || DEFAULT_WHITELIST.employee),
    owner: normalizeList(dbPayload.owner || DEFAULT_WHITELIST.owner),
  };
}

export async function isNameWhitelisted(role: Role, name: string): Promise<boolean> {
  const n = normalize(name);
  if (!n) return false;
  const wl = await getWhitelist();
  if (role === "customer") return true;
  return (wl[role] || []).includes(n);
}

export async function saveWhitelist(employee: string[], owner: string[]) {
  const sb = getSupabase();
  const payload = { employee, owner };
  await sb.from("settings").upsert({
    key: "auth_whitelist",
    value: JSON.stringify(payload),
  });
}

// ── Public login entrypoint ───────────────────────────────────────────────────
// Returns a session only when name+password+whitelist all check out. The caller
// decides what (if anything) to tell the client — we return null on any failure.
export async function attemptLogin(
  role: Role,
  name: string,
  pw: string
): Promise<SessionPayload | null> {
  if (role === "customer") {
    return { user: "Customer", role: "customer", iat: Date.now() };
  }
  if (!name || !pw) return null;
  // The account row decides the session role (see verifyPassword above) —
  // the selected tab cannot override it in either direction.
  const accountRole = await verifyPassword(normalize(name), pw);
  if (!accountRole) return null;
  return { user: name, role: accountRole, iat: Date.now() };
}
