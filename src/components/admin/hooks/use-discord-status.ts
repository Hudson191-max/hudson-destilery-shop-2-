"use client";
// Owner-only Discord link health:
//  - checks /api/admin/discord/check on first admin data load, then every
//    15 minutes; the owner can force a recheck by clicking the status dot
//  - shows a reminder when the invite link hasn't been updated in 30+ days
//    (timestamp stored in localStorage by the Discord modal save handler)
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import type { Role } from "../types";

export type DiscordStatus = null | boolean | "checking";

export interface DiscordInfo {
  guildName?: string | null;
  members?: number | null;
  expiresAt?: string | null;
}

export interface UseDiscordStatus {
  status: DiscordStatus;
  info: DiscordInfo;
  checkedAt: number | null;
  reminderShown: boolean;
  check: () => Promise<void>;
  /** Called after the Discord modal saves a new link: refresh the localStorage marker. */
  markSaved: () => void;
}

export function useDiscordStatus(
  role: Role | null,
  hasData: boolean
): UseDiscordStatus {
  const [status, setStatus] = useState<DiscordStatus>(null);
  const [info, setInfo] = useState<DiscordInfo>({});
  const [checkedAt, setCheckedAt] = useState<number | null>(null);
  const [reminderShown, setReminderShown] = useState(false);

  const check = useCallback(async () => {
    setStatus("checking");
    try {
      const res = await api<{
        valid: boolean;
        guildName?: string | null;
        approximateMembers?: number | null;
        expiresAt?: string | null;
        checkedAt: number;
      }>("/api/admin/discord/check");
      setStatus(res.valid);
      setInfo({
        guildName: res.guildName,
        members: res.approximateMembers,
        expiresAt: res.expiresAt,
      });
      setCheckedAt(res.checkedAt);
    } catch {
      // Don't toast on failure — it's a background check, not a user action.
      setStatus(null);
    }
  }, []);

  useEffect(() => {
    if (role !== "owner" || !hasData) return;
    // First check runs in a macrotask so the effect body itself performs no
    // synchronous state updates (react-hooks/set-state-in-effect).
    const first = window.setTimeout(() => void check(), 0);
    const interval = window.setInterval(() => {
      void check();
    }, 15 * 60 * 1000); // every 15 minutes
    return () => {
      window.clearTimeout(first);
      window.clearInterval(interval);
    };
  }, [role, hasData, check]);

  // ── Discord reminder (owner) ────────────────────────────────────────────
  // Show a yellow reminder if the discord link hasn't been updated in 30+ days.
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect
       -- localStorage is an external system; this is a read-once
       synchronisation on role change, not a cascading render. */
    if (role !== "owner") {
      setReminderShown(false);
      return;
    }
    try {
      const stored = window.localStorage.getItem("hd_discord_link_updated_at");
      if (!stored) {
        setReminderShown(false);
        return;
      }
      const updatedAt = parseInt(stored, 10);
      if (!Number.isFinite(updatedAt)) {
        setReminderShown(false);
        return;
      }
      const ageDays = Math.floor((Date.now() - updatedAt) / 86400000);
      setReminderShown(ageDays >= 30);
    } catch {
      setReminderShown(false);
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [role]);

  function markSaved() {
    try {
      window.localStorage.setItem(
        "hd_discord_link_updated_at",
        String(Date.now())
      );
      setReminderShown(false);
    } catch {
      // ignore storage failure
    }
    // Recheck the new link's validity immediately.
    void check();
  }

  return { status, info, checkedAt, reminderShown, check, markSaved };
}
