/**
 * Slug halaman detail yang dikenal (ARCHITECTURE.md §6, §10.3).
 *
 * Dengan Cache Components, `notFound()` yang dipanggil saat permintaan (setelah shell terkirim) tetap
 * berstatus HTTP 200 + `noindex` (dokumentasi Next.js 16.4.6: `loading.md` §Status codes). Agar slug yang
 * tidak dikenal mendapat status 404 yang benar, `src/proxy.ts` memeriksa daftar ini SEBELUM render.
 *
 * Daftar ini HARUS sama dengan data awal (migrasi `20261118000006_initial_content.sql`). Slug tidak
 * dapat diubah mitra (column grant hanya `title`/`body`, PRD BR-A5), dan mitra tidak dapat menambah
 * artikel/produk (AC-39), jadi daftarnya tetap. Pengembang yang menambah slug di database wajib menambah
 * slug di sini juga (diuji di tests/unit/known-slugs.test.ts).
 */
export const KNOWN_PRODUCT_SLUGS: readonly string[] = ["ikan-nila"];
export const KNOWN_ARTICLE_SLUGS: readonly string[] = ["artikel-1", "artikel-2"];

export type DetailRouteCheck = "known" | "unknown" | "not_detail";

/** `/produk/<slug>` atau `/artikel/<slug>` (satu segmen) → apakah slug dikenal. */
export function checkDetailRoute(pathname: string): DetailRouteCheck {
  const match = /^\/(produk|artikel)\/([^/]+)\/?$/.exec(pathname);
  if (!match) return "not_detail";
  const [, kind, rawSlug] = match;
  let slug: string;
  try {
    slug = decodeURIComponent(rawSlug ?? "");
  } catch {
    return "unknown";
  }
  const known = kind === "produk" ? KNOWN_PRODUCT_SLUGS : KNOWN_ARTICLE_SLUGS;
  return known.includes(slug) ? "known" : "unknown";
}
