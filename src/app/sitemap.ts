import type { MetadataRoute } from "next";

import { getSiteUrl } from "@/lib/env";

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getSiteUrl();
  const base = siteUrl ? siteUrl.origin : "http://localhost:3000";

  return [
    {
      url: `${base}/`,
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: `${base}/produk`,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${base}/produk/ikan-nila`,
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${base}/artikel`,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${base}/profil`,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${base}/kontak`,
      changeFrequency: "monthly",
      priority: 0.6,
    },
  ];
}
