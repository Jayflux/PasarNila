/**
 * Keamanan pada build produksi lokal (ARCHITECTURE §9.7–§9.8, PRD NFR-03–NFR-08, AC-44). Nilai rahasia hanya
 * dibandingkan di memori; tidak pernah dicetak.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { expect, test } from "@playwright/test";

import { BASE_URL } from "../../playwright.config";
import { readEnvLocalFile } from "../support/cloud-target";
import { PARTNER_STATE } from "./support/cloud";

const distDir = process.env.PASARNILA_E2E_ISOLATED === "1" ? ".playwright/build-phase9" : ".next";

const SECURITY_HEADERS = {
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "strict-origin-when-cross-origin",
};

function files(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) files(p, out);
    else if (/\.(js|css|html|json|map)$/.test(name)) out.push(p);
  }
  return out;
}

test("header keamanan di halaman publik, panel, dan 404", async ({ request }) => {
  for (const p of ["/", "/produk/ikan-nila", "/kontak", "/mitra/login", "/mitra", "/produk/tidak-dikenal"]) {
    const res = await request.get(p, { maxRedirects: 0 });
    const h = res.headers();
    for (const [k, v] of Object.entries(SECURITY_HEADERS)) expect(h[k], `${p} ${k}`).toBe(v);
    expect(h["content-security-policy"], p).toContain("frame-ancestors 'none'");
    expect(h["permissions-policy"], p).toContain("camera=()");
    expect(h["x-powered-by"], p).toBeUndefined();
  }
});

test.describe("dengan sesi mitra", () => {
  test.use({ storageState: PARTNER_STATE });

  test("halaman panel ber-sesi: Cache-Control private/no-store, noindex", async ({ page }) => {
    for (const p of ["/mitra", "/mitra/paket", "/mitra/artikel", "/mitra/pengaturan"]) {
      const res = await page.goto(p);
      const cc = res?.headers()["cache-control"] ?? "";
      expect(cc, p).toContain("private");
      expect(cc, p).toContain("no-store");
      await expect(page.locator('meta[name="robots"]').first()).toHaveAttribute("content", /noindex/);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    }
  });

  test("pemisahan sesi: konteks browser lain tanpa cookie tidak melihat data panel", async ({ page, browser }) => {
    await page.goto("/mitra/paket");
    await expect(page.getByRole("region", { name: "Tambah paket" })).toBeVisible();
    // Playwright Test menerapkan opsi `use` (termasuk storageState mitra) ke newContext(); kosongkan eksplisit.
    const other = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const anon = await other.newPage();
    await anon.goto("/mitra/paket");
    await expect(anon).toHaveURL(/\/mitra\/login$/);
    await expect(anon.getByRole("region", { name: "Tambah paket" })).toHaveCount(0);
    // Halaman publik untuk pengunjung tidak memuat email/identitas mitra.
    await anon.goto("/");
    const { E2E_PARTNER_EMAIL = "" } = readEnvLocalFile() ?? {};
    expect(await anon.content()).not.toContain(E2E_PARTNER_EMAIL);
    await other.close();
  });
});

test("redirect login: /mitra/* tanpa sesi → /mitra/login, tanpa parameter tujuan eksternal", async ({ page }) => {
  for (const p of ["/mitra", "/mitra/paket", "/mitra/artikel/artikel-1", "/mitra/pengaturan"]) {
    await page.goto(p);
    await expect(page).toHaveURL(`${BASE_URL}/mitra/login`);
  }
  await page.goto("/mitra/login?next=https://contoh-jahat.test");
  await expect(page).toHaveURL(/\/mitra\/login/);
});

/** ID Server Action dari chunk klien hasil build (nama fungsi tercantum di samping ID). */
function actionId(name: string): string {
  for (const file of files(`${distDir}/static/chunks`)) {
    const text = readFileSync(file, "utf8");
    const index = text.indexOf(`"${name}"`);
    if (index < 0) continue;
    const ids = [...text.slice(Math.max(0, index - 300), index).matchAll(/"([0-9a-f]{40,})"/g)];
    if (ids.length) return ids[ids.length - 1]![1]!;
  }
  throw new Error(`ID action ${name} tidak ditemukan`);
}

test("Server Action: Origin asing ditolak, Origin sah dengan isian tidak lengkap tetap divalidasi", async ({ request }) => {
  const id = actionId("createPackageAction");
  const body = { "_1_operation": "create", "0": '["$K1"]' };
  const foreign = await request.post("/mitra/paket", {
    headers: { "Next-Action": id, Accept: "text/x-component", Origin: "https://contoh-jahat.test" },
    multipart: body,
    maxRedirects: 0,
  });
  expect(foreign.status(), "Origin asing").toBeGreaterThanOrEqual(400);
  expect(await foreign.text()).not.toContain("session_expired");
  const same = await request.post("/mitra/paket", {
    headers: { "Next-Action": id, Accept: "text/x-component", Origin: BASE_URL },
    multipart: body,
    maxRedirects: 0,
  });
  expect(same.status()).toBe(200);
  // Formulir tidak lengkap ditolak sebelum gerbang; yang penting action berjalan hanya untuk Origin sah.
  expect(await same.text()).toMatch(/"state":"(invalid|session_expired)"/);
});

test("tidak ada rahasia di bundle klien / output build", async () => {
  const env = readEnvLocalFile() ?? {};
  const secrets = ["SUPABASE_ACCESS_TOKEN", "SUPABASE_DB_PASSWORD", "SUPABASE_DB_URL", "E2E_PARTNER_PASSWORD", "E2E_OUTSIDER_PASSWORD"]
    .map((k) => env[k] ?? "")
    .filter((v) => v.length >= 6);
  const patterns = [/sb_secret_[A-Za-z0-9_-]{10,}/, /sbp_[A-Za-z0-9]{20,}/, /service_role/i, /postgres(ql)?:\/\/[^\s"']+:[^\s"'@]+@/];
  const hits: string[] = [];
  for (const file of files(`${distDir}/static`)) {
    const text = readFileSync(file, "utf8");
    for (const s of secrets) if (text.includes(s)) hits.push(`${file}: nilai rahasia .env.local`);
    for (const p of patterns) if (p.test(text)) hits.push(`${file}: pola ${p.source}`);
  }
  expect(hits).toEqual([]);
});

test("robots, sitemap, dan noindex: panel tidak terindeks, situs belum dibuka", async ({ request }) => {
  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toMatch(/Disallow: \//);
  const sitemap = await (await request.get("/sitemap.xml")).text();
  expect(sitemap).not.toContain("/mitra");
  for (const p of ["/", "/mitra/login"]) {
    const html = await (await request.get(p)).text();
    expect(html, p).toContain('<meta name="robots" content="noindex, nofollow"/>');
  }
});
