import { NextResponse } from "next/server";
import { getSession, type SessionPayload, type Role } from "./auth";

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
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
