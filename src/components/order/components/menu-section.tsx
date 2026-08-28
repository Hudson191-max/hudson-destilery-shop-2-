"use client";

// Menu browser: search box + category chips + item cards (price, stock badge,
// qty stepper) with skeleton loaders and empty states.
//
// The public inventory API intentionally exposes no categories, so chips are
// derived from item names (see deriveCategory). Stock badges are informational
// only — ordering is never blocked, even for out-of-stock items (+ stays live).

import { useMemo, useState } from "react";
import {
  Beer,
  GlassWater,
  LayoutGrid,
  Search,
  ShoppingBasket,
  Wine,
  X,
} from "lucide-react";
import {
  deriveCategory,
  itemCategories,
  fmtPrice,
  type InventoryItem,
  type StockLevels,
} from "../order-types";

// Small decorative icon per filter chip — pure presentation.
const CATEGORY_ICONS: Record<string, React.ComponentType<{ size?: number; className?: string; "aria-hidden"?: boolean | "true" | "false" }>> = {
  All: LayoutGrid,
  Spirits: GlassWater,
  "Wine & Mead": Wine,
  "Brews & Cider": Beer,
};

export interface MenuSectionProps {
  items: InventoryItem[];
  levels: StockLevels;
  loading: boolean;
  cart: Record<string, number>;
  onToggle: (id: number | string) => void;
  onAddOne: (id: number | string) => void;
  onSubOne: (id: number | string) => void;
  onSetQty: (id: number | string, val: number) => void;
}

function MenuCard({
  item,
  qty,
  selected,
  level,
  onToggle,
  onAddOne,
  onSubOne,
  onSetQty,
}: {
  item: InventoryItem;
  qty: number;
  selected: boolean;
  level?: "out" | "low" | "ok";
  onToggle: () => void;
  onAddOne: () => void;
  onSubOne: () => void;
  onSetQty: (val: number) => void;
}) {
  const out = level === "out";
  const stockSuffix = out
    ? ", currently out of stock"
    : level === "low"
      ? ", low stock"
      : "";
  return (
    <div
      className={
        "menu-card" + (selected ? " selected" : "") + (out ? " hd-item-out" : "")
      }
      onClick={onToggle}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onToggle();
        }
      }}
      aria-pressed={selected}
      aria-label={`${item.name}, ${fmtPrice(item.price)}${stockSuffix}`}
    >
      <div className="hd-card-top">
        <div className="menu-name">{item.name}</div>
        {out && (
          <span className="badge badge-out" aria-label="Out of stock">
            Out of stock
          </span>
        )}
        {level === "low" && (
          <span className="badge badge-low" aria-label="Low stock">
            Low stock
          </span>
        )}
      </div>
      <div className="menu-price">{fmtPrice(item.price)}</div>
      <div
        className="menu-qty hd-qty-always"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="qty-btn"
          onClick={onSubOne}
          disabled={!selected}
          aria-label={`Decrease ${item.name} quantity`}
        >
          −
        </button>
        <input
          className="qty-input"
          type="number"
          min={1}
          value={qty}
          readOnly={!selected}
          onChange={(e) => onSetQty(parseInt(e.target.value, 10))}
          aria-label={`${item.name} quantity`}
        />
        <button
          type="button"
          className="qty-btn"
          onClick={onAddOne}
          aria-label={`Increase ${item.name} quantity`}
        >
          +
        </button>
      </div>
    </div>
  );
}

export function MenuSection(props: MenuSectionProps) {
  const { items, levels, loading, cart, onToggle, onAddOne, onSubOne, onSetQty } =
    props;
  const [query, setQuery] = useState("");
  const [activeCat, setActiveCat] = useState("All");

  const categories = useMemo(() => itemCategories(items), [items]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      if (q && !item.name.toLowerCase().includes(q)) return false;
      if (activeCat !== "All" && deriveCategory(item.name) !== activeCat)
        return false;
      return true;
    });
  }, [items, query, activeCat]);

  return (
    <section aria-label="Menu">
      <div className="page-title">Place your order</div>
      <div className="page-sub">
        {"SELECT YOUR DRINKS BELOW — WE'LL HANDLE THE REST"}
      </div>

      <div className="hd-menu-toolbar">
        <div className="hd-search">
          <Search size={14} className="hd-search-icon" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search drinks…"
            aria-label="Search drinks"
          />
          {query && (
            <button
              type="button"
              className="hd-search-clear"
              onClick={() => setQuery("")}
              aria-label="Clear search"
            >
              <X size={13} aria-hidden="true" />
            </button>
          )}
        </div>
        {categories.length > 1 && (
          <div className="hd-chips" role="group" aria-label="Filter by category">
            {["All", ...categories].map((c) => {
              const Icon = CATEGORY_ICONS[c] ?? ShoppingBasket;
              return (
                <button
                  key={c}
                  type="button"
                  className={"hd-chip" + (activeCat === c ? " active" : "")}
                  aria-pressed={activeCat === c}
                  onClick={() => setActiveCat(c)}
                >
                  <Icon size={12} aria-hidden="true" className="hd-chip-icon" />
                  {c}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="menu-grid">
        {loading && items.length === 0 ? (
          Array.from({ length: 8 }, (_, i) => (
            <div className="hd-skel-card" key={i} aria-hidden="true">
              <div className="hd-skeleton hd-skel-line lg" />
              <div className="hd-skeleton hd-skel-line sm" />
              <div className="hd-skeleton hd-skel-line qty" />
            </div>
          ))
        ) : items.length === 0 ? (
          <div className="hd-empty-state" style={{ gridColumn: "1/-1" }}>
            <div className="hd-empty-icon" aria-hidden="true">
              🥃
            </div>
            <div className="hd-empty-title">The shelf is empty</div>
            <div className="hd-empty-sub">
              No drinks are available right now — please check back soon.
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="hd-empty-state" style={{ gridColumn: "1/-1" }}>
            <div className="hd-empty-icon" aria-hidden="true">
              🔍
            </div>
            <div className="hd-empty-title">No drinks match</div>
            <div className="hd-empty-sub">
              Nothing found for “{query.trim() || activeCat}”.
            </div>
            <button
              type="button"
              className="reset-btn"
              style={{ marginTop: 10 }}
              onClick={() => {
                setQuery("");
                setActiveCat("All");
              }}
            >
              Clear filters
            </button>
          </div>
        ) : (
          filtered.map((item) => (
            <MenuCard
              key={item.id}
              item={item}
              qty={cart[item.id] || 1}
              selected={!!cart[item.id]}
              level={levels[String(item.id)]}
              onToggle={() => onToggle(item.id)}
              onAddOne={() => onAddOne(item.id)}
              onSubOne={() => onSubOne(item.id)}
              onSetQty={(v) => onSetQty(item.id, v)}
            />
          ))
        )}
      </div>
    </section>
  );
}
