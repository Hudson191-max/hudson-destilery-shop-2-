"use client";
// ── Sortable column header ───────────────────────────────────────────────────
// A <th> that toggles sort direction when clicked. Shows a ↑ / ↓ indicator
// when the column is active, and a faint ⇅ hint when it isn't (so users
// discover that the headers are clickable).
import type { OrderSortKey, SortState } from "../admin-helpers";

export function SortHeader({
  label,
  column,
  sort,
  onToggle,
  align,
}: {
  label: string;
  column: OrderSortKey;
  sort: SortState;
  onToggle: (k: OrderSortKey) => void;
  align?: "left" | "right" | "center";
}) {
  const active = sort.key === column;
  const indicator = active ? (sort.dir === "asc" ? " ↑" : " ↓") : " ⇅";
  return (
    <th
      scope="col"
      style={{ textAlign: align || "left" }}
      className={"th-sort" + (active ? " th-sort-active" : "")}
      aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
    >
      <button
        type="button"
        className="th-sort-btn"
        onClick={() => onToggle(column)}
        title={
          active
            ? sort.dir === "asc"
              ? `Sorted ascending — click to reverse`
              : `Sorted descending — click to reverse`
            : `Click to sort by ${label}`
        }
      >
        <span>{label}</span>
        <span
          className="th-sort-ind"
          style={{ opacity: active ? 1 : 0.45 }}
          aria-hidden="true"
        >
          {indicator.trim()}
        </span>
      </button>
    </th>
  );
}
