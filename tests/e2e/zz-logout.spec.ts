/**
 * Logout (AC-23). Berjalan PALING AKHIR (urutan nama file, satu worker) karena `signOut()` global mencabut
 * semua sesi akun mitra uji, termasuk sesi bersama yang dipakai spesifikasi lain.
 */
import { expect, test } from "@playwright/test";

import { cloudTarget } from "./support/cloud";

test.use({ storageState: { cookies: [], origins: [] } });

test("login lalu logout: kembali ke login, panel meminta login ulang", async ({ page }) => {
  const { partner } = cloudTarget();
  await page.goto("/mitra/login");
  await page.getByLabel("Email mitra").fill(partner!.email);
  await page.getByLabel("Password").fill(partner!.password);
  await page.getByRole("button", { name: "Masuk ke panel mitra" }).click();
  await expect(page).toHaveURL(/\/mitra$/);
  await page.getByRole("button", { name: "Keluar" }).click();
  await expect(page).toHaveURL(/\/mitra\/login$/);
  await page.goto("/mitra/paket");
  await expect(page).toHaveURL(/\/mitra\/login$/);
});
