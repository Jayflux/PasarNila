import type { NextConfig } from "next";

/**
 * Konfigurasi Next.js 16.4.6.
 *
 * `cacheComponents` dan `partialPrefetching` di-set EKSPLISIT. Default framework 16.4.6 untuk
 * `cacheComponents` adalah `false`; template create-next-app yang menyalakannya. Lihat
 * ARCHITECTURE.md §12.0 untuk hasil verifikasi dari dokumentasi terbundel dan kode sumber.
 *
 * Aturan yang bergantung pada mode ini (ARCHITECTURE.md §12.2):
 * - Data produk TIDAK memakai 'use cache', memakai `await connection()`, dan dibungkus <Suspense>.
 * - Jangan memakai segment config `dynamic`, `revalidate`, `fetchCache`, atau `runtime`.
 * - Jangan set `experimental.staleTimes` (default `dynamic: 0`).
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
