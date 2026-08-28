import type { MetadataRoute } from "next";

// The storefront is the only public, indexable surface. /admin is auth-only
// (and noindex), /api is machine traffic — neither belongs in the sitemap.
export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://hudson-destilery-shop.vercel.app";
  return [
    {
      url: base,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
  ];
}
