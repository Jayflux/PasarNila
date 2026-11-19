/**
 * Responsif (PRD NFR-01, NFR-02, AC-42; ARCHITECTURE T-18). Viewport dokumen (360, 768, 1280) + 390 & 1440.
 * Fixture data batas yang valid: paket nama 60 karakter, berat desimal, harga Rp999.999.999 (dibuat lewat RPC
 * mitra, dihapus setelah tiap test). Hasil per halaman/viewport ditulis ke .playwright/state/responsive.jsonl.
 */
import { appendFileSync, mkdirSync } from "node:fs";

import { expect } from "@playwright/test";

import { horizontalOverflow, smallInputText, smallTargets } from "./support/checks";
import { PARTNER_STATE, STATE_DIR } from "./support/cloud";
import { test } from "./support/staging-test";

const VIEWPORTS = [
  { name: "hp-360", width: 360, height: 800 },
  { name: "hp-390", width: 390, height: 844 },
  { name: "tablet-768", width: 768, height: 1024 },
  { name: "desktop-1280", width: 1280, height: 800 },
  { name: "desktop-1440", width: 1440, height: 900 },
];
const PUBLIC = ["/", "/produk", "/produk/ikan-nila", "/artikel", "/artikel/artikel-1", "/profil", "/kontak", "/mitra/login"];
const PANEL = ["/mitra", "/mitra/paket", "/mitra/artikel", "/mitra/artikel/artikel-1", "/mitra/pengaturan"];

const results = {
  push(entry: Record<string, unknown>) {
    mkdirSync(STATE_DIR, { recursive: true });
    appendFileSync(`${STATE_DIR}/responsive.jsonl`, `${JSON.stringify(entry)}\n`);
  },
};

async function inspect(page: import("@playwright/test").Page, path: string, viewport: string) {
  await page.goto(path);
  await page.waitForLoadState("networkidle").catch(() => {});
  const overflow = await horizontalOverflow(page);
  const targets = await smallTargets(page);
  const inputText = await smallInputText(page);
  results.push({ viewport, path, overflow: overflow.scrollWidth - overflow.clientWidth, culprits: overflow.culprits, smallTargets: targets, smallInputText: inputText });
  await page.screenshot({ path: `.playwright/screens/${viewport}${path.replace(/\//g, "_") || "_"}.png`, fullPage: true });
  expect.soft(overflow.scrollWidth, `${viewport} ${path} overflow: ${overflow.culprits.join(", ")}`).toBeLessThanOrEqual(overflow.clientWidth + 1);
  expect.soft(targets, `${viewport} ${path} target < 44px`).toEqual([]);
  expect.soft(inputText, `${viewport} ${path} teks input < 16px`).toEqual([]);
}

for (const vp of VIEWPORTS) {
  test.describe(`viewport ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test(`publik @${vp.name}`, async ({ page, staging }) => {
      const longName = staging.packageName("Paket untuk RT.");
      const decimal = staging.packageName("Desimal");
      expect(longName).toHaveLength(60);
      await staging.seedPackage(longName, "12.34", 999_999_999);
      await staging.seedPackage(decimal, "0.25", 9_000);
      for (const path of PUBLIC) await inspect(page, path, vp.name);
      // Kartu paket batas: nama panjang, harga besar, berat desimal terbaca utuh.
      await page.goto("/produk/ikan-nila");
      const card = (name: string) => page.getByRole("listitem").filter({ has: page.getByRole("heading", { name, exact: true }) });
      await expect(card(longName)).toContainText("Rp999.999.999");
      await expect(card(longName)).toContainText("12,34 kg");
      await expect(card(decimal)).toContainText("0,25 kg");
    });

    test.describe("panel", () => {
      test.use({ storageState: PARTNER_STATE });
      test(`panel @${vp.name}`, async ({ page, staging }) => {
        const name = staging.packageName("Paket untuk RT.");
        await staging.seedPackage(name, "12.34", 999_999_999);
        for (const path of PANEL) await inspect(page, path, vp.name);
        // Form error panjang di layar kecil
        await page.goto("/mitra/paket");
        const form = page.getByRole("region", { name: "Tambah paket" });
        await form.getByLabel("Nama paket").fill(" ");
        await form.getByLabel("Berat paket (kg)").fill("1.250,5");
        await form.getByLabel("Harga total paket (Rp)").fill("35.50");
        await form.getByRole("button", { name: "Tambah paket" }).click();
        await expect(form.getByText(/pemisah ribuan/).first()).toBeVisible();
        const overflow = await horizontalOverflow(page);
        expect.soft(overflow.scrollWidth, `${vp.name} error form`).toBeLessThanOrEqual(overflow.clientWidth + 1);
        // Dialog hapus muat di layar
        const card = page.getByRole("region", { name: "Paket tersimpan" }).getByRole("listitem")
          .filter({ has: page.getByRole("heading", { name, exact: true }) });
        await card.getByRole("button", { name: "Hapus" }).click();
        const dialog = page.getByRole("dialog", { name: "Hapus paket?" });
        await expect(dialog).toBeVisible();
        await expect(dialog).toContainText(name);
        const box = await dialog.boundingBox();
        expect.soft(box && box.x >= 0 && box.x + box.width <= vp.width + 1, `${vp.name} dialog muat`).toBe(true);
        await page.screenshot({ path: `.playwright/screens/${vp.name}_dialog-hapus.png` });
        await page.keyboard.press("Escape");
        // inputMode papan ketik angka
        await expect(form.getByLabel("Berat paket (kg)")).toHaveAttribute("inputmode", "decimal");
        await expect(form.getByLabel("Harga total paket (Rp)")).toHaveAttribute("inputmode", "numeric");
      });
    });
  });
}
