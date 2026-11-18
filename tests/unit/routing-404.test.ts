/**
 * Status 404 untuk slug tak dikenal (ARCHITECTURE §6, T-01) dan sitemap tanpa localhost.
 *
 * Dengan Cache Components, `notFound()` saat permintaan berstatus 200 + noindex (dokumentasi Next.js
 * 16.4.6, loading.md §Status codes). Proxy menolak slug tak dikenal sebelum render.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import sitemap from "@/app/sitemap";
import { checkDetailRoute, KNOWN_ARTICLE_SLUGS, KNOWN_PRODUCT_SLUGS } from "@/config/known-slugs";
import { config as proxyConfig, proxy } from "@/proxy";

describe("pemeriksaan slug detail", () => {
  it.each([
    ["/produk/ikan-nila", "known"],
    ["/artikel/artikel-1", "known"],
    ["/artikel/artikel-2/", "known"],
    ["/produk/ikan-mas", "unknown"],
    ["/artikel/tidak-ada", "unknown"],
    ["/produk/%E0%A4%A", "unknown"],
    ["/produk", "not_detail"],
    ["/mitra/artikel/artikel-1", "not_detail"],
  ])("%s → %s", (pathname, expected) => {
    expect(checkDetailRoute(pathname)).toBe(expected);
  });

  it("daftar slug sama dengan data awal di migrasi", () => {
    const sql = readFileSync(
      path.resolve(__dirname, "../../supabase/migrations/20261118000006_initial_content.sql"),
      "utf8",
    );
    for (const slug of [...KNOWN_PRODUCT_SLUGS, ...KNOWN_ARTICLE_SLUGS]) {
      expect(sql).toContain(`'${slug}'`);
    }
  });
});

describe("proxy", () => {
  it.each([
    ["/produk/ikan-mas", true],
    ["/artikel/tidak-ada", true],
    ["/mitra", true],
    ["/mitra/paket", true],
    ["/", false],
    ["/produk", false],
    ["/kontak", false],
  ])("matcher menjalankan proxy untuk %s: %s", (url, expected) => {
    expect(unstable_doesMiddlewareMatch({ config: proxyConfig, url })).toBe(expected);
  });

  it("slug tak dikenal → HTTP 404 dengan noindex, tanpa render halaman", async () => {
    const response = await proxy(new NextRequest("http://localhost/produk/ikan-mas"));
    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(await response.text()).toContain('<meta name="robots" content="noindex">');
  });

  it("slug dikenal diteruskan ke halaman", async () => {
    const response = await proxy(new NextRequest("http://localhost/artikel/artikel-2"));
    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });
});

describe("sitemap", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("tanpa URL situs (lokal) → kosong, tidak ada URL localhost", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    vi.stubEnv("VERCEL_URL", "");
    vi.stubEnv("VERCEL_ENV", "");
    expect(sitemap()).toEqual([]);
  });

  it("dengan URL situs → hanya halaman publik", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://contoh.vercel.app");
    const urls = sitemap().map((entry) => entry.url);
    expect(urls).toContain("https://contoh.vercel.app/produk/ikan-nila");
    expect(urls.some((url) => url.includes("/mitra"))).toBe(false);
    expect(urls.some((url) => url.includes("localhost"))).toBe(false);
  });
});
