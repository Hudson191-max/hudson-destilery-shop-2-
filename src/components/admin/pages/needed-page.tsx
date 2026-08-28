"use client";
// "What we need" page: aggregates item quantities across all open orders and
// compares them to current stock to surface shortages.
import type { InventoryRow } from "@/lib/types";
import type { OrderLine } from "@/lib/types";
import type { AdminOrder } from "../admin-helpers";
import { SCROLL_AREA } from "../components/touch";

export function NeededPage({
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
        <div className={`tbl-wrap ${SCROLL_AREA}`}>
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
