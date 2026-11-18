import type { MetadataRoute } from "next";

import { getSiteUrl, isIndexingAllowed } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  if (!isIndexingAllowed()) {
    return {
      rules: {
        userAgent: "*",
        disallow: "/",
      },
    };
  }

  const siteUrl = getSiteUrl();
  const sitemapUrl = siteUrl ? new URL("/sitemap.xml", siteUrl).toString() : undefined;

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/mitra/", "/mitra"],
    },
    sitemap: sitemapUrl,
  };
}
