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
          {/* Plain text only: toasts echo server-provided values, so rendering
              markup here would be a stored-XSS sink. */}
          <span>{t.message}</span>
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
