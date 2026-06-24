"use client";
// The Hudson Distillery — Staff admin panel.
// Faithful Next.js 16 / React 19 recode of the original index.html admin.
import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import {
  CURRENCY,
  LOGO_URL,
  orderTotal,
  type InventoryRow,
  type OrderLine,
  type OrderRow,
  type PublicOrder,
  type StockLogRow,
} from "@/lib/types";
import {
  CONFETTI_COLORS,
  formatTime,
  statusBadgeClass,
  stockBarColor,
  stockBarPct,
  stockStatusKind,
  type AdminData,
  type AdminOrder,
} from "./admin-helpers";
import {
  AddItemModal,
  DiscordModal,
  EditItemModal,
  NewOrderModal,
  RestockModal,
  SiteStatusModal,
  WhitelistModal,
} from "./modals";
import { OrderDetailModal } from "./order-detail";

type Role = "employee" | "owner" | "customer";
type Page = "dashboard" | "inventory" | "needed" | "stock-log" | "track" | "history";

interface ConfettiPiece {
  id: number;
  left: number;
  drift: number;
  delay: number;
  rotate: number;
  color: string;
}

export default function AdminApp() {
  // Lifecycle / auth
  const [booted, setBooted] = useState(false);
  const [loadingFirst, setLoadingFirst] = useState(true);
  const [user, setUser] = useState<string>("");
  const [role, setRole] = useState<Role | null>(null);

  // Data
  const [data, setData] = useState<AdminData | null>(null);
  const [refreshStatus, setRefreshStatus] = useState("Not refreshed");
  const [refreshing, setRefreshing] = useState(false);

  // Clock
  const [clock, setClock] = useState("");

  // Page nav
  const [page, setPage] = useState<Page>("dashboard");

  // Modals
  const [newOrderOpen, setNewOrderOpen] = useState(false);
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [editItemOpen, setEditItemOpen] = useState(false);
  const [editItemTarget, setEditItemTarget] = useState<InventoryRow | null>(null);
  const [restockOpen, setRestockOpen] = useState(false);
  const [restockPresetId, setRestockPresetId] = useState<number | string | null>(null);
  const [siteStatusOpen, setSiteStatusOpen] = useState(false);
  const [discordOpen, setDiscordOpen] = useState(false);
  const [whitelistOpen, setWhitelistOpen] = useState(false);
  const [orderDetailOpen, setOrderDetailOpen] = useState(false);
  const [orderDetailTargetId, setOrderDetailTargetId] = useState<number | string | null>(null);

  // Discord link reminder (owner): stored timestamp age >= 30 days.
  const [discordReminderShown, setDiscordReminderShown] = useState(false);

  // Discord link validity status (owner): green/red badge next to Discord button.
  // null = not checked yet, true = valid, false = expired/invalid, "checking" = in progress.
  type DiscordStatus = null | boolean | "checking";
  const [discordStatus, setDiscordStatus] = useState<DiscordStatus>(null);
  const [discordInfo, setDiscordInfo] = useState<{
    guildName?: string | null;
    members?: number | null;
    expiresAt?: string | null;
  }>({});
  const [discordCheckedAt, setDiscordCheckedAt] = useState<number | null>(null);

  // Track
  const [trackInput, setTrackInput] = useState("");
  const [trackResult, setTrackResult] = useState<PublicOrder | null | "not-found">(
    null
  );
  const [trackLoading, setTrackLoading] = useState(false);

  // Confetti
  const [confetti, setConfetti] = useState<ConfettiPiece[]>([]);
  const confettiId = useRef(0);

  // Login form
  const [loginRole, setLoginRole] = useState<Role>("employee");
  const [loginName, setLoginName] = useState("");
  const [loginPw, setLoginPw] = useState("");
  const [loginSubmitting, setLoginSubmitting] = useState(false);

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

  // ── Clock ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const tick = () =>
      setClock(new Date().toTimeString().slice(0, 8));
    tick();
    const t = window.setInterval(tick, 1000);
    return () => window.clearInterval(t);
  }, []);

  // ── Polling (employee/owner only) ───────────────────────────────────────
  // hasData flips true once on first successful load and stays true, so the
  // interval is created once per staff session (not on every data refresh).
  const [hasData, setHasData] = useState(false);

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

  // ── Discord link validity checker (owner only) ───────────────────────────
  // Checks on first admin data load, then every 15 minutes. Owner can also
  // force a recheck by clicking the status dot.
  const checkDiscordLink = useCallback(async () => {
    setDiscordStatus("checking");
    try {
      const res = await api<{
        valid: boolean;
        guildName?: string | null;
        approximateMembers?: number | null;
        expiresAt?: string | null;
        checkedAt: number;
      }>("/api/admin/discord/check");
      setDiscordStatus(res.valid);
      setDiscordInfo({
        guildName: res.guildName,
        members: res.approximateMembers,
        expiresAt: res.expiresAt,
      });
      setDiscordCheckedAt(res.checkedAt);
    } catch {
      // Don't toast on failure — it's a background check, not a user action.
      setDiscordStatus(null);
    }
  }, []);

  useEffect(() => {
    if (role !== "owner" || !hasData) return;
    void checkDiscordLink();
    const interval = window.setInterval(() => {
      void checkDiscordLink();
    }, 15 * 60 * 1000); // every 15 minutes
    return () => window.clearInterval(interval);
  }, [role, hasData, checkDiscordLink]);

  // ── Role application ────────────────────────────────────────────────────
  function applyRole(name: string, r: Role) {
    setUser(name);
    setRole(r);
    if (r === "customer") {
      setPage("track");
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

  // ── Login / logout ──────────────────────────────────────────────────────
  async function doLogin() {
    if (loginRole === "customer") {
      try {
        await api("/api/auth/login", {
          method: "POST",
          body: { role: "customer" },
        });
      } catch {
        // Customer login shouldn't fail, but be safe.
      }
      applyRole("Customer", "customer");
      return;
    }
    const name = loginName.trim();
    if (!name) {
      toast("Enter your name", "err");
      return;
    }
    if (!loginPw) {
      toast("Enter your password", "err");
      return;
    }
    setLoginSubmitting(true);
    try {
      const res = await api<{ user: string; role: string }>("/api/auth/login", {
        method: "POST",
        body: { role: loginRole, name, pw: loginPw },
      });
      const r = res.role as Role;
      applyRole(res.user, r);
    } catch (e) {
      const err = e as ApiError;
      toast(err.message || "Invalid credentials.", "err");
    } finally {
      setLoginSubmitting(false);
    }
  }

  async function doLogout() {
    try {
      await api("/api/auth/logout", { method: "POST" });
    } catch {
      // ignore
    }
    setUser("");
    setRole(null);
    setData(null);
    setPage("dashboard");
    setLoginName("");
    setLoginPw("");
    setLoginRole("employee");
    setRefreshStatus("Not refreshed");
    setTrackInput("");
    setTrackResult(null);
    setOrderDetailOpen(false);
    setOrderDetailTargetId(null);
    setHasData(false);
    setBooted(true);
    setLoadingFirst(false);
  }

  // ── Order status change ─────────────────────────────────────────────────
  const changeOrderStatus = useCallback(
    async (id: number | string, status: string) => {
      try {
        await api("/api/admin/order/status", {
          method: "POST",
          body: { id, status },
        });
        setOrderDetailOpen(false);
        setOrderDetailTargetId(null);
        await loadData(false);
      } catch (e) {
        const err = e as ApiError;
        toast("Status update failed", "err", err.detail || err.message);
      }
    },
    [loadData]
  );

  // ── Inventory delete ────────────────────────────────────────────────────
  async function deleteItem(item: InventoryRow) {
    if (!confirm(`Delete "${item.name}"?`)) return;
    try {
      await api(`/api/admin/inventory?id=${item.id}`, { method: "DELETE" });
      toast(`${item.name} removed from inventory`, "ok");
      await loadData(false);
    } catch (e) {
      const err = e as ApiError;
      toast("Delete failed", "err", err.detail || err.message);
    }
  }

  // ── Inventory toggle on/off sale (owner) ────────────────────────────────
  const toggleActive = useCallback(
    async (item: InventoryRow, nextActive: boolean) => {
      try {
        await api("/api/admin/inventory/toggle", {
          method: "POST",
          body: { id: item.id, active: nextActive },
        });
        toast(
          `${item.name} is now ${nextActive ? "for sale" : "hidden"}`,
          "ok"
        );
        await loadData(false);
      } catch (e) {
        const err = e as ApiError;
        toast("Toggle failed", "err", err.detail || err.message);
      }
    },
    [loadData]
  );

  // ── Export / import / reset (owner) ─────────────────────────────────────
  async function exportData() {
    try {
      const res = await api<{
        orders: OrderRow[];
        inventory: InventoryRow[];
        stockLog: StockLogRow[];
      }>("/api/admin/export");
      const blob = new Blob([JSON.stringify(res, null, 2)], {
        type: "application/json",
      });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "hudson-backup.json";
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      toast("Backup exported", "ok");
    } catch (e) {
      const err = e as ApiError;
      toast("Export failed", "err", err.detail || err.message);
    }
  }

  async function importFile(file: File) {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as {
        inventory?: unknown;
        orders?: unknown;
      };
      await api("/api/admin/import", {
        method: "POST",
        body: {
          inventory: Array.isArray(parsed.inventory) ? parsed.inventory : [],
          orders: Array.isArray(parsed.orders) ? parsed.orders : [],
        },
      });
      toast("Data imported successfully", "ok");
      await loadData(false);
    } catch (e) {
      const err = e as ApiError;
      toast("Import failed", "err", err.detail || err.message || "Check the file format.");
    }
  }

  async function resetData() {
    if (!confirm("Reset ALL data?")) return;
    try {
      await api("/api/admin/reset", { method: "POST" });
      toast("Data reset to defaults", "ok");
      await loadData(false);
    } catch (e) {
      const err = e as ApiError;
      toast("Reset failed", "err", err.detail || err.message);
    }
  }

  // ── Discord reminder (owner) ────────────────────────────────────────────
  // Show a yellow reminder if the discord link hasn't been updated in 30+ days.
  useEffect(() => {
    if (role !== "owner") {
      setDiscordReminderShown(false);
      return;
    }
    try {
      const stored = window.localStorage.getItem("hd_discord_link_updated_at");
      if (!stored) {
        setDiscordReminderShown(false);
        return;
      }
      const updatedAt = parseInt(stored, 10);
      if (!Number.isFinite(updatedAt)) {
        setDiscordReminderShown(false);
        return;
      }
      const ageDays = Math.floor((Date.now() - updatedAt) / 86400000);
      setDiscordReminderShown(ageDays >= 30);
    } catch {
      setDiscordReminderShown(false);
    }
  }, [role]);

  // ── Track order ─────────────────────────────────────────────────────────
  async function trackOrder() {
    const id = parseInt(trackInput, 10);
    if (!Number.isFinite(id) || id <= 0) {
      setTrackResult("not-found");
      return;
    }
    setTrackLoading(true);
    try {
      const res = await api<{ order: PublicOrder }>(
        `/api/public/order/track?id=${id}`
      );
      setTrackResult(res.order);
    } catch {
      setTrackResult("not-found");
    } finally {
      setTrackLoading(false);
    }
  }

  // ── Confetti ────────────────────────────────────────────────────────────
  function playConfetti() {
    const pieces: ConfettiPiece[] = [];
    for (let i = 0; i < 36; i++) {
      pieces.push({
        id: ++confettiId.current,
        left: Math.random() * 100,
        drift: Math.random() * 80 - 40,
        delay: Math.random() * 0.1,
        rotate: Math.random() * 360,
        color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      });
    }
    setConfetti(pieces);
    window.setTimeout(() => setConfetti([]), 1600);
  }

  // ── Derived data ────────────────────────────────────────────────────────
  const inventory = data?.inventory ?? [];
  const orders = data?.orders ?? [];
  const stockLog = data?.stockLog ?? [];
  const siteStatus = data?.siteStatus ?? { closed: false, message: "" };
  const discordLink = data?.discordLink ?? "https://discord.gg/anAmr5MQF";
  const discordWebhookUrl = data?.discordWebhookUrl ?? "";

  const isOwner = role === "owner";
  const isCustomer = role === "customer";

  // ── Render ──────────────────────────────────────────────────────────────
  if (loadingFirst || !booted) {
    return (
      <div className="loading-overlay">
        <div className="loading-spinner" />
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            color: "var(--text2)",
            letterSpacing: 1,
          }}
        >
          CONNECTING TO DATABASE...
        </div>
      </div>
    );
  }

  if (!role) {
    return (
      <>
        <div className="scanline" />
        <LoginScreen
          role={loginRole}
          setRole={setLoginRole}
          name={loginName}
          setName={setLoginName}
          pw={loginPw}
          setPw={setLoginPw}
          submitting={loginSubmitting}
          onSubmit={() => void doLogin()}
        />
      </>
    );
  }

  // Customer: only track page.
  const navItems: { id: Page; icon: string; label: string }[] = isCustomer
    ? [{ id: "track", icon: "🔍", label: "Track order" }]
    : [
        { id: "dashboard", icon: "📊", label: "Dashboard" },
        { id: "inventory", icon: "📦", label: "Inventory" },
        { id: "needed", icon: "🛒", label: "What we need" },
        { id: "stock-log", icon: "📝", label: "Stock log" },
        ...(isOwner ? [{ id: "history" as Page, icon: "🗂️", label: "History" }] : []),
      ];

  return (
    <>
      <div className="scanline" />
      {confetti.length > 0 ? (
        <div className="confetti-layer">
          {confetti.map((p) => (
            <div
              key={p.id}
              className="confetti-piece"
              style={
                {
                  left: `${p.left}vw`,
                  background: p.color,
                  transform: `rotate(${p.rotate}deg)`,
                  animationDelay: `${p.delay}s`,
                  "--drift": `${p.drift}px`,
                } as React.CSSProperties
              }
            />
          ))}
        </div>
      ) : null}

      <div className="shell">
        <header className="hd-header">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <img
              src={LOGO_URL}
              alt="The Hudson Distillery logo"
              style={{
                height: 44,
                width: 44,
                objectFit: "contain",
                borderRadius: 4,
              }}
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
            <div
              style={{
                fontFamily: "var(--font-head)",
                fontSize: 16,
                fontWeight: 700,
                letterSpacing: 3,
                color: "var(--accent)",
              }}
            >
              THE HUDSON{" "}
              <span style={{ color: "var(--text1)", fontWeight: 400 }}>
                DISTILLERY
              </span>
            </div>
          </div>
          <div className="header-right">
            <a
              href="?view=order"
              className="btn btn-accent btn-sm"
              onClick={(e) => {
                e.preventDefault();
                window.location.href = "?view=order";
              }}
            >
              🛒 Order now
            </a>
            <div className="header-tag">
              {isCustomer
                ? "TRACK ORDER"
                : `${user} [${(role || "").toUpperCase()}]`}
            </div>
            <div className="header-tag" id="clock">
              {clock}
            </div>
            <div className="header-tag" title="Auto-refreshes every 12 seconds and when this tab regains focus">
              <span
                className={
                  "live-dot" +
                  (refreshing
                    ? " pulsing"
                    : refreshStatus.startsWith("Refresh failed")
                    ? " bad"
                    : " ok")
                }
              />
              {refreshStatus}
            </div>
            {!isCustomer ? (
              <button
                className="btn btn-sm"
                onClick={() => void refreshData()}
                disabled={refreshing}
              >
                {refreshing ? "⟳ Refreshing…" : "⟳ Refresh"}
              </button>
            ) : null}
            {isOwner ? (
              <>
                <button
                  className={
                    "btn btn-sm" + (siteStatus.closed ? " btn-red" : "")
                  }
                  onClick={() => setSiteStatusOpen(true)}
                >
                  {siteStatus.closed ? "🛑 Orders Closed" : "🟢 Orders Open"}
                </button>
                <button
                  className="btn btn-sm"
                  onClick={() => setDiscordOpen(true)}
                  title={
                    discordStatus === true
                      ? `Discord link valid${
                          discordInfo.guildName
                            ? " — " + discordInfo.guildName
                            : ""
                        }${
                          discordInfo.members
                            ? " (" + discordInfo.members + " members)"
                            : ""
                        }`
                      : discordStatus === false
                      ? "Discord link is expired or invalid — click to replace"
                      : discordStatus === "checking"
                      ? "Checking Discord link…"
                      : "Discord link"
                  }
                >
                  🎮 Discord
                  {role === "owner" && (
                    <span
                      className={
                        "discord-status-dot" +
                        (discordStatus === true
                          ? " ok"
                          : discordStatus === false
                          ? " bad"
                          : discordStatus === "checking"
                          ? " checking"
                          : "")
                      }
                      onClick={(e) => {
                        e.stopPropagation();
                        if (discordStatus !== "checking") {
                          void checkDiscordLink();
                        }
                      }}
                      role="button"
                      tabIndex={0}
                      aria-label="Recheck Discord link status"
                    />
                  )}
                </button>
                <button
                  className="btn btn-sm"
                  onClick={() => setWhitelistOpen(true)}
                >
                  🔐 Whitelist
                </button>
                <button className="btn btn-sm btn-red" onClick={() => void resetData()}>
                  🗑 Reset
                </button>
                <button className="btn btn-sm" onClick={() => void exportData()}>
                  📤 Export
                </button>
                <button
                  className="btn btn-sm"
                  onClick={() => {
                    const input = document.getElementById(
                      "admin-import-file"
                    ) as HTMLInputElement | null;
                    if (input) input.click();
                  }}
                >
                  📥 Import
                </button>
                <input
                  id="admin-import-file"
                  type="file"
                  accept=".json"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void importFile(f);
                    e.target.value = "";
                  }}
                />
              </>
            ) : null}
            <button className="btn btn-sm" onClick={() => void doLogout()}>
              Logout
            </button>
          </div>
        </header>

        <aside className="hd-aside">
          {!isCustomer ? <div className="nav-group-label">Navigation</div> : null}
          {navItems.map((n) => (
            <button
              key={n.id}
              className={"nav-btn" + (page === n.id ? " active" : "")}
              onClick={() => setPage(n.id)}
            >
              <span className="nav-icon">{n.icon}</span>
              {n.label}
            </button>
          ))}
        </aside>

        <main className="hd-main">
          {page === "dashboard" ? (
            <DashboardPage
              orders={orders}
              inventory={inventory}
              isOwner={isOwner}
              discordReminderShown={discordReminderShown}
              onNewOrder={() => setNewOrderOpen(true)}
              onView={(o) => {
                setOrderDetailTargetId(o.id);
                setOrderDetailOpen(true);
              }}
              onChangeStatus={changeOrderStatus}
            />
          ) : null}
          {page === "inventory" ? (
            <InventoryPage
              inventory={inventory}
              isOwner={isOwner}
              onRestock={() => {
                setRestockPresetId(null);
                setRestockOpen(true);
              }}
              onAddItem={() => setAddItemOpen(true)}
              onQuickRestock={(id) => {
                setRestockPresetId(id);
                setRestockOpen(true);
              }}
              onEdit={(item) => {
                setEditItemTarget(item);
                setEditItemOpen(true);
              }}
              onDelete={(item) => void deleteItem(item)}
              onToggleActive={
                isOwner
                  ? (item, next) => void toggleActive(item, next)
                  : undefined
              }
            />
          ) : null}
          {page === "needed" ? (
            <NeededPage orders={orders} inventory={inventory} />
          ) : null}
          {page === "stock-log" ? (
            <StockLogPage
              stockLog={stockLog}
              onRestock={() => {
                setRestockPresetId(null);
                setRestockOpen(true);
              }}
            />
          ) : null}
          {page === "track" ? (
            <TrackPage
              input={trackInput}
              setInput={setTrackInput}
              result={trackResult}
              loading={trackLoading}
              onTrack={() => void trackOrder()}
            />
          ) : null}
          {page === "history" && isOwner ? (
            <HistoryPage orders={orders} />
          ) : null}
        </main>
      </div>

      {/* Modals */}
      <NewOrderModal
        open={newOrderOpen}
        inventory={inventory}
        onClose={() => setNewOrderOpen(false)}
        onCreated={() => void loadData(false)}
        onConfetti={playConfetti}
      />
      <AddItemModal
        open={addItemOpen}
        onClose={() => setAddItemOpen(false)}
        onDone={() => void loadData(false)}
      />
      <EditItemModal
        open={editItemOpen}
        item={editItemTarget}
        onClose={() => {
          setEditItemOpen(false);
          setEditItemTarget(null);
        }}
        onDone={() => void loadData(false)}
      />
      <RestockModal
        open={restockOpen}
        inventory={inventory}
        presetItemId={restockPresetId}
        onClose={() => {
          setRestockOpen(false);
          setRestockPresetId(null);
        }}
        onDone={() => void loadData(false)}
      />
      <SiteStatusModal
        open={siteStatusOpen}
        closed={siteStatus.closed}
        message={siteStatus.message}
        onClose={() => setSiteStatusOpen(false)}
        onSaved={(closed, message) => {
          setData((d) =>
            d ? { ...d, siteStatus: { closed, message } } : d
          );
        }}
      />
      <DiscordModal
        open={discordOpen}
        currentUrl={discordLink}
        currentWebhookUrl={discordWebhookUrl}
        onClose={() => setDiscordOpen(false)}
        onSaved={(url, webhookUrl) => {
          setData((d) =>
            d
              ? { ...d, discordLink: url, discordWebhookUrl: webhookUrl }
              : d
          );
          try {
            window.localStorage.setItem(
              "hd_discord_link_updated_at",
              String(Date.now())
            );
            setDiscordReminderShown(false);
          } catch {
            // ignore storage failure
          }
          // Recheck the new link's validity immediately.
          void checkDiscordLink();
        }}
      />
      <WhitelistModal open={whitelistOpen} onClose={() => setWhitelistOpen(false)} />
      <OrderDetailModal
        open={orderDetailOpen}
        order={
          orderDetailTargetId != null
            ? orders.find((o) => o.id === orderDetailTargetId) ?? null
            : null
        }
        inventory={inventory}
        onClose={() => {
          setOrderDetailOpen(false);
          setOrderDetailTargetId(null);
        }}
        onChangeStatus={changeOrderStatus}
        onEdited={() => void loadData(false)}
      />
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Login screen
// ═══════════════════════════════════════════════════════════════════════════
function LoginScreen({
  role,
  setRole,
  name,
  setName,
  pw,
  setPw,
  submitting,
  onSubmit,
}: {
  role: Role;
  setRole: (r: Role) => void;
  name: string;
  setName: (s: string) => void;
  pw: string;
  setPw: (s: string) => void;
  submitting: boolean;
  onSubmit: () => void;
}) {
  const isCustomer = role === "customer";
  return (
    <div className="login-screen">
      <div className="login-box">
        <img
          src={LOGO_URL}
          alt="The Hudson Distillery logo"
          style={{
            width: 160,
            height: 160,
            objectFit: "contain",
            marginBottom: 12,
          }}
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = "none";
          }}
        />
        <div className="login-sub">ACCESS CONTROL</div>
        {!isCustomer ? (
          <div className="form-group">
            <label>Employee name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name"
              maxLength={24}
              onKeyDown={(e) => {
                if (e.key === "Enter") onSubmit();
              }}
            />
          </div>
        ) : null}
        <div className="form-group">
          <label>Role</label>
          <div className="role-btns">
            <button
              className={"role-btn" + (role === "employee" ? " selected" : "")}
              onClick={() => setRole("employee")}
              type="button"
            >
              👷 Employee
            </button>
            <button
              className={"role-btn" + (role === "owner" ? " selected" : "")}
              onClick={() => setRole("owner")}
              type="button"
            >
              👑 Owner
            </button>
            <button
              className={"role-btn" + (role === "customer" ? " selected" : "")}
              onClick={() => setRole("customer")}
              type="button"
            >
              🔍 Track Order
            </button>
          </div>
        </div>
        {!isCustomer ? (
          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              placeholder="••••••••"
              onKeyDown={(e) => {
                if (e.key === "Enter") onSubmit();
              }}
            />
          </div>
        ) : null}
        <button
          className="btn btn-accent"
          style={{
            width: "100%",
            marginTop: 8,
            justifyContent: "center",
          }}
          onClick={onSubmit}
          disabled={submitting}
        >
          {submitting ? "ENTERING…" : "ENTER SHOP"}
        </button>
        <a
          href="?view=order"
          onClick={(e) => {
            e.preventDefault();
            window.location.href = "?view=order";
          }}
          style={{
            display: "block",
            width: "100%",
            textAlign: "center",
            marginTop: 8,
            padding: 8,
            background: "rgba(200,168,75,.1)",
            border: "1px solid rgba(200,168,75,.3)",
            borderRadius: 3,
            color: "var(--accent)",
            fontFamily: "var(--font-body)",
            fontSize: 13,
            fontWeight: 500,
            textDecoration: "none",
            cursor: "pointer",
          }}
        >
          🛒 Place an order
        </a>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Dashboard page
// ═══════════════════════════════════════════════════════════════════════════
function DashboardPage({
  orders,
  inventory,
  isOwner,
  discordReminderShown,
  onNewOrder,
  onView,
  onChangeStatus,
}: {
  orders: AdminOrder[];
  inventory: InventoryRow[];
  isOwner: boolean;
  discordReminderShown: boolean;
  onNewOrder: () => void;
  onView: (o: AdminOrder) => void;
  onChangeStatus: (id: number | string, status: string) => Promise<void>;
}) {
  const active = orders.filter(
    (o) => o.status !== "Done" && o.status !== "Cancelled"
  );
  const deliveryOrders = orders.filter(
    (o) => o.status === "Ready for Delivery"
  );
  const revenue = orders
    .filter((o) => o.status === "Done")
    .reduce((s, o) => s + (o.total ?? orderTotal(o.parsedLines)), 0);
  const waiting = orders.filter(
    (o) => o.status === "Waiting on Payment"
  ).length;
  const lowStock = inventory.filter((i) => i.stock <= 3).length;
  const revenueDisplay =
    revenue >= 1000 ? (revenue / 1000).toFixed(1) + "k" : String(revenue);

  return (
    <div>
      <div className="section-head">
        <div className="section-title">Dashboard</div>
        <button className="btn btn-accent" onClick={onNewOrder}>
          ＋ New order
        </button>
      </div>
      {isOwner && discordReminderShown ? (
        <div
          style={{
            marginBottom: 16,
            padding: "12px 14px",
            border: "1px solid rgba(212,160,23,.35)",
            borderRadius: 4,
            background: "rgba(212,160,23,.12)",
            color: "var(--text0)",
          }}
        >
          <strong>⚠ Discord link reminder:</strong> your invite link is over 30
          days old. Please update it soon.
        </div>
      ) : null}
      <div className="metrics">
        <div className="metric metric-blue">
          <div className="metric-label">Open orders</div>
          <div className="metric-value">{active.length}</div>
          <div className="metric-sub">preparing + waiting</div>
        </div>
        <div className="metric metric-accent">
          <div className="metric-label">Waiting payment</div>
          <div className="metric-value">{waiting}</div>
        </div>
        <div className="metric metric-green">
          <div className="metric-label">Revenue</div>
          <div className="metric-value">{revenueDisplay}</div>
          <div className="metric-sub">Roubles</div>
        </div>
        <div className="metric metric-red">
          <div className="metric-label">Low stock</div>
          <div className="metric-value">{lowStock}</div>
        </div>
      </div>
      <div className="card">
        <div className="card-head">
          <div className="card-title">Delivery queue</div>
        </div>
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Customer</th>
                <th>Items</th>
                <th>Total</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {deliveryOrders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="empty">
                    NO ORDERS READY FOR DELIVERY
                  </td>
                </tr>
              ) : (
                deliveryOrders.map((o) => (
                  <tr key={o.id}>
                    <td className="td-mono">#{o.id}</td>
                    <td className="td-name">{o.customer}</td>
                    <td
                      style={{
                        color: "var(--text2)",
                        fontSize: 12,
                        maxWidth: 180,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {o.parsedLines
                        .map((l) => l.name + (l.qty > 1 ? ` ×${l.qty}` : ""))
                        .join(", ")}
                    </td>
                    <td className="td-mono" style={{ color: "var(--accent)" }}>
                      {(o.total ?? orderTotal(o.parsedLines)).toLocaleString()}{" "}
                      {CURRENCY}
                    </td>
                    <td>
                      <span className={statusBadgeClass(String(o.status))}>
                        {String(o.status)}
                      </span>
                    </td>
                    <td style={{ color: "var(--text2)", fontSize: 12 }}>
                      {o.date || ""}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      <div className="card">
        <div className="card-head">
          <div className="card-title">Active orders</div>
        </div>
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Customer</th>
                <th>Items</th>
                <th>Total</th>
                <th>Status</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {active.length === 0 ? (
                <tr>
                  <td colSpan={7} className="empty">
                    NO ACTIVE ORDERS
                  </td>
                </tr>
              ) : (
                active.map((o) => {
                  const status = String(o.status);
                  return (
                    <tr key={o.id}>
                      <td className="td-mono">#{o.id}</td>
                      <td className="td-name">{o.customer}</td>
                      <td
                        style={{
                          color: "var(--text2)",
                          fontSize: 12,
                          maxWidth: 160,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {o.parsedLines
                          .map((l) => l.name + (l.qty > 1 ? ` ×${l.qty}` : ""))
                          .join(", ")}
                      </td>
                      <td className="td-mono" style={{ color: "var(--accent)" }}>
                        {(o.total ?? orderTotal(o.parsedLines)).toLocaleString()}{" "}
                        {CURRENCY}
                      </td>
                      <td>
                        <span className={statusBadgeClass(status)}>{status}</span>
                      </td>
                      <td style={{ color: "var(--text2)", fontSize: 12 }}>
                        {o.date || ""}
                      </td>
                      <td>
                        <div
                          style={{
                            display: "flex",
                            gap: 4,
                            flexWrap: "wrap",
                          }}
                        >
                          <button
                            className="btn btn-sm"
                            onClick={() => onView(o)}
                          >
                            👁 View
                          </button>
                          {status === "Preparing" || status === "Pending" ? (
                            <button
                              className="btn btn-sm btn-green"
                              onClick={(e) => {
                                e.stopPropagation();
                                void onChangeStatus(o.id, "Waiting on Payment");
                              }}
                            >
                              ▶ Payment
                            </button>
                          ) : null}
                          {status === "Waiting on Payment" ||
                          status === "Active" ||
                          status === "Ready for Delivery" ? (
                            <button
                              className="btn btn-sm btn-accent"
                              onClick={(e) => {
                                e.stopPropagation();
                                void onChangeStatus(o.id, "Done");
                              }}
                            >
                              ✓ Done
                            </button>
                          ) : null}
                          <button
                            className="btn btn-icon btn-sm btn-red"
                            onClick={(e) => {
                              e.stopPropagation();
                              void onChangeStatus(o.id, "Cancelled");
                            }}
                          >
                            ✕
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Inventory page
// ═══════════════════════════════════════════════════════════════════════════
function InventoryPage({
  inventory,
  isOwner,
  onRestock,
  onAddItem,
  onQuickRestock,
  onEdit,
  onDelete,
  onToggleActive,
}: {
  inventory: InventoryRow[];
  isOwner: boolean;
  onRestock: () => void;
  onAddItem: () => void;
  onQuickRestock: (id: number | string) => void;
  onEdit: (i: InventoryRow) => void;
  onDelete: (i: InventoryRow) => void;
  onToggleActive?: (i: InventoryRow, nextActive: boolean) => void;
}) {
  // An item is considered "for sale" unless `active` is explicitly false.
  // (Older rows created before the column existed report undefined/null.)
  const isForSale = (i: InventoryRow) => i.active !== false;

  return (
    <div>
      <div className="section-head">
        <div className="section-title">Inventory</div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn" onClick={onRestock}>
            📥 Log restock
          </button>
          {isOwner ? (
            <button className="btn btn-accent" onClick={onAddItem}>
              ＋ Add item
            </button>
          ) : null}
        </div>
      </div>
      <div className="card">
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Item name</th>
                <th>Category</th>
                <th>Price ({CURRENCY})</th>
                <th>Stock</th>
                <th>Status</th>
                <th>For sale</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {inventory.length === 0 ? (
                <tr>
                  <td colSpan={8} className="empty">
                    NO ITEMS
                  </td>
                </tr>
              ) : (
                inventory.map((i) => {
                  const kind = stockStatusKind(i.stock);
                  const forSale = isForSale(i);
                  return (
                    <tr
                      key={i.id}
                      style={
                        forSale
                          ? undefined
                          : { opacity: 0.55, background: "var(--bg2)" }
                      }
                    >
                      <td className="td-mono" style={{ color: "var(--text2)" }}>
                        {i.id}
                      </td>
                      <td className="td-name">
                        {i.name}
                        {!forSale ? (
                          <span
                            className="badge badge-out"
                            style={{ marginLeft: 8, fontSize: 10 }}
                          >
                            HIDDEN
                          </span>
                        ) : null}
                      </td>
                      <td style={{ color: "var(--text2)", fontSize: 12 }}>
                        {i.cat}
                      </td>
                      <td className="td-mono" style={{ color: "var(--accent)" }}>
                        {i.price.toLocaleString()}
                      </td>
                      <td>
                        <div className="sbar-wrap">
                          <div className="sbar">
                            <div
                              className="sbar-fill"
                              style={{
                                width: `${stockBarPct(i.stock)}%`,
                                background: stockBarColor(i.stock),
                              }}
                            />
                          </div>
                          <span className="td-mono" style={{ fontSize: 12 }}>
                            {i.stock}
                          </span>
                        </div>
                      </td>
                      <td>
                        <span className={`badge badge-${kind}`}>
                          {kind === "out"
                            ? "Out"
                            : kind === "low"
                              ? "Low"
                              : "OK"}
                        </span>
                      </td>
                      <td>
                        {onToggleActive ? (
                          <button
                            type="button"
                            role="switch"
                            aria-checked={forSale}
                            aria-label={
                              forSale
                                ? `Hide ${i.name} from public order page`
                                : `Show ${i.name} on public order page`
                            }
                            title={
                              forSale
                                ? "Click to hide from customers"
                                : "Click to make available for sale"
                            }
                            onClick={() => onToggleActive(i, !forSale)}
                            className="sale-toggle"
                            data-on={forSale ? "true" : "false"}
                          >
                            <span className="sale-toggle-knob" />
                            <span className="sale-toggle-label">
                              {forSale ? "On" : "Off"}
                            </span>
                          </button>
                        ) : forSale ? (
                          <span className="badge badge-ok">Yes</span>
                        ) : (
                          <span className="badge badge-out">No</span>
                        )}
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: 4 }}>
                          <button
                            className="btn btn-sm btn-green"
                            onClick={() => onQuickRestock(i.id)}
                          >
                            +
                          </button>
                          {isOwner ? (
                            <button
                              className="btn btn-sm"
                              onClick={() => onEdit(i)}
                            >
                              ✏
                            </button>
                          ) : null}
                          {isOwner ? (
                            <button
                              className="btn btn-icon btn-sm btn-red"
                              onClick={() => onDelete(i)}
                            >
                              🗑
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// "What we need" page
// ═══════════════════════════════════════════════════════════════════════════
function NeededPage({
  orders,
  inventory,
}: {
  orders: AdminOrder[];
  inventory: InventoryRow[];
}) {
  const needed: Record<
    number,
    { name: string; itemId: number; totalOrdered: number }
  > = {};
  const activeStatuses = [
    "Preparing",
    "Waiting on Payment",
    "Pending",
    "Active",
  ];
  orders
    .filter((o) => activeStatuses.includes(String(o.status)))
    .forEach((o) => {
      o.parsedLines.forEach((l: OrderLine) => {
        if (!needed[l.itemId]) {
          needed[l.itemId] = { name: l.name, itemId: l.itemId, totalOrdered: 0 };
        }
        needed[l.itemId].totalOrdered += l.qty;
      });
    });
  const rows = Object.values(needed);

  return (
    <div>
      <div className="section-head">
        <div className="section-title">What we need</div>
      </div>
      <div className="card">
        <div className="card-head">
          <div className="card-title">
            Items needed to complete all open orders
          </div>
        </div>
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th>In stock</th>
                <th>Total ordered</th>
                <th>Shortage</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="empty">
                    NOTHING NEEDED
                  </td>
                </tr>
              ) : (
                rows.map((r) => {
                  const item = inventory.find((i) => i.id === r.itemId);
                  const inStock = item ? item.stock : 0;
                  const shortage = Math.max(0, r.totalOrdered - inStock);
                  return (
                    <tr key={r.itemId}>
                      <td className="td-name">{r.name}</td>
                      <td
                        className="td-mono"
                        style={{
                          color:
                            inStock <= 0
                              ? "var(--red)"
                              : inStock <= 3
                                ? "var(--yellow)"
                                : "var(--green)",
                        }}
                      >
                        {inStock}
                      </td>
                      <td className="td-mono">{r.totalOrdered}</td>
                      <td>
                        {shortage > 0 ? (
                          <span className="badge badge-cancelled">
                            Need {shortage} more
                          </span>
                        ) : (
                          <span className="badge badge-done">✓ Enough</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Stock log page
// ═══════════════════════════════════════════════════════════════════════════
function StockLogPage({
  stockLog,
  onRestock,
}: {
  stockLog: StockLogRow[];
  onRestock: () => void;
}) {
  return (
    <div>
      <div className="section-head">
        <div className="section-title">Stock log</div>
        <button className="btn" onClick={onRestock}>
          📥 Log restock
        </button>
      </div>
      <div className="card">
        <div id="log-list">
          {stockLog.length === 0 ? (
            <div className="empty">NO LOG ENTRIES</div>
          ) : (
            stockLog.map((e) => (
              <div className="log-entry" key={e.id}>
                <div className="log-time">
                  {e.date || ""}
                  <br />
                  {e.ts || ""}
                </div>
                <div className={`log-dot log-dot-${e.type}`} />
                <div
                  className="log-text"
                  dangerouslySetInnerHTML={{
                    __html:
                      e.text +
                      ` <span class="log-who">${e.who || ""}</span>`,
                  }}
                />
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Track order page
// ═══════════════════════════════════════════════════════════════════════════
function TrackPage({
  input,
  setInput,
  result,
  loading,
  onTrack,
}: {
  input: string;
  setInput: (s: string) => void;
  result: PublicOrder | null | "not-found";
  loading: boolean;
  onTrack: () => void;
}) {
  return (
    <div>
      <div className="section-head">
        <div className="section-title">Track your order</div>
      </div>
      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        <div className="card" style={{ padding: 24 }}>
          <div className="form-group" style={{ marginBottom: 12 }}>
            <label>Order number</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="number"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="e.g. 1002"
                onKeyDown={(e) => {
                  if (e.key === "Enter") onTrack();
                }}
              />
              <button
                className="btn btn-accent"
                onClick={onTrack}
                disabled={loading}
              >
                {loading ? "🔍 Tracking…" : "🔍 Track"}
              </button>
            </div>
          </div>
          <div id="track-result">
            {result === null ? null : result === "not-found" ? (
              <div
                style={{
                  textAlign: "center",
                  padding: 24,
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                  color: "var(--red)",
                }}
              >
                ❌ Order #{input || "?"} not found.
              </div>
            ) : (
              <TrackResult order={result} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function TrackResult({ order }: { order: PublicOrder }) {
  const steps = [
    {
      key: "Preparing",
      label: "Preparing",
      icon: "⚙️",
      desc: "Your order is being prepared",
    },
    {
      key: "Waiting on Payment",
      label: "Ready for pickup",
      icon: "📦",
      desc: "Your order is ready to be collected or delivered",
    },
    {
      key: "Done",
      label: "Completed",
      icon: "✅",
      desc: "Your order is complete",
    },
  ];
  const isCancelled = order.status === "Cancelled";
  const statusIndex = steps.findIndex(
    (s) =>
      s.key === order.status ||
      (order.status === "Pending" && s.key === "Preparing") ||
      (order.status === "Active" && s.key === "Waiting on Payment")
  );

  return (
    <div
      style={{
        borderTop: "1px solid var(--border)",
        paddingTop: 20,
        marginTop: 4,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <div>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              color: "var(--text2)",
              letterSpacing: 1,
            }}
          >
            ORDER
          </div>
          <div
            style={{
              fontFamily: "var(--font-head)",
              fontSize: 22,
              fontWeight: 700,
              color: "var(--accent)",
            }}
          >
            #{order.id}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              color: "var(--text2)",
              letterSpacing: 1,
            }}
          >
            CUSTOMER
          </div>
          <div style={{ fontWeight: 600, color: "var(--text0)" }}>
            {order.customer}
          </div>
        </div>
      </div>
      {isCancelled ? (
        <div
          style={{
            background: "rgba(224,92,92,.1)",
            border: "1px solid rgba(224,92,92,.3)",
            borderRadius: 4,
            padding: 16,
            textAlign: "center",
            marginBottom: 16,
          }}
        >
          <div style={{ fontSize: 24, marginBottom: 6 }}>❌</div>
          <div
            style={{
              fontFamily: "var(--font-head)",
              fontSize: 18,
              color: "var(--red)",
            }}
          >
            Order Cancelled
          </div>
        </div>
      ) : (
        steps.map((s, i) => {
          const done = !isCancelled && i < statusIndex;
          const current = !isCancelled && i === statusIndex;
          const color = done
            ? "var(--green)"
            : current
              ? "var(--accent)"
              : "var(--border2)";
          const textColor = done
            ? "var(--green)"
            : current
              ? "var(--accent)"
              : "var(--text2)";
          return (
            <div
              key={s.key}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 12,
                marginBottom: 16,
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  border: `2px solid ${color}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 15,
                  flexShrink: 0,
                }}
              >
                {done ? "✓" : s.icon}
              </div>
              <div style={{ paddingTop: 4 }}>
                <div
                  style={{
                    fontFamily: "var(--font-head)",
                    fontSize: 15,
                    fontWeight: 600,
                    color: textColor,
                  }}
                >
                  {s.label}
                </div>
                <div style={{ fontSize: 12, color: "var(--text2)" }}>
                  {s.desc}
                </div>
              </div>
            </div>
          );
        })
      )}
      <div className="order-lines">
        {order.lines.map((l, idx) => (
          <div className="order-line" key={idx}>
            <span className="order-line-name">{l.name}</span>
            <span style={{ color: "var(--text2)", fontSize: 12 }}>
              ×{l.qty}
            </span>
            <span className="order-line-price">
              {(l.qty * l.price).toLocaleString()} {CURRENCY}
            </span>
          </div>
        ))}
        <div
          className="order-line"
          style={{
            borderTop: "1px solid var(--border)",
            paddingTop: 8,
            marginTop: 4,
          }}
        >
          <span className="order-line-name" style={{ fontWeight: 600 }}>
            Total
          </span>
          <span
            className="order-line-price"
            style={{
              fontSize: 15,
              color: "var(--accent)",
              fontWeight: 600,
            }}
          >
            {order.total.toLocaleString()} {CURRENCY}
          </span>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// History page (owner)
// ═══════════════════════════════════════════════════════════════════════════
function HistoryPage({ orders }: { orders: AdminOrder[] }) {
  const done = orders.filter(
    (o) => o.status === "Done" || o.status === "Cancelled"
  );
  return (
    <div>
      <div className="section-head">
        <div className="section-title">Order history</div>
      </div>
      <div className="card">
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Customer</th>
                <th>Items</th>
                <th>Total</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {done.length === 0 ? (
                <tr>
                  <td colSpan={6} className="empty">
                    NO HISTORY
                  </td>
                </tr>
              ) : (
                done.map((o) => (
                  <tr key={o.id}>
                    <td className="td-mono">#{o.id}</td>
                    <td className="td-name">{o.customer}</td>
                    <td style={{ color: "var(--text2)", fontSize: 12 }}>
                      {o.parsedLines
                        .map((l) => l.name + (l.qty > 1 ? ` ×${l.qty}` : ""))
                        .join(", ")}
                    </td>
                    <td className="td-mono" style={{ color: "var(--accent)" }}>
                      {(o.total ?? orderTotal(o.parsedLines)).toLocaleString()}{" "}
                      {CURRENCY}
                    </td>
                    <td>
                      <span className={statusBadgeClass(String(o.status))}>
                        {String(o.status)}
                      </span>
                    </td>
                    <td style={{ color: "var(--text2)", fontSize: 12 }}>
                      {o.date || ""}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
