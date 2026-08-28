import type { Metadata, Viewport } from "next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";
import { ToastHost } from "@/components/toast-host";
import { ThemeProvider } from "@/components/theme-provider";

export const metadata: Metadata = {
  metadataBase: new URL("https://hudson-destilery-shop.vercel.app"),
  title: {
    default: "The Hudson Distillery",
    template: "%s — The Hudson Distillery",
  },
  description:
    "Order your drinks online — Vodka, Rum, Ale, Mead, Cider & more. Fast delivery, fair prices.",
  icons: {
    icon: "/hudson-logo.png",
    apple: "/apple-touch-icon.png",
  },
  manifest: "/manifest.webmanifest",
  applicationName: "The Hudson Distillery",
  openGraph: {
    title: "The Hudson Distillery 🥃",
    description:
      "Order your drinks online — Vodka, Rum, Ale, Mead, Cider & more. Fast delivery, fair prices. Place your order now!",
    images: ["/hudson-logo.png"],
    type: "website",
  },
};

// Structured data so search engines render a rich result for the shop.
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Store",
  name: "The Hudson Distillery",
  description:
    "Order your drinks online — Vodka, Rum, Ale, Mead, Cider & more. Fast delivery, fair prices.",
  url: "https://hudson-destilery-shop.vercel.app",
  logo: "https://hudson-destilery-shop.vercel.app/hudson-logo.png",
  image: "https://hudson-destilery-shop.vercel.app/hudson-logo.png",
};

// Browser UI color (mobile address bar) matches the dark distillery theme.
export const viewport: Viewport = {
  themeColor: "#0f0b08",
  width: "device-width",
  initialScale: 1,
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
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="hd-root antialiased">
        <ThemeProvider>{children}</ThemeProvider>
        <ToastHost />
        {/* Vercel Speed Insights — collects Core Web Vitals (LCP, FID, CLS)
            from real users and surfaces them in the Vercel dashboard.
            No-op in dev; only active on Vercel deployments. */}
        <SpeedInsights />
      </body>
    </html>
  );
}
