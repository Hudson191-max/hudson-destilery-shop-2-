"use client";
// Payroll page — restock totals per employee (owner only).
// Shows how many units each employee restocked over a date range, plus an
// optional "rate per unit" so the owner can see estimated payout. The rate
// is stored in localStorage only — it's a UI convenience, not saved to the DB.
import { Fragment, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api-client";
import { CURRENCY } from "@/lib/types";
import {
  FOCUS_RING,
  SCROLL_AREA,
  TOUCH_TARGET,
} from "../components/touch";

interface ItemBreakdown {
  name: string;
  qty: number;
  count: number;
}
interface EmployeeSummary {
  who: string;
  totalQty: number;
  restockCount: number;
  items: ItemBreakdown[];
}
interface PayrollResponse {
  ok: boolean;
  from: string | null;
  to: string | null;
  employees: EmployeeSummary[];
  totalQty: number;
  totalRestocks: number;
  unparseable: number;
  scannedRows: number;
}

function thisMonthRange(): { from: string; to: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth(); // 0-indexed
  const from = `${y}-${String(m + 1).padStart(2, "0")}-01`;
  // Last day of current month
  const last = new Date(y, m + 1, 0).getDate();
  const to = `${y}-${String(m + 1).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
  return { from, to };
}

export function PayrollPage() {
  const initial = thisMonthRange();
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [rate, setRate] = useState<string>("0");
  const [data, setData] = useState<PayrollResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Persist rate in localStorage so the owner doesn't re-enter it every time.
  useEffect(() => {
    const saved = window.localStorage.getItem("hd_payroll_rate");
    if (saved !== null) setRate(saved);
  }, []);
  useEffect(() => {
    window.localStorage.setItem("hd_payroll_rate", rate);
  }, [rate]);

  async function load(f = from, t = to) {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (f) params.set("from", f);
      if (t) params.set("to", t);
      const url = "/api/admin/restock-summary" + (params.toString() ? `?${params}` : "");
      const res = await api<PayrollResponse>(url);
      setData(res);
      setExpanded(new Set()); // collapse all on reload
    } catch (e) {
      const err = e as ApiError;
      setError(err.detail || err.message || "Failed to load summary");
    } finally {
      setLoading(false);
    }
  }

  // Auto-load on first mount.
  useEffect(() => {
    void load(initial.from, initial.to);
  }, []);

  function toggleEmp(who: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(who)) next.delete(who);
      else next.add(who);
      return next;
    });
  }

  function setQuickRange(kind: "today" | "week" | "month" | "all") {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const d = now.getDate();
    const pad = (n: number) => String(n).padStart(2, "0");
    const today = `${y}-${pad(m + 1)}-${pad(d)}`;
    if (kind === "today") {
      setFrom(today);
      setTo(today);
    } else if (kind === "week") {
      const start = new Date(now);
      start.setDate(d - 6);
      setFrom(`${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`);
      setTo(today);
    } else if (kind === "month") {
      const r = thisMonthRange();
      setFrom(r.from);
      setTo(r.to);
    } else {
      // all = no filter
      setFrom("");
      setTo("");
    }
  }

  const rateNum = parseFloat(rate) || 0;
  const fmtMoney = (n: number) => `${n.toLocaleString()} ${CURRENCY}`;

  return (
    <div>
      <div className="section-head">
        <div className="section-title">Payroll — restock per employee</div>
        <button
          className={`btn btn-accent ${TOUCH_TARGET} ${FOCUS_RING}`}
          onClick={() => void load()}
          disabled={loading}
        >
          {loading ? "Loading…" : "↻ Refresh"}
        </button>
      </div>

      {/* Filters */}
      <div className="card payroll-filters">
        <div className="payroll-filter-group">
          <label htmlFor="hd-payroll-from">From</label>
          <input
            id="hd-payroll-from"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </div>
        <div className="payroll-filter-group">
          <label htmlFor="hd-payroll-to">To</label>
          <input
            id="hd-payroll-to"
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
        <div className="payroll-quick-buttons">
          <button className={`btn btn-sm ${TOUCH_TARGET} ${FOCUS_RING}`} onClick={() => setQuickRange("today")}>
            Today
          </button>
          <button className={`btn btn-sm ${TOUCH_TARGET} ${FOCUS_RING}`} onClick={() => setQuickRange("week")}>
            7 days
          </button>
          <button className={`btn btn-sm ${TOUCH_TARGET} ${FOCUS_RING}`} onClick={() => setQuickRange("month")}>
            This month
          </button>
          <button className={`btn btn-sm ${TOUCH_TARGET} ${FOCUS_RING}`} onClick={() => setQuickRange("all")}>
            All time
          </button>
        </div>
        <div className="payroll-filter-group payroll-rate">
          <label htmlFor="hd-payroll-rate">Rate per unit ({CURRENCY})</label>
          <input
            id="hd-payroll-rate"
            type="number"
            min={0}
            step="0.01"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            placeholder="0"
          />
        </div>
        <button
          className={`btn btn-accent ${TOUCH_TARGET} ${FOCUS_RING}`}
          onClick={() => void load()}
          disabled={loading}
        >
          Apply
        </button>
      </div>

      {error ? (
        <div className="card" style={{ padding: 16, color: "var(--danger)" }}>
          {error}
        </div>
      ) : null}

      {/* Summary stats */}
      {data ? (
        <div className="payroll-stats">
          <div className="payroll-stat">
            <div className="payroll-stat-num">
              {data.employees.length}
            </div>
            <div className="payroll-stat-label">Employees</div>
          </div>
          <div className="payroll-stat">
            <div className="payroll-stat-num">{data.totalQty.toLocaleString()}</div>
            <div className="payroll-stat-label">Total units restocked</div>
          </div>
          <div className="payroll-stat">
            <div className="payroll-stat-num">{data.totalRestocks}</div>
            <div className="payroll-stat-label">Restock actions</div>
          </div>
          {rateNum > 0 ? (
            <div className="payroll-stat">
              <div className="payroll-stat-num">
                {fmtMoney(data.totalQty * rateNum)}
              </div>
              <div className="payroll-stat-label">Total payout @ {fmtMoney(rateNum)}/u</div>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Employees table */}
      <div className="card">
        <div className={`tbl-wrap ${SCROLL_AREA}`}>
          <table className="payroll-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th className="th-num">Restocks</th>
                <th className="th-num">Units</th>
                {rateNum > 0 ? <th className="th-num">Payout</th> : null}
                <th>Items</th>
              </tr>
            </thead>
            <tbody>
              {!data ? (
                <tr>
                  <td colSpan={rateNum > 0 ? 5 : 4} className="empty">
                    {loading ? "Loading…" : "No data"}
                  </td>
                </tr>
              ) : data.employees.length === 0 ? (
                <tr>
                  <td colSpan={rateNum > 0 ? 5 : 4} className="empty">
                    NO RESTOCKS IN THIS RANGE
                  </td>
                </tr>
              ) : (
                data.employees.map((emp) => {
                  const isOpen = expanded.has(emp.who);
                  return (
                    <Fragment key={emp.who}>
                      <tr
                        className={"payroll-row" + (isOpen ? " expanded" : "")}
                        onClick={() => toggleEmp(emp.who)}
                      >
                        <td className="td-name">
                          <span className="payroll-caret">
                            {isOpen ? "▾" : "▸"}
                          </span>
                          {emp.who}
                        </td>
                        <td className="td-mono td-num">{emp.restockCount}</td>
                        <td className="td-mono td-num td-units">
                          {emp.totalQty.toLocaleString()}
                        </td>
                        {rateNum > 0 ? (
                          <td className="td-mono td-num td-payout">
                            {fmtMoney(emp.totalQty * rateNum)}
                          </td>
                        ) : null}
                        <td className="td-items-count">
                          {emp.items.length} item{emp.items.length === 1 ? "" : "s"}
                        </td>
                      </tr>
                      {isOpen ? (
                        <tr className="payroll-detail-row">
                          <td colSpan={rateNum > 0 ? 5 : 4}>
                            <div className="payroll-items">
                              {emp.items.map((it) => (
                                <div key={it.name} className="payroll-item">
                                  <span className="payroll-item-name">{it.name}</span>
                                  <span className="payroll-item-qty">
                                    +{it.qty.toLocaleString()}{" "}
                                    <span className="muted">
                                      ({it.count}×)
                                    </span>
                                  </span>
                                  {rateNum > 0 ? (
                                    <span className="payroll-item-pay">
                                      {fmtMoney(it.qty * rateNum)}
                                    </span>
                                  ) : null}
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })
              )}
            </tbody>
            {data && data.employees.length > 0 ? (
              <tfoot>
                <tr>
                  <td>
                    <strong>Total</strong>
                  </td>
                  <td className="td-mono td-num">
                    <strong>{data.totalRestocks}</strong>
                  </td>
                  <td className="td-mono td-num td-units">
                    <strong>{data.totalQty.toLocaleString()}</strong>
                  </td>
                  {rateNum > 0 ? (
                    <td className="td-mono td-num td-payout">
                      <strong>{fmtMoney(data.totalQty * rateNum)}</strong>
                    </td>
                  ) : null}
                  <td />
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      </div>

      {/* Footer note */}
      {data && data.unparseable > 0 ? (
        <div
          className="card"
          style={{
            padding: 12,
            marginTop: 12,
            fontSize: 12,
            color: "var(--text2)",
          }}
        >
          ⚠️ {data.unparseable} log entr{data.unparseable === 1 ? "y" : "ies"}{" "}
          could not be parsed and were skipped. Scanned {data.scannedRows} rows
          total.
          {from || to ? (
            <>
              {" "}
              Range: {from || "start"} → {to || "now"}.
            </>
          ) : null}
        </div>
      ) : null}
      <div
        className="card"
        style={{
          padding: 12,
          marginTop: 12,
          fontSize: 12,
          color: "var(--text2)",
        }}
      >
        💡 Tip: set the <strong>Rate per unit</strong> above to automatically
        compute each employee&apos;s payout. The rate is saved in your browser
        only — it is not stored in the database.
      </div>
    </div>
  );
}
