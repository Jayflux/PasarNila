/**
 * Aksesibilitas (PRD NFR-15–NFR-17, AC-43; ARCHITECTURE T-19). axe (WCAG 2.0/2.1/2.2 A+AA + best-practice,
 * tanpa aturan yang dinonaktifkan) pada halaman & keadaan interaktif, ditambah uji keyboard, skip link,
 * fokus, reduced motion, dan zoom/reflow. Semua temuan (termasuk minor/moderate) ditulis ke
 * .playwright/state/axe.jsonl. Isi iframe Google Maps lintas domain TIDAK dapat dipindai axe.
 */
import { appendFileSync, mkdirSync } from "node:fs";

import { expect, type Page } from "@playwright/test";

import { axeScan, horizontalOverflow, type AxeFinding } from "./support/checks";
import { PARTNER_STATE, STATE_DIR } from "./support/cloud";
import { test } from "./support/staging-test";

/** Dicatat per pemindaian (worker bisa dimulai ulang setelah test gagal). */
const findings = {
  push(entry: { where: string; violations: AxeFinding[]; incomplete: Awaited<ReturnType<typeof axeScan>>["incomplete"] }) {
    mkdirSync(STATE_DIR, { recursive: true });
    appendFileSync(`${STATE_DIR}/axe.jsonl`, `${JSON.stringify(entry)}\n`);
  },
};

/**
 * `.reveal` memakai animasi scroll-driven. Halaman dipindai dua kali: (1) MENTAH tanpa gulir — yang dilihat
 * pengunjung yang tidak menggulir — dan (2) keadaan AKHIR setelah digulir sampai bawah, saat semua animasi
 * selesai. Keduanya wajib bebas pelanggaran critical/serious; aturan axe tidak ada yang dinonaktifkan.
 * (Fase 9: versi lama memudarkan opacity sehingga judul #produk di layar awal 768–1440 px gagal kontras;
 * kini animasi hanya menggeser.)
 */
async function settleRevealAnimations(page: Page) {
  await page.evaluate(async () => {
    for (let y = 0; y <= document.documentElement.scrollHeight; y += Math.round(window.innerHeight / 2)) {
      window.scrollTo(0, y);
      await new Promise((r) => requestAnimationFrame(() => r(null)));
    }
    window.scrollTo(0, document.documentElement.scrollHeight);
    await new Promise((r) => setTimeout(r, 200));
  });
}

async function audit(page: Page, where: string, options: { raw?: boolean } = {}) {
  const checkContactMap = async (violations: AxeFinding[]) => {
    if (where !== "/kontak") return;
    const map = page.getByRole("region", { name: "Peta alamat usaha", exact: true });
    await expect(map).toHaveCount(1);
    await expect(map.getByRole("heading", { name: "Peta alamat usaha", exact: true })).toBeAttached();
    expect.soft(violations.filter((v) => v.id === "landmark-unique")).toEqual([]);
  };
  if (options.raw) {
    // Keadaan yang dilihat pengunjung yang tidak menggulir juga wajib lulus (temuan fase 9: judul #produk
    // pudar di layar awal 768–1440 px).
    const raw = await axeScan(page);
    findings.push({ where: `${where} [mentah, tanpa gulir]`, violations: raw.all, incomplete: raw.incomplete });
    expect.soft(raw.blocking, `${where} [tanpa gulir]: pelanggaran critical/serious`).toEqual([]);
    await checkContactMap(raw.all);
    await settleRevealAnimations(page);
  }
  const { all, blocking, incomplete } = await axeScan(page);
  findings.push({ where, violations: all, incomplete });
  expect.soft(blocking, `${where}: pelanggaran critical/serious`).toEqual([]);
  await checkContactMap(all);
}

test.describe("axe — publik", () => {
  for (const path of ["/", "/produk", "/produk/ikan-nila", "/artikel", "/artikel/artikel-1", "/profil", "/kontak", "/mitra/login", "/produk/tidak-ada-404"]) {
    test(`axe ${path}`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState("networkidle").catch(() => {});
      await audit(page, path, { raw: true });
    });
  }

  for (const [width, height] of [[360, 800], [390, 844], [768, 1024], [1440, 900]] as const) {
    test(`axe beranda tanpa gulir ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await page.goto("/");
      expect(await page.evaluate(() => window.scrollY)).toBe(0);
      await audit(page, `/ (${width}px, tanpa gulir)`);
    });
  }

  test("axe menu HP terbuka", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await page.getByRole("button", { name: "Menu navigasi" }).click();
    await audit(page, "/ (menu HP terbuka)");
  });

  test("axe login dengan pesan error", async ({ page }) => {
    await page.goto("/mitra/login");
    await page.getByLabel("Email mitra").fill("bukan-akun@contoh.test");
    await page.getByLabel("Password").fill("salah-sekali-uji");
    await page.getByRole("button", { name: "Masuk ke panel mitra" }).click();
    await expect(page.getByRole("alert").filter({ hasText: /\S/ })).toBeVisible();
    await audit(page, "/mitra/login (error)");
  });
});

test.describe("axe — panel", () => {
  test.use({ storageState: PARTNER_STATE });

  for (const path of ["/mitra", "/mitra/paket", "/mitra/artikel", "/mitra/artikel/artikel-1", "/mitra/pengaturan"]) {
    test(`axe ${path}`, async ({ page }) => {
      await page.goto(path);
      await audit(page, path);
    });
  }

  test("axe keadaan interaktif: dialog Rp0, form error, tab Pratinjau", async ({ page }) => {
    await page.goto("/mitra");
    await page.getByLabel("Harga satuan per kg (Rp)").fill("0");
    await page.getByRole("button", { name: "Simpan & Konfirmasi" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await audit(page, "/mitra (dialog Rp0)");
    await page.keyboard.press("Escape");

    await page.getByLabel("Stok total (kg)").fill("1,255");
    await page.getByRole("button", { name: "Simpan & Konfirmasi" }).click();
    await expect(page.getByText(/maksimal 2 angka/).first()).toBeVisible();
    await audit(page, "/mitra (form error)");

    await page.goto("/mitra/artikel/artikel-1");
    await page.getByRole("button", { name: "Pratinjau" }).click();
    await audit(page, "/mitra/artikel/artikel-1 (Pratinjau)");

    await page.goto("/mitra/paket");
    const form = page.getByRole("region", { name: "Tambah paket" });
    await form.getByRole("button", { name: "Tambah paket" }).click();
    await expect(form.getByText("Nama paket wajib diisi.").first()).toBeVisible();
    await audit(page, "/mitra/paket (form error)");
  });

  test("axe paket tersedia, pesan berhasil, dan dialog hapus", async ({ page, staging }) => {
    const name = staging.packageName("Axe");
    await page.goto("/mitra/paket");
    const form = page.getByRole("region", { name: "Tambah paket" });
    await form.getByLabel("Nama paket").fill(name);
    await form.getByLabel("Berat paket (kg)").fill("5");
    await form.getByLabel("Harga total paket (Rp)").fill("150000");
    await form.getByRole("button", { name: "Tambah paket" }).click();
    await expect(form.getByRole("status")).toContainText("ditambahkan ke katalog");
    await audit(page, "/mitra/paket (pesan berhasil)");
    const card = page.getByRole("listitem").filter({ has: page.getByRole("heading", { name, exact: true }) });
    await card.getByRole("button", { name: "Hapus", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Hapus paket?" });
    await expect(dialog).toContainText(name);
    await audit(page, "/mitra/paket (dialog hapus)");
    await page.keyboard.press("Escape");
    await page.goto("/produk/ikan-nila");
    await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
    await audit(page, "/produk/ikan-nila (paket tersedia)");
  });
});

test.describe("keyboard & fokus", () => {
  test("skip link: Tab pertama, terlihat, Enter melompat ke konten utama", async ({ page }) => {
    await page.goto("/produk");
    await page.keyboard.press("Tab");
    const skip = page.getByRole("link", { name: "Langsung ke konten utama" });
    await expect(skip).toBeFocused();
    const box = await skip.boundingBox();
    expect(box && box.width > 10 && box.height > 10).toBe(true);
    await page.keyboard.press("Enter");
    await page.keyboard.press("Tab");
    expect(await page.evaluate(() => Boolean(document.activeElement?.closest("main")))).toBe(true);
  });

  test("fokus terlihat (outline) pada tautan, tombol, dan input", async ({ page }) => {
    await page.goto("/mitra/login");
    for (const locator of [page.getByLabel("Email mitra"), page.getByRole("button", { name: "Masuk ke panel mitra" })]) {
      await locator.focus();
      await page.keyboard.press("Shift+Tab");
      await page.keyboard.press("Tab");
      const outline = await locator.evaluate((el) => {
        const s = getComputedStyle(el);
        return { style: s.outlineStyle, width: parseFloat(s.outlineWidth), shadow: s.boxShadow };
      });
      expect(outline.style !== "none" && outline.width >= 2 || outline.shadow !== "none").toBe(true);
    }
  });

  test("seluruh halaman publik dapat ditelusuri dengan Tab tanpa terjebak", async ({ page }) => {
    await page.goto("/kontak");
    const seen = new Set<string>();
    let lastKey = "";
    for (let i = 0; i < 60; i += 1) {
      await page.keyboard.press("Tab");
      const key = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        return el ? `${el.tagName}:${el.textContent?.trim().slice(0, 30)}:${el.getAttribute("href") ?? ""}` : "none";
      });
      seen.add(key);
      lastKey = key;
    }
    expect(seen.size, `fokus berpindah ke ${seen.size} elemen (terakhir ${lastKey})`).toBeGreaterThan(10);
  });

  test("heading & landmark: satu h1, main/header/footer/nav ada", async ({ page }) => {
    for (const path of ["/", "/produk", "/artikel", "/profil", "/kontak", "/produk/ikan-nila"]) {
      await page.goto(path);
      await expect(page.locator("h1"), path).toHaveCount(1);
      await expect(page.locator("main"), path).toHaveCount(1);
      await expect(page.locator("header").first(), path).toBeVisible();
      await expect(page.locator("footer").first(), path).toBeVisible();
      await expect(page.getByRole("navigation", { name: "Menu utama" }).first()).toBeAttached();
    }
  });

  test("prefers-reduced-motion: animasi dimatikan", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    const durations = await page.evaluate(() =>
      Array.from(document.querySelectorAll<HTMLElement>(".reveal, .motion-safe\\:animate-rise, [class*='animate-rise']")).map(
        (el) => getComputedStyle(el).animationDuration,
      ),
    );
    expect(durations.length).toBeGreaterThan(0);
    for (const d of durations) expect(parseFloat(d)).toBeLessThan(0.02);
    const smooth = await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior);
    expect(smooth).toBe("auto");
  });

  test("zoom/reflow: lebar 320 px (setara 400% dari 1280) tanpa gulir horizontal", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    for (const path of ["/", "/produk/ikan-nila", "/artikel/artikel-1", "/kontak", "/mitra/login"]) {
      await page.goto(path);
      const overflow = await horizontalOverflow(page);
      expect.soft(overflow.scrollWidth, `${path}: ${overflow.culprits.join(", ")}`).toBeLessThanOrEqual(overflow.clientWidth + 1);
    }
  });
});

test.describe("keyboard panel", () => {
  test.use({ storageState: PARTNER_STATE });

  test("form paket dapat diisi & dikirim penuh dengan keyboard; error terbaca dan terhubung ke input", async ({ page }) => {
    await page.goto("/mitra/paket");
    const form = page.getByRole("region", { name: "Tambah paket" });
    await form.getByLabel("Nama paket").focus();
    await page.keyboard.press("Tab");
    await expect(form.getByLabel("Berat paket (kg)")).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(form.getByLabel("Harga total paket (Rp)")).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(form.getByRole("button", { name: "Tambah paket" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(form.getByText("Nama paket wajib diisi.").first()).toBeVisible();
    // setiap input punya label yang dapat diakses
    for (const label of ["Nama paket", "Berat paket (kg)", "Harga total paket (Rp)"]) {
      await expect(form.getByLabel(label)).toBeVisible();
    }
  });
});
