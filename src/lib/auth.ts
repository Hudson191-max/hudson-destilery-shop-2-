import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "crypto";
import { getSupabase } from "./supabase";

// ── Session token (HMAC-signed, stored in httpOnly cookie) ────────────────────
// The session payload is { user, role, iat }. We never store/expose the password
// hash, salt, or login results to the client.

const SESSION_SECRET =
  process.env.HD_SESSION_SECRET ||
  "hudson-distillery-dev-session-secret-change-me";

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
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearSession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

// ── Password verification (server-side only) ──────────────────────────────────
// Mirrors the client-side SHA-256(salt + pw + salt) scheme used by the original,
// but the hash/salt are never sent to the browser.

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function verifyPassword(
  username: string,
  role: Exclude<Role, "customer">,
  pw: string
): Promise<boolean> {
  const sb = getSupabase();
  const res = await sb
    .from("auth")
    .select("role, password_hash, salt")
    .eq("username", username)
    .maybeSingle();
  // SECURITY: no logging of hash/salt/match results anywhere.
  if (res.error || !res.data) return false;
  if (String(res.data.role) !== role) return false;
  const stored = String(res.data.password_hash || "");
  const salt = String(res.data.salt || "");
  const hash = await sha256Hex(salt + pw + salt);
  if (!stored || !hash) return false;
  try {
    const a = Buffer.from(hash);
    const b = Buffer.from(stored);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
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
  const ok = await verifyPassword(normalize(name), role, pw);
  if (!ok) return null;
  return { user: name, role, iat: Date.now() };
}
