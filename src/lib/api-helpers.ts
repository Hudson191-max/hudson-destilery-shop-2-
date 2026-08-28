import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { getSession, type SessionPayload, type Role } from "./auth";

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

/**
 * JSON response with ETag revalidation support.
 *
 * The admin panel polls /api/admin/data every 12s and the chat panel polls
 * /api/admin/chat/messages every 2s. Most polls return byte-identical data,
 * so we hash the body once and let the browser's HTTP cache do conditional
 * requests: the client automatically sends `If-None-Match`, and unchanged
 * data costs a ~50-byte 304 instead of the full JSON payload.
 *
 * `Cache-Control: no-cache` means "store, but revalidate every time" — the
 * response is never served stale, which keeps stock/status updates correct.
 */
export function etagJson(
  req: Request,
  data: unknown,
  cacheControl = "private, no-cache"
) {
  const body = JSON.stringify(data);
  const etag = `"${createHash("sha1").update(body).digest("base64url")}"`;
  const headers: Record<string, string> = {
    ETag: etag,
    "Cache-Control": cacheControl,
    Vary: "Cookie",
  };
  const inm = req.headers.get("if-none-match");
  // The browser echoes the stored ETag (possibly as a comma list with W/ forms).
  if (inm && inm.split(",").some((t) => t.trim() === etag)) {
    return new NextResponse(null, { status: 304, headers });
  }
  return new NextResponse(body, {
    status: 200,
    headers: { ...headers, "Content-Type": "application/json; charset=utf-8" },
  });
}

export function errorJson(message: string, status = 400, detail?: string) {
  return NextResponse.json(
    { error: message, ...(detail ? { detail } : {}) },
    { status }
  );
}

export async function requireStaff(): Promise<SessionPayload | null> {
  const s = await getSession();
  if (!s) return null;
  if (s.role !== "employee" && s.role !== "owner") return null;
  return s;
}

export async function requireOwner(): Promise<SessionPayload | null> {
  const s = await requireStaff();
  if (!s || s.role !== "owner") return null;
  return s;
}

export function isOwner(s: SessionPayload | null): s is SessionPayload & {
  role: "owner";
} {
  return !!s && s.role === "owner";
}

export function roleLabel(role: Role): string {
  return role === "customer" ? "TRACK ORDER" : role.toUpperCase();
}
