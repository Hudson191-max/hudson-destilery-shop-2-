"use client";
// Admin header bar: brand, "Order now" shortcut, dark-mode toggle, user chip,
// live-refresh indicator, and the owner-only control cluster.
// Visual-only additions (ThemeToggle slot, role-icon user chip, focus rings,
// 44px touch targets on mobile) — every original control is preserved.
import { Crown, HardHat, Search } from "lucide-react";
import ThemeToggle from "@/components/theme-toggle";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { LOGO_URL } from "../admin-helpers";
import type { DiscordInfo, DiscordStatus } from "../hooks/use-discord-status";
import type { Role } from "../types";
import { FOCUS_RING, TOUCH_TARGET } from "../components/touch";

interface AdminHeaderProps {
  clock: string;
  user: string;
  role: Role | null;
  isCustomer: boolean;
  isOwner: boolean;
  refreshStatus: string;
  refreshing: boolean;
  siteStatus: { closed: boolean; maintenance: boolean };
  discordStatus: DiscordStatus;
  discordInfo: DiscordInfo;
  onRefresh: () => void;
  onDiscordRecheck: () => void;
  onOpenSiteStatus: () => void;
  onOpenDiscord: () => void;
  onOpenWhitelist: () => void;
  onOpenAccounts: () => void;
  /** Staff only — opens the self-service change-password modal. */
  onOpenChangePw?: () => void;
  onResetData: () => void;
  onExport: () => void;
  onImportFile: (f: File) => void;
  onLogout: () => void;
}

export function AdminHeader({
  clock,
  user,
  role,
  isCustomer,
  isOwner,
  refreshStatus,
  refreshing,
  siteStatus,
  discordStatus,
  discordInfo,
  onRefresh,
  onDiscordRecheck,
  onOpenSiteStatus,
  onOpenDiscord,
  onOpenWhitelist,
  onOpenAccounts,
  onOpenChangePw,
  onResetData,
  onExport,
  onImportFile,
  onLogout,
}: AdminHeaderProps) {
  // Role icon for the user chip: Crown = owner, HardHat = employee,
  // Search = customer (track-only view).
  const RoleIcon =
    role === "owner" ? Crown : role === "employee" ? HardHat : Search;

  return (
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
          href="/"
          className={`btn btn-accent btn-sm ${TOUCH_TARGET} ${FOCUS_RING}`}
          onClick={(e) => {
            e.preventDefault();
            window.location.href = "/";
          }}
        >
          🛒 Order now
        </a>
        {/* Compact dark-mode toggle slot (next-themes provider is wired in layout). */}
        <ThemeToggle />
        {/* User chip with role icon */}
        <div
          className="header-tag flex items-center gap-1.5"
          title={isCustomer ? "Tracking as customer" : `Signed in as ${user}`}
        >
          <RoleIcon
            size={12}
            aria-hidden="true"
            style={{
              color:
                role === "owner"
                  ? "var(--accent)"
                  : role === "employee"
                    ? "var(--green)"
                    : "var(--text2)",
            }}
          />
          <span>
            {isCustomer
              ? "TRACK ORDER"
              : `${user} [${(role || "").toUpperCase()}]`}
          </span>
        </div>
        {onOpenChangePw ? (
          <button
            className={`btn btn-sm ${TOUCH_TARGET} ${FOCUS_RING}`}
            onClick={onOpenChangePw}
            title="Change your password"
            aria-label="Change your password"
          >
            🔑
          </button>
        ) : null}
        <div className="header-tag" id="clock">
          {clock}
        </div>
        <div className="header-tag live-tag" title="Auto-refreshes every 12 seconds and when this tab regains focus">
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
            className={`btn btn-sm ${TOUCH_TARGET} ${FOCUS_RING}`}
            onClick={onRefresh}
            disabled={refreshing}
          >
            {refreshing ? "⟳ Refreshing…" : "⟳ Refresh"}
          </button>
        ) : null}
        {isOwner ? (
          <>
            <button
              className={`btn btn-sm ${TOUCH_TARGET} ${FOCUS_RING}` +
                (siteStatus.maintenance || siteStatus.closed ? " btn-red" : "")}
              onClick={onOpenSiteStatus}
            >
              {siteStatus.maintenance
                ? "🔧 Maintenance Mode"
                : siteStatus.closed
                  ? "🛑 Orders Closed"
                  : "🟢 Orders Open"}
            </button>
            <button
              className={`btn btn-sm ${TOUCH_TARGET} ${FOCUS_RING}`}
              onClick={onOpenDiscord}
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
                      onDiscordRecheck();
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  aria-label="Recheck Discord link status"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      if (discordStatus !== "checking") onDiscordRecheck();
                    }
                  }}
                />
              )}
            </button>
            <button
              className={`btn btn-sm ${TOUCH_TARGET} ${FOCUS_RING}`}
              onClick={onOpenWhitelist}
            >
              🔐 Whitelist
            </button>
            <button
              className={`btn btn-sm ${TOUCH_TARGET} ${FOCUS_RING}`}
              onClick={onOpenAccounts}
            >
              👤 Accounts
            </button>
            <button
              className={`btn btn-sm btn-red ${TOUCH_TARGET} ${FOCUS_RING}`}
              onClick={onResetData}
            >
              🗑 Reset
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className={`btn btn-sm ${TOUCH_TARGET} ${FOCUS_RING}`}
                  aria-label="Export data"
                >
                  📤 Export ▾
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" sideOffset={6}>
                <DropdownMenuLabel>Export data</DropdownMenuLabel>
                <DropdownMenuItem onClick={onExport} className="gap-2">
                  💾 Full JSON backup
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="gap-2" asChild>
                  <a href="/api/admin/export?format=csv&set=orders" download>
                    🧾 Orders → CSV
                  </a>
                </DropdownMenuItem>
                <DropdownMenuItem className="gap-2" asChild>
                  <a href="/api/admin/export?format=csv&set=inventory" download>
                    📦 Inventory → CSV
                  </a>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <button
              className={`btn btn-sm ${TOUCH_TARGET} ${FOCUS_RING}`}
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
                if (f) onImportFile(f);
                e.target.value = "";
              }}
            />
          </>
        ) : null}
        <button
          className={`btn btn-sm ${TOUCH_TARGET} ${FOCUS_RING}`}
          onClick={onLogout}
        >
          Logout
        </button>
      </div>
    </header>
  );
}
