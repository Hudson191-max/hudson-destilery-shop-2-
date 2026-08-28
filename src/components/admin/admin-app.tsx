"use client";
// The Hudson Distillery — Staff admin panel.
// Faithful Next.js 16 / React 19 recode of the original index.html admin.
//
// This file is the composing parent: it owns the shared state (session,
// page nav, modal open flags, track form, data mutations) and renders the
// extracted pieces:
//   layout/    → login screen, header (theme toggle + user chip), sidebar
//   pages/     → dashboard, inventory, needed, stock log, track, history,
//                payroll
//   components/→ confetti, sort header, status badge, stock bar, touch consts
//   hooks/     → use-admin-data, use-clock, use-discord-status,
//                use-sortable-orders
//   modals/    → one file per modal (barrel: modals/index.ts)
import { useState } from "react";
import { api, ApiError } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import {
  type InventoryRow,
  type OrderRow,
  type PublicOrder,
  type StockLogRow,
} from "@/lib/types";
import {
  AddItemModal,
  AccountModal,
  ChangePasswordModal,
  DiscordModal,
  EditItemModal,
  NewOrderModal,
  RestockModal,
  SiteStatusModal,
  WhitelistModal,
} from "./modals";
import { OrderDetailModal } from "./order-detail";
import { ChatPanel } from "./chat-panel";
import { AdminHeader } from "./layout/admin-header";
import { AdminSidebar } from "./layout/admin-sidebar";
import { LoginScreen } from "./layout/login-screen";
import { DashboardPage } from "./pages/dashboard-page";
import { InventoryPage } from "./pages/inventory-page";
import { NeededPage } from "./pages/needed-page";
import { StockLogPage } from "./pages/stock-log-page";
import { TrackPage } from "./pages/track-page";
import { HistoryPage } from "./pages/history-page";
import { PayrollPage } from "./pages/payroll-page";
import { ConfettiLayer, useConfetti } from "./components/confetti";
import { useAdminData } from "./hooks/use-admin-data";
import { useClock } from "./hooks/use-clock";
import { useDiscordStatus } from "./hooks/use-discord-status";
import { useOrderAlerts } from "./hooks/use-order-alerts";
import { playNewOrderChime } from "@/lib/chime";
import { buildNavItems, type Page, type Role } from "./types";

export default function AdminApp() {
  // ── Session / data lifecycle (boot, polling, refresh) ────────────────────
  const {
    booted,
    loadingFirst,
    user,
    role,
    data,
    setData,
    refreshStatus,
    refreshing,
    hasData,
    applyRole: applySessionRole,
    resetSession,
    loadData,
    refreshData,
  } = useAdminData();
  const clock = useClock();
  const discord = useDiscordStatus(role, hasData);
  const { pieces: confettiPieces, play: playConfetti } = useConfetti();

  // ── Page nav ─────────────────────────────────────────────────────────────
  const [page, setPage] = useState<Page>("dashboard");

  // ── Modals ───────────────────────────────────────────────────────────────
  const [newOrderOpen, setNewOrderOpen] = useState(false);
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [editItemOpen, setEditItemOpen] = useState(false);
  const [editItemTarget, setEditItemTarget] = useState<InventoryRow | null>(null);
  const [restockOpen, setRestockOpen] = useState(false);
  const [restockPresetId, setRestockPresetId] = useState<number | string | null>(null);
  const [siteStatusOpen, setSiteStatusOpen] = useState(false);
  const [discordOpen, setDiscordOpen] = useState(false);
  const [whitelistOpen, setWhitelistOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [orderDetailOpen, setOrderDetailOpen] = useState(false);
  const [orderDetailTargetId, setOrderDetailTargetId] = useState<number | string | null>(null);
  const [changePwOpen, setChangePwOpen] = useState(false);

  // ── Login form ───────────────────────────────────────────────────────────
  const [loginRole, setLoginRole] = useState<Role>("employee");
  const [loginName, setLoginName] = useState("");
  const [loginPw, setLoginPw] = useState("");
  const [loginSubmitting, setLoginSubmitting] = useState(false);

  // ── Track ────────────────────────────────────────────────────────────────
  const [trackInput, setTrackInput] = useState("");
  const [trackResult, setTrackResult] = useState<PublicOrder | null | "not-found">(
    null
  );
  const [trackLoading, setTrackLoading] = useState(false);

  // ── Role application (customer also switches to the track page) ──────────
  function applyRole(name: string, r: Role) {
    if (r === "customer") setPage("track");
    applySessionRole(name, r);
  }

  // ── Login / logout ───────────────────────────────────────────────────────
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

  function doLogout() {
    void api("/api/auth/logout", { method: "POST" }).catch(() => {
      // ignore
    });
    resetSession();
    setPage("dashboard");
    setLoginName("");
    setLoginPw("");
    setLoginRole("employee");
    setTrackInput("");
    setTrackResult(null);
    setOrderDetailOpen(false);
    setOrderDetailTargetId(null);
  }

  // ── Order status change ──────────────────────────────────────────────────
  async function changeOrderStatus(id: number | string, status: string) {
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
  }

  // ── Inventory delete ─────────────────────────────────────────────────────
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

  // ── Inventory toggle on/off sale (owner) ─────────────────────────────────
  async function toggleActive(item: InventoryRow, nextActive: boolean) {
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
  }

  // ── Export / import / reset (owner) ──────────────────────────────────────
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

  // ── Track order ──────────────────────────────────────────────────────────
  function trackOrder() {
    const id = parseInt(trackInput, 10);
    if (!Number.isFinite(id) || id <= 0) {
      setTrackResult("not-found");
      return;
    }
    setTrackLoading(true);
    try {
      const found = (data?.orders ?? []).find((o) => Number(o.id) === id);
      setTrackResult(
        found
          ? {
              id: found.id,
              customer: found.customer,
              status: String(found.status || "Preparing"),
              date: found.date,
              lines: found.parsedLines,
              total: found.total,
            }
          : "not-found"
      );
    } catch {
      setTrackResult("not-found");
    } finally {
      setTrackLoading(false);
    }
  }

  // ── Derived data ─────────────────────────────────────────────────────────
  const inventory = data?.inventory ?? [];
  const orders = data?.orders ?? [];

  // ── New-order alerts (toast + chime + sidebar badge) ────────────────────
  const isStaff = !!role && role !== "customer";
  // Alerts arm only once real data has loaded — otherwise the empty pre-load
  // orders array would be baselined and every real order would count as new.
  const orderAlerts = useOrderAlerts(orders, isStaff && hasData, (o) => {
    playNewOrderChime();
    const total = (o as { total?: number }).total;
    toast(
      `🔔 New order #${o.id} — ${o.customer}`,
      "ok",
      typeof total === "number"
        ? `${total.toLocaleString()} $ · review it on the dashboard`
        : "Review it on the dashboard"
    );
  });

  function navigateTo(target: Page) {
    if (target === "dashboard") orderAlerts.ackAll();
    setPage(target);
  }
  const stockLog = data?.stockLog ?? [];
  const siteStatus =
    data?.siteStatus ?? { closed: false, maintenance: false, message: "" };
  const discordLink = data?.discordLink ?? "https://discord.gg/anAmr5MQF";
  const discordWebhookUrl = data?.discordWebhookUrl ?? "";
  const discordBackupWebhookUrl = data?.discordBackupWebhookUrl ?? "";

  const isOwner = role === "owner";
  const isCustomer = role === "customer";

  // ── Render ───────────────────────────────────────────────────────────────
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

  const navItems = buildNavItems(isCustomer, isOwner);

  return (
    <>
      <div className="scanline" />
      <ConfettiLayer pieces={confettiPieces} />

      <div className="shell">
        <AdminHeader
          clock={clock}
          user={user}
          role={role}
          isCustomer={isCustomer}
          isOwner={isOwner}
          onOpenChangePw={isStaff ? () => setChangePwOpen(true) : undefined}
          refreshStatus={refreshStatus}
          refreshing={refreshing}
          siteStatus={siteStatus}
          discordStatus={discord.status}
          discordInfo={discord.info}
          onRefresh={() => void refreshData()}
          onDiscordRecheck={() => void discord.check()}
          onOpenSiteStatus={() => setSiteStatusOpen(true)}
          onOpenDiscord={() => setDiscordOpen(true)}
          onOpenWhitelist={() => setWhitelistOpen(true)}
          onOpenAccounts={() => setAccountOpen(true)}
          onResetData={() => void resetData()}
          onExport={() => void exportData()}
          onImportFile={(f) => void importFile(f)}
          onLogout={doLogout}
        />

        <AdminSidebar
          items={navItems}
          page={page}
          onNavigate={navigateTo}
          showGroupLabel={!isCustomer}
          badge={
            orderAlerts.newCount > 0
              ? { page: "dashboard", count: orderAlerts.newCount }
              : undefined
          }
        />

        <main className="hd-main">
          {page === "dashboard" ? (
            <DashboardPage
              orders={orders}
              inventory={inventory}
              isOwner={isOwner}
              discordReminderShown={discord.reminderShown}
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
          {page === "payroll" && isOwner ? <PayrollPage /> : null}
          {page === "chat" ? (
            <div className="h-[600px]">
              <ChatPanel currentUser={user} />
            </div>
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
        maintenance={siteStatus.maintenance}
        message={siteStatus.message}
        onClose={() => setSiteStatusOpen(false)}
        onSaved={(closed, maintenance, message) => {
          setData((d) =>
            d ? { ...d, siteStatus: { closed, maintenance, message } } : d
          );
        }}
      />
      <DiscordModal
        open={discordOpen}
        currentUrl={discordLink}
        currentWebhookUrl={discordWebhookUrl}
        currentBackupWebhookUrl={discordBackupWebhookUrl}
        onClose={() => setDiscordOpen(false)}
        onSaved={(url, webhookUrl, backupWebhookUrl) => {
          setData((d) =>
            d
              ? {
                  ...d,
                  discordLink: url,
                  discordWebhookUrl: webhookUrl,
                  discordBackupWebhookUrl: backupWebhookUrl,
                }
              : d
          );
          discord.markSaved();
        }}
      />
      <WhitelistModal open={whitelistOpen} onClose={() => setWhitelistOpen(false)} />
      <AccountModal open={accountOpen} onClose={() => setAccountOpen(false)} />
      <ChangePasswordModal open={changePwOpen} onClose={() => setChangePwOpen(false)} />
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
