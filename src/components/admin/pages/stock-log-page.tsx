"use client";
// Stock log page: reverse-chronological log entries with a capped-height
// scroll area so long logs don't push the page forever.
import type { StockLogRow } from "@/lib/types";
import { FOCUS_RING, SCROLL_AREA, TOUCH_TARGET } from "../components/touch";

export function StockLogPage({
  stockLog,
  onRestock,
}: {
  stockLog: StockLogRow[];
  onRestock: () => void;
}) {
  return (
    <div>
      <div className="section-head">
        <div className="section-title">Stock log</div>
        <button className={`btn ${TOUCH_TARGET} ${FOCUS_RING}`} onClick={onRestock}>
          📥 Log restock
        </button>
      </div>
      <div className="card">
        <div id="log-list" className={SCROLL_AREA}>
          {stockLog.length === 0 ? (
            <div className="empty">NO LOG ENTRIES</div>
          ) : (
            stockLog.map((e) => (
              <div className="log-entry" key={e.id}>
                <div className="log-time">
                  {e.date || ""}
                  <br />
                  {e.ts || ""}
                </div>
                <div className={`log-dot log-dot-${e.type}`} />
                <div
                  className="log-text"
                  dangerouslySetInnerHTML={{
                    __html:
                      e.text +
                      ` <span class="log-who">${e.who || ""}</span>`,
                  }}
                />
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
