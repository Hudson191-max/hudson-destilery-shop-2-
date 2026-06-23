"use client";
import { useToastStore } from "@/lib/toast";

export function ToastHost() {
  const items = useToastStore((s) => s.items);
  const dismiss = useToastStore((s) => s.dismiss);
  return (
    <div id="toast">
      {items.map((t) => (
        <div
          key={t.id}
          className={`toast-item ${t.type}`}
          onClick={() => dismiss(t.id)}
        >
          <span>{t.type === "err" ? "✕ " : "✓ "}</span>
          <span
            // detail uses simple text; message may contain minimal markup (rare) — keep safe
            dangerouslySetInnerHTML={{ __html: t.message }}
          />
          {t.detail ? (
            <div
              style={{
                fontSize: "11px",
                color: "var(--text2)",
                marginTop: "4px",
                width: "100%",
              }}
            >
              {t.detail}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
