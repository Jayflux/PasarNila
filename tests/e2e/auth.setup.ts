import { expect, test as setup } from "@playwright/test";

import { cloudTarget, PARTNER_STATE } from "./support/cloud";

/** Login mitra lewat UI sungguhan sekali, lalu simpan sesi ke .playwright/ (diabaikan Git). */
setup("login mitra lewat formulir", async ({ page }) => {
  const { partner } = cloudTarget();
  await page.goto("/mitra/login");
  await page.getByLabel("Email mitra").fill(partner!.email);
  await page.getByLabel("Password").fill(partner!.password);
  await page.getByRole("button", { name: "Masuk ke panel mitra" }).click();
  await expect(page).toHaveURL(/\/mitra$/);
  await expect(page.getByRole("heading", { name: "Stok & harga satuan" })).toBeVisible();
  await page.context().storageState({ path: PARTNER_STATE });
});
