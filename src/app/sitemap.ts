import type { MetadataRoute } from "next";

import { KNOWN_ARTICLE_SLUGS, KNOWN_PRODUCT_SLUGS } from "@/config/known-slugs";
import { getSiteUrl } from "@/lib/env";

/**
 * Sitemap halaman publik saja (PRD AC-44): `/mitra/*` tidak pernah dimuat.
 *
 * URL absolut dibentuk dari `NEXT_PUBLIC_SITE_URL` (atau `VERCEL_URL` di preview). Bila URL situs tidak
 * diketahui (pengembangan lokal), sitemap kosong; tidak ada URL `localhost` yang dihasilkan. Di
 * production `getSiteUrl()` mewajibkan `NEXT_PUBLIC_SITE_URL`.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getSiteUrl();
  if (siteUrl === null) return [];
  const url = (path: string) => new URL(path, siteUrl).toString();

  return [
    { url: url("/"), changeFrequency: "daily", priority: 1.0 },
    { url: url("/produk"), changeFrequency: "daily", priority: 0.9 },
    ...KNOWN_PRODUCT_SLUGS.map((slug) => ({
      url: url(`/produk/${slug}`),
      changeFrequency: "daily" as const,
      priority: 0.9,
    })),
    { url: url("/artikel"), changeFrequency: "weekly", priority: 0.7 },
    ...KNOWN_ARTICLE_SLUGS.map((slug) => ({
      url: url(`/artikel/${slug}`),
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
    { url: url("/profil"), changeFrequency: "monthly", priority: 0.6 },
    { url: url("/kontak"), changeFrequency: "monthly", priority: 0.6 },
  ];
}
