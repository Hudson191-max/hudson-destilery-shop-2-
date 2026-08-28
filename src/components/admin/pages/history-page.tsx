"use client";
// Order history page (owner): Done + Cancelled orders, sortable, newest first.
import { CURRENCY, orderTotal } from "@/lib/types";
import type { AdminOrder } from "../admin-helpers";
import { useSortedOrders } from "../hooks/use-sortable-orders";
import { SortHeader } from "../components/sort-header";
import { StatusBadge } from "../components/status-badge";
import { SCROLL_AREA } from "../components/touch";

export function HistoryPage({ orders }: { orders: AdminOrder[] }) {
  const done = orders.filter(
    (o) => o.status === "Done" || o.status === "Cancelled"
  );
  // History defaults to newest first (id desc) — most recent completed
  // orders at the top, so staff can review what was just finished.
  const { sort, toggle, sorted } = useSortedOrders(done, {
    key: "id",
    dir: "desc",
  });
  return (
    <div>
      <div className="section-head">
        <div className="section-title">Order history</div>
      </div>
      <div className="card">
        <div className="card-head">
          {done.length > 0 ? (
            <span className="muted-hint">
              Sorted by {sort.key} {sort.dir} — click a column to change
            </span>
          ) : (
            <span />
          )}
        </div>
        <div className={`tbl-wrap ${SCROLL_AREA}`}>
          <table>
            <thead>
              <tr>
                <SortHeader label="#" column="id" sort={sort} onToggle={toggle} />
                <SortHeader label="Customer" column="customer" sort={sort} onToggle={toggle} />
                <SortHeader label="Items" column="items" sort={sort} onToggle={toggle} />
                <SortHeader label="Total" column="total" sort={sort} onToggle={toggle} align="right" />
                <SortHeader label="Status" column="status" sort={sort} onToggle={toggle} />
                <SortHeader label="Date" column="date" sort={sort} onToggle={toggle} />
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={6} className="empty">
                    NO HISTORY
                  </td>
                </tr>
              ) : (
                sorted.map((o) => (
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
    </div>
  );
}
