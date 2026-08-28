"use client";
// Session boot + admin data lifecycle for the admin panel:
//  - checks /api/auth/me on mount and applies the restored session
//  - loads GET /api/admin/data
//  - polls every 12s for staff (owner/employee) once data has loaded,
//    and immediately refreshes when the tab regains focus
//  - tracks the "Last updated / Live update" header status
// Extracted verbatim from the original admin-app.tsx — same behaviour,
// same toasts, same timings.
import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { api, ApiError } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { formatTime, type AdminData } from "../admin-helpers";
import type { Role } from "../types";

export interface UseAdminData {
  booted: boolean;
  loadingFirst: boolean;
  user: string;
  role: Role | null;
  data: AdminData | null;
  setData: Dispatch<SetStateAction<AdminData | null>>;
  refreshStatus: string;
  refreshing: boolean;
  hasData: boolean;
  /** Apply a (possibly restored) session. Customer page switching stays with the caller. */
  applyRole: (name: string, r: Role) => void;
  /** Clear session-owned state (called from doLogout). */
  resetSession: () => void;
  loadData: (isPoll: boolean) => Promise<void>;
  refreshData: () => Promise<void>;
}

export function useAdminData(): UseAdminData {
  // Lifecycle / auth
  const [booted, setBooted] = useState(false);
  const [loadingFirst, setLoadingFirst] = useState(true);
  const [user, setUser] = useState<string>("");
  const [role, setRole] = useState<Role | null>(null);

  // Data
  const [data, setData] = useState<AdminData | null>(null);
  const [refreshStatus, setRefreshStatus] = useState("Not refreshed");
  const [refreshing, setRefreshing] = useState(false);

  // hasData flips true once on first successful load and stays true, so the
  // polling interval is created once per staff session (not on every refresh).
  const [hasData, setHasData] = useState(false);

  // ── Boot: check session ─────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api<{ session: { user: string; role: string } | null }>(
          "/api/auth/me"
        );
        if (cancelled) return;
        if (res.session && res.session.user && res.session.role) {
          const r = res.session.role as Role;
          applyRole(res.session.user, r);
        } else {
          setLoadingFirst(false);
          setBooted(true);
        }
      } catch {
        if (!cancelled) {
          setLoadingFirst(false);
          setBooted(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadData = useCallback(async (isPoll: boolean) => {
    if (!isPoll) {
      setRefreshing(true);
      setRefreshStatus("Refreshing…");
    }
    try {
      const res = await api<AdminData>("/api/admin/data");
      setData(res);
      setHasData(true);
      const now = Date.now();
      setRefreshStatus(
        isPoll
          ? "Live update " + formatTime(now)
          : "Last updated " + formatTime(now)
      );
      if (!isPoll) {
        setLoadingFirst(false);
        setBooted(true);
      }
    } catch (e) {
      const err = e as ApiError;
      if (!isPoll) {
        setLoadingFirst(false);
        setBooted(true);
        if (err.status === 401) {
          // Session expired — back to login.
          setRole(null);
          setUser("");
          setHasData(false);
          toast("Session expired. Please log in again.", "err");
        } else {
          toast("Failed to load admin data", "err", err.detail || err.message);
        }
      } else {
        setRefreshStatus("Refresh failed");
      }
    } finally {
      if (!isPoll) setRefreshing(false);
    }
  }, []);

  // ── Polling (employee/owner only) ───────────────────────────────────────
  useEffect(() => {
    if (!role || role === "customer" || !hasData) return;
    const interval = window.setInterval(() => {
      void loadData(true);
    }, 12000);
    // ── Auto-refresh when the tab regains focus ───────────────────────────
    // Staff often switch away from the admin tab and back — immediately fetch
    // fresh data on focus instead of waiting for the next 12s tick.
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void loadData(true);
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [role, hasData, loadData]);

  // ── Role application ────────────────────────────────────────────────────
  function applyRole(name: string, r: Role) {
    setUser(name);
    setRole(r);
    if (r === "customer") {
      setLoadingFirst(false);
      setBooted(true);
    } else {
      // Staff: load data before hiding overlay.
      void loadData(false);
    }
  }

  // ── Manual refresh ──────────────────────────────────────────────────────
  async function refreshData() {
    if (refreshing) return;
    setRefreshing(true);
    setRefreshStatus("Refreshing…");
    try {
      await loadData(false);
      toast("Data refreshed successfully", "ok");
    } catch {
      toast("Refresh failed", "err");
    }
  }

  // ── Logout reset (hook-owned state only) ────────────────────────────────
  function resetSession() {
    setUser("");
    setRole(null);
    setData(null);
    setRefreshStatus("Not refreshed");
    setHasData(false);
    setBooted(true);
    setLoadingFirst(false);
  }

  return {
    booted,
    loadingFirst,
    user,
    role,
    data,
    setData,
    refreshStatus,
    refreshing,
    hasData,
    applyRole,
    resetSession,
    loadData,
    refreshData,
  };
}
