"use client";

// Discord community call-to-action shown under the order flow.

export function DiscordLink({ href }: { href: string }) {
  if (!href) return null;
  const display = href.replace(/^https?:\/\//, "");
  return (
    <div
      style={{
        marginTop: 16,
        padding: 16,
        border: "1px solid rgba(200,168,75,.2)",
        borderRadius: 4,
        background: "rgba(200,168,75,.05)",
        textAlign: "center",
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          color: "var(--text2)",
          letterSpacing: 1,
          marginBottom: 8,
        }}
      >
        JOIN OUR DISCORD
      </div>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          fontFamily: "var(--font-head)",
          fontSize: 16,
          fontWeight: 600,
          color: "var(--accent)",
          textDecoration: "none",
          letterSpacing: 1,
        }}
      >
        {`🎮 ${display}`}
      </a>
    </div>
  );
}
