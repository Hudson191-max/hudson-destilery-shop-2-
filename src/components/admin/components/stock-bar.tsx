// Stock level bar shown in the inventory table (green/yellow/red fill).
import { stockBarColor, stockBarPct } from "../admin-helpers";

export function StockBar({ stock }: { stock: number }) {
  return (
    <div className="sbar-wrap">
      <div className="sbar">
        <div
          className="sbar-fill"
          style={{
            width: `${stockBarPct(stock)}%`,
            background: stockBarColor(stock),
          }}
        />
      </div>
      <span className="td-mono" style={{ fontSize: 12 }}>
        {stock}
      </span>
    </div>
  );
}
