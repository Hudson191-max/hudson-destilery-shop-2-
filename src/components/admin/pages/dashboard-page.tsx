"use client";
// Dashboard page: metrics row, owner discord reminder, delivery queue table
// (oldest first) and active orders table (newest first) with inline status
// actions. Each table owns its own sort state via useSortedOrders.
import dynamic from "next/dynamic";
import { CURRENCY, orderTotal, type InventoryRow } from "@/lib/types";
import type { AdminOrder } from "../admin-helpers";
import { useSortedOrders } from "../hooks/use-sortable-orders";
import { SortHeader } from "../components/sort-header";
import { StatusBadge } from "../components/status-badge";
import { FOCUS_RING, SCROLL_AREA, TOUCH_TARGET, TOUCH_TARGET_ICON } from "../components/touch";

// Recharts is ~100KB+ gzipped — keep it out of the admin bundle until the
// dashboard actually renders. While it streams in, show a themed skeleton.
const SalesChart = dynamic(
  () => import("../components/sales-chart").then((m) => m.SalesChart),
  {
    ssr: false,
    loading: () => (
      <div
        className="hd-chart-skeleton"
        style={{
          height: 260,
          borderRadius: 12,
          opacity: 0.5,
          background:
            "linear-gradient(100deg, var(--bg2, rgba(128,128,128,.12)) 40%, var(--bg3, rgba(128,128,128,.22)) 50%, var(--bg2, rgba(128,128,128,.12)) 60%)",
          backgroundSize: "200% 100%",
          animation: "hd-shimmer 1.2s ease-in-out infinite",
        }}
        aria-hidden="true"
      />
    ),
  }
);

interface DashboardPageProps {
  orders: AdminOrder[];
  inventory: InventoryRow[];
  isOwner: boolean;
  discordReminderShown: boolean;
  onNewOrder: () => void;
  onView: (o: AdminOrder) => void;
  onChangeStatus: (id: number | string, status: string) => Promise<void>;
}

export function DashboardPage({
  orders,
  inventory,
  isOwner,
  discordReminderShown,
  onNewOrder,
  onView,
  onChangeStatus,
}: DashboardPageProps) {
  const active = orders.filter(
    (o) => o.status !== "Done" && o.status !== "Cancelled"
  );
  const deliveryOrders = orders.filter(
    (o) => o.status === "Ready for Delivery"
  );
  // Each table owns its own sort state. Active orders default to newest
  // first (id desc) so staff see fresh orders at the top. Delivery queue
  // defaults to oldest first (id asc) so the longest-waiting delivery
  // surfaces at the top — that's the one staff most need to act on.
  const activeSort = useSortedOrders(active, {
    key: "id",
    dir: "desc",
  });
  const deliverySort = useSortedOrders(deliveryOrders, {
    key: "id",
    dir: "asc",
  });
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
        <button
          className={`btn btn-accent ${TOUCH_TARGET} ${FOCUS_RING}`}
          onClick={onNewOrder}
        >
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
          <div className="metric-sub">Dollars</div>
        </div>
        <div className="metric metric-red">
          <div className="metric-label">Low stock</div>
          <div className="metric-value">{lowStock}</div>
        </div>
      </div>
      <SalesChart orders={orders} />
      <div className="card">
        <div className="card-head">
          <div className="card-title">Delivery queue</div>
          {deliveryOrders.length > 0 ? (
            <span className="muted-hint">
              Sorted by {deliverySort.sort.key} {deliverySort.sort.dir} — click a column to change
            </span>
          ) : null}
        </div>
        <div className={`tbl-wrap ${SCROLL_AREA}`}>
          <table>
            <thead>
              <tr>
                <SortHeader label="#" column="id" sort={deliverySort.sort} onToggle={deliverySort.toggle} />
                <SortHeader label="Customer" column="customer" sort={deliverySort.sort} onToggle={deliverySort.toggle} />
                <SortHeader label="Items" column="items" sort={deliverySort.sort} onToggle={deliverySort.toggle} />
                <SortHeader label="Total" column="total" sort={deliverySort.sort} onToggle={deliverySort.toggle} align="right" />
                <SortHeader label="Status" column="status" sort={deliverySort.sort} onToggle={deliverySort.toggle} />
                <SortHeader label="Date" column="date" sort={deliverySort.sort} onToggle={deliverySort.toggle} />
              </tr>
            </thead>
            <tbody>
              {deliverySort.sorted.length === 0 ? (
                <tr>
                  <td colSpan={6} className="empty">
                    NO ORDERS READY FOR DELIVERY
                  </td>
                </tr>
              ) : (
                deliverySort.sorted.map((o) => (
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
                      <StatusBadge status={String(o.status)} />
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
          {active.length > 0 ? (
            <span className="muted-hint">
              Sorted by {activeSort.sort.key} {activeSort.sort.dir} — click a column to change
            </span>
          ) : null}
        </div>
        <div className={`tbl-wrap ${SCROLL_AREA}`}>
          <table>
            <thead>
              <tr>
                <SortHeader label="#" column="id" sort={activeSort.sort} onToggle={activeSort.toggle} />
                <SortHeader label="Customer" column="customer" sort={activeSort.sort} onToggle={activeSort.toggle} />
                <SortHeader label="Items" column="items" sort={activeSort.sort} onToggle={activeSort.toggle} />
                <SortHeader label="Total" column="total" sort={activeSort.sort} onToggle={activeSort.toggle} align="right" />
                <SortHeader label="Status" column="status" sort={activeSort.sort} onToggle={activeSort.toggle} />
                <SortHeader label="Date" column="date" sort={activeSort.sort} onToggle={activeSort.toggle} />
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {activeSort.sorted.length === 0 ? (
                <tr>
                  <td colSpan={7} className="empty">
                    NO ACTIVE ORDERS
                  </td>
                </tr>
              ) : (
                activeSort.sorted.map((o) => {
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
                        <StatusBadge status={status} />
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
                            className={`btn btn-sm ${FOCUS_RING}`}
                            onClick={() => onView(o)}
                          >
                            👁 View
                          </button>
                          {status === "Preparing" || status === "Pending" ? (
                            <button
                              className={`btn btn-sm btn-green ${TOUCH_TARGET} ${FOCUS_RING}`}
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
                              className={`btn btn-sm btn-accent ${TOUCH_TARGET} ${FOCUS_RING}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                void onChangeStatus(o.id, "Done");
                              }}
                            >
                              ✓ Done
                            </button>
                          ) : null}
                          <button
                            className={`btn btn-icon btn-sm btn-red ${TOUCH_TARGET_ICON} ${FOCUS_RING}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              void onChangeStatus(o.id, "Cancelled");
                            }}
                            aria-label={`Cancel order #${o.id}`}
                            title={`Cancel order #${o.id}`}
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
