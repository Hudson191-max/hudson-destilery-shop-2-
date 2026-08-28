"use client";

// Dark / light mode switch (next-themes).
// Shared by the storefront header and the admin shell — keep this exact path.
// The `mounted` guard avoids the classic SSR hydration mismatch: until we know
// we're on the client we render a same-sized placeholder instead of an icon.

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";

// Client-detection without an effect (and without setState-in-effect lint
// errors): the server snapshot is `false`, the client snapshot is `true`.
const emptySubscribe = () => () => {};
function useMounted(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );
}

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useMounted();

  if (!mounted) {
    return (
      <span
        className={"hd-theme-toggle hd-theme-toggle-ph" + (className ? ` ${className}` : "")}
        aria-hidden="true"
      />
    );
  }

  const isDark = resolvedTheme !== "light";
  const label = isDark ? "Switch to light mode" : "Switch to dark mode";

  return (
    <button
      type="button"
      className={"hd-theme-toggle" + (className ? ` ${className}` : "")}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={label}
      title={label}
      aria-pressed={isDark}
    >
      {isDark ? <Sun size={16} aria-hidden="true" /> : <Moon size={16} aria-hidden="true" />}
    </button>
  );
}

export default ThemeToggle;
