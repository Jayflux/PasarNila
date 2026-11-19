/**
 * Pengunjung (browser sungguhan, build produksi lokal + data staging). Tidak ada pesan WhatsApp yang dikirim:
 * hanya atribut `href` yang diperiksa, tautan tidak diklik.
 */
import { expect, test } from "@playwright/test";

import { OUTAGE_URL } from "../../playwright.config";
import { waText } from "./support/checks";
import { anonClient, originalValues } from "./support/cloud";

const PAGES = [
  { path: "/", heading: "Cek stok dan harga ikan nila sebelum memesan" },
  { path: "/produk", heading: "Produk" },
  { path: "/produk/ikan-nila", heading: "Ikan Nila" },
  { path: "/artikel", heading: "Artikel" },
  { path: "/profil", heading: null },
  { path: "/kontak", heading: null },
];

test.describe("navigasi & halaman publik", () => {
  for (const { path, heading } of PAGES) {
    test(`${path} tampil dengan judul, noindex, dan satu h1`, async ({ page }) => {
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
      await expect(page).toHaveTitle(/.+/);
      await expect(page.locator("h1")).toHaveCount(1);
      if (heading) await expect(page.locator("h1")).toHaveText(heading);
      await expect(page.locator("html")).toHaveAttribute("lang", "id");
    });
  }

  test("menu desktop membuka setiap halaman", async ({ page }) => {
    await page.goto("/");
    const nav = page.getByRole("navigation", { name: "Menu utama" }).first();
    for (const [label, url] of [
      ["Produk", /\/produk$/],
      ["Artikel", /\/artikel$/],
      ["Profil", /\/profil$/],
      ["Kontak", /\/kontak$/],
      ["Beranda", /\/$/],
    ] as const) {
      await nav.getByRole("link", { name: label, exact: true }).click();
      await expect(page).toHaveURL(url);
    }
  });

  test("menu HP: buka, Escape menutup & mengembalikan fokus, tautan berpindah halaman", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    const toggle = page.getByRole("button", { name: "Menu navigasi" });
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await page.keyboard.press("Escape");
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(toggle).toBeFocused();
    await toggle.click();
    const panelId = await toggle.getAttribute("aria-controls");
    await page.locator(`[id="${panelId}"]`).getByRole("link", { name: "Kontak" }).click();
    await expect(page).toHaveURL(/\/kontak$/);
  });

  test("produk & artikel: alur dari beranda ke detail", async ({ page }) => {
    await page.goto("/produk");
    await page.getByRole("link", { name: /Lihat detail & pilihan paket/ }).first().click();
    await expect(page).toHaveURL(/\/produk\/ikan-nila$/);
    await expect(page.getByRole("heading", { name: "Pilihan paket" })).toBeVisible();
    await page.goto("/artikel");
    const read = page.getByRole("link", { name: "Baca selengkapnya" });
    if ((await read.count()) > 0) {
      await read.first().click();
      await expect(page).toHaveURL(/\/artikel\/artikel-\d$/);
      await expect(page.locator("article h1")).toBeVisible();
    } else {
      await expect(page.getByText(/belum tersedia/).first()).toBeVisible();
    }
  });

  for (const path of ["/produk/ikan-mas", "/artikel/tidak-ada", "/halaman-ngawur"]) {
    test(`slug/halaman tak dikenal ${path} → 404 + noindex`, async ({ page }) => {
      const response = await page.goto(path);
      expect(response?.status()).toBe(404);
      await expect(page.getByText("Halaman tidak ditemukan")).toBeVisible();
      // Next menambah meta noindex sendiri untuk 404, di samping noindex global; semuanya harus noindex.
      for (const meta of await page.locator('meta[name="robots"]').all()) {
        await expect(meta).toHaveAttribute("content", /noindex/);
      }
    });
  }

  test("katalog tanpa paket: pesan wajar + jalur WhatsApp", async ({ page }) => {
    const { count, error } = await anonClient().from("product_packages").select("id", { count: "exact", head: true })
      .eq("product_id", originalValues().productId);
    expect(error?.code, "prasyarat katalog: Data API harus bisa dibaca").toBeUndefined();
    expect(count, "prasyarat katalog kosong; jangan hapus paket non-fixture").toBe(0);
    await page.goto("/produk/ikan-nila");
    const section = page.locator("section", { has: page.getByRole("heading", { name: "Pilihan paket" }) });
    await expect(section.getByText(/Belum ada pilihan paket/)).toBeVisible();
    await expect(section.getByRole("link", { name: /WhatsApp/ })).toHaveAttribute("href", /^https:\/\/wa\.me\/62\d+\?text=/);
  });

  test("peta: iframe berjudul + lazy, tombol Google Maps tautan terkonfirmasi, keterangan peta", async ({ page }) => {
    for (const path of ["/", "/profil", "/kontak"]) {
      await page.goto(path);
      const frame = page.locator('iframe[title^="Peta Google Maps untuk alamat"]');
      const caption = page.getByText("Peta mencari alamat tertulis dan bisa kurang tepat.");
      if (path === "/") {
        await expect(frame).toHaveCount(0);
        await caption.scrollIntoViewIfNeeded();
      }
      await expect(frame).toHaveCount(1);
      await expect(frame).toHaveAttribute("loading", "lazy");
      await expect(frame).toHaveAttribute("src", /^https:\/\/www\.google\.com\/maps\?q=.+&output=embed$/);
      await expect(caption).toBeVisible();
      const maps = page.getByRole("link", { name: /Buka di Google Maps/ }).first();
      await expect(maps).toHaveAttribute("href", "https://share.google/u0j1tZY5Q6MoMTD5P");
      await expect(maps).toHaveAttribute("target", "_blank");
      await expect(maps).toHaveAttribute("rel", /noopener/);
    }
  });

  test("beranda tanpa JavaScript: peta dan tautan alternatif tetap tersedia", async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    try {
      const page = await context.newPage();
      await page.goto("/");
      await expect(page.locator('noscript iframe[title^="Peta Google Maps untuk alamat"]')).toHaveAttribute("loading", "lazy");
      await expect(page.getByRole("link", { name: /Buka di Google Maps/ }).first()).toBeVisible();
    } finally {
      await context.close();
    }
  });

  test("tautan WhatsApp: nomor dari konfigurasi, isi pesan, tab baru (tidak dikirim)", async ({ page }) => {
    await page.goto("/produk/ikan-nila");
    const links = page.locator('a[href^="https://wa.me/"]');
    expect(await links.count()).toBeGreaterThan(0);
    for (const link of await links.all()) {
      await expect(link).toHaveAttribute("target", "_blank");
      await expect(link).toHaveAttribute("rel", /noopener/);
    }
    const texts = await Promise.all((await links.all()).map(async (l) => waText(await l.getAttribute("href"))));
    expect(texts.some((t) => /Ikan Nila/.test(t))).toBe(true);
    expect(texts.every((t) => !/\b\d+(?:[.,]\d+)? kg\b/.test(t) || /paket/.test(t))).toBe(true);
  });

  test("loading: kerangka Suspense tersedia (shell statis tampil sebelum data)", async ({ page }) => {
    // Shell prerender memuat skeleton aria-busy; data mengganti kerangka saat stream selesai.
    const html = await (await page.request.get("/produk/ikan-nila")).text();
    expect(html).toMatch(/aria-busy="true"/);
    await page.goto("/produk/ikan-nila");
    await expect(page.locator("[aria-busy=true]")).toHaveCount(0);
  });
});

test.describe("keadaan gagal muat (server uji gangguan, cloud tidak dihubungi)", () => {
  for (const path of ["/", "/produk", "/produk/ikan-nila"]) {
    test(`${path}: pesan gangguan, tanpa angka fiktif, WhatsApp tetap ada`, async ({ page }) => {
      await page.goto(OUTAGE_URL + path);
      await expect(page.getByText("Informasi stok dan harga sedang tidak dapat dimuat").first()).toBeVisible({ timeout: 30_000 });
      const main = await page.locator("main").innerText();
      expect(main).not.toMatch(/Rp\d|Belum tersedia|Stok habis|Hemat/);
      await expect(page.locator('main a[href^="https://wa.me/"]').first()).toBeVisible();
    });
  }

  test("/artikel: pesan gagal muat artikel", async ({ page }) => {
    await page.goto(OUTAGE_URL + "/artikel");
    await expect(page.getByText("Artikel sedang tidak dapat dimuat")).toBeVisible({ timeout: 30_000 });
  });
});
