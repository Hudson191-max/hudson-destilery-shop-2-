"use client";
// Inventory page: stock table with level bars, per-item status, the owner-only
// "for sale" toggle and quick actions (restock / edit / delete).
// An item is considered "for sale" unless `active` is explicitly false.
// (Older rows created before the column existed report undefined/null.)
import { CURRENCY, type InventoryRow } from "@/lib/types";
import { stockStatusKind } from "../admin-helpers";
import { StockBar } from "../components/stock-bar";
import { FOCUS_RING, SCROLL_AREA, TOUCH_TARGET, TOUCH_TARGET_ICON } from "../components/touch";

interface InventoryPageProps {
  inventory: InventoryRow[];
  isOwner: boolean;
  onRestock: () => void;
  onAddItem: () => void;
  onQuickRestock: (id: number | string) => void;
  onEdit: (i: InventoryRow) => void;
  onDelete: (i: InventoryRow) => void;
  onToggleActive?: (i: InventoryRow, nextActive: boolean) => void;
}

export function InventoryPage({
  inventory,
  isOwner,
  onRestock,
  onAddItem,
  onQuickRestock,
  onEdit,
  onDelete,
  onToggleActive,
}: InventoryPageProps) {
  const isForSale = (i: InventoryRow) => i.active !== false;

  return (
    <div>
      <div className="section-head">
        <div className="section-title">Inventory</div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            className={`btn ${TOUCH_TARGET} ${FOCUS_RING}`}
            onClick={onRestock}
          >
            📥 Log restock
          </button>
          {isOwner ? (
            <button
              className={`btn btn-accent ${TOUCH_TARGET} ${FOCUS_RING}`}
              onClick={onAddItem}
            >
              ＋ Add item
            </button>
          ) : null}
        </div>
      </div>
      <div className="card">
        <div className={`tbl-wrap ${SCROLL_AREA}`}>
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
                        <StockBar stock={i.stock} />
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
                            className={`btn btn-sm btn-green ${TOUCH_TARGET_ICON} ${FOCUS_RING}`}
                            onClick={() => onQuickRestock(i.id)}
                            aria-label={`Restock ${i.name}`}
                            title={`Restock ${i.name}`}
                          >
                            +
                          </button>
                          {isOwner ? (
                            <button
                              className={`btn btn-sm ${TOUCH_TARGET_ICON} ${FOCUS_RING}`}
                              onClick={() => onEdit(i)}
                              aria-label={`Edit ${i.name}`}
                              title={`Edit ${i.name}`}
                            >
                              ✏
                            </button>
                          ) : null}
                          {isOwner ? (
                            <button
                              className={`btn btn-icon btn-sm btn-red ${TOUCH_TARGET_ICON} ${FOCUS_RING}`}
                              onClick={() => onDelete(i)}
                              aria-label={`Delete ${i.name}`}
                              title={`Delete ${i.name}`}
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
