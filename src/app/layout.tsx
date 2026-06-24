import type { Metadata } from "next";
import "./globals.css";
import { ToastHost } from "@/components/toast-host";

export const metadata: Metadata = {
  title: "The Hudson Distillery",
  description:
    "Order your drinks online — Vodka, Rum, Ale, Mead, Cider & more. Fast delivery, fair prices.",
  icons: {
    icon: "https://i.postimg.cc/0jB6HtW2/Chat-GPT-Image-25-mei-2026-11-35-47.png",
  },
  openGraph: {
    title: "The Hudson Distillery 🥃",
    description:
      "Order your drinks online — Vodka, Rum, Ale, Mead, Cider & more. Fast delivery, fair prices. Place your order now!",
    images: ["https://hudson-destilery-shop.vercel.app/logo.png"],
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* next/font/google cannot fetch fonts in this sandbox, so we load
            Google Fonts via a link tag (browser-side) like the original HTML. */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;500;600;700&family=Share+Tech+Mono&family=Exo+2:wght@300;400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="hd-root antialiased">
        {children}
        <ToastHost />
      </body>
    </html>
  );
}
