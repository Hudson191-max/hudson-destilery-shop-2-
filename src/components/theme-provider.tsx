"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

// Class-based theme switching so the existing shadcn `.dark` CSS variables
// apply. `suppressHydrationWarning` is already set on <html> in the layout.
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
