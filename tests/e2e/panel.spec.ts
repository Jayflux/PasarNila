/**
 * Mitra (browser sungguhan, build produksi lokal + proyek staging). Satu worker; fixture dibersihkan
 * setelah setiap test, dengan global teardown sebagai pengaman.
 */
import { expect, type Page } from "@playwright/test";

import { OUTAGE_URL } from "../../playwright.config";
import { horizontalOverflow, waText } from "./support/checks";
import { cloudTarget, FIXTURE_PREFIX, originalValues, PARTNER_STATE } from "./support/cloud";
import { test } from "./support/staging-test";

test.use({ storageState: PARTNER_STATE });

const status = (page: Page) => page.getByRole("status").filter({ hasText: /\S/ });
const idr = (n: number) => `Rp${n.toLocaleString("id-ID")}`;

async function saveStockPrice(page: Page, stock: string, price: string) {
  await page.goto("/mitra");
  await page.getByLabel("Stok total (kg)").fill(stock);
  await page.getByLabel("Harga satuan per kg (Rp)").fill(price);
  await page.getByRole("button", { name: "Simpan & Konfirmasi" }).click();
}

/**
 * Kunci kartu ke UUID dari form hapus yang tetap terpasang saat judul berganti ke "Ubah paket".
 */
async function packageCard(page: Page, name: string) {
  const items = page.getByRole("region", { name: "Paket tersimpan" }).getByRole("listitem");
  const match = items.filter({ has: page.getByRole("heading", { name, exact: true }) });
  await expect(match).toHaveCount(1);
  const id = await match.locator('form[hidden] input[name="packageId"]').inputValue();
  expect(id).toMatch(/^[a-f0-9-]{36}$/i);
  return items.filter({ has: page.locator(`form[hidden] input[name="packageId"][value="${id}"]`) });
}

async function addPackage(page: Page, name: string, weight: string, price: string) {
  const form = page.getByRole("region", { name: "Tambah paket" });
  await form.getByLabel("Nama paket").fill(name);
  await form.getByLabel("Berat paket (kg)").fill(weight);
  await form.getByLabel("Harga total paket (Rp)").fill(price);
  await form.getByRole("button", { name: "Tambah paket" }).click();
  await expect(form.getByRole("status")).toContainText("ditambahkan ke katalog");
}

test.describe("panel mitra", () => {
  test("stok & harga: pembaruan lewat keyboard, pesan memuat angka + waktu WIB, lalu konfirmasi ulang", async ({ page, staging }) => {
    staging.trackBusiness("stockPrice");
    await page.goto("/mitra");
    const stock = page.getByLabel("Stok total (kg)");
    await stock.focus();
    await stock.fill("999,5");
    await page.keyboard.press("Tab");
    await expect(page.getByLabel("Harga satuan per kg (Rp)")).toBeFocused();
    await page.keyboard.press("Control+A");
    await page.keyboard.type("36.000");
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Simpan & Konfirmasi" })).toBeFocused();
    await page.keyboard.press("Enter");
    const message = status(page).first();
    await expect(message).toContainText("Data diperbarui");
    await expect(message).toContainText("999,5 kg");
    await expect(message).toContainText("Rp36.000 / kg");
    await expect(message).toContainText(/\d{1,2} \w+ \d{4} pukul \d{2}\.\d{2} WIB/);
    // aria-live: pesan berada di dalam wilayah yang diumumkan
    await expect(page.locator('[aria-live="polite"]').first()).toContainText("Data diperbarui");

    const confirmed = (await staging.readBusiness()).confirmedAt;
    await page.getByRole("button", { name: "Simpan & Konfirmasi" }).click();
    await expect(status(page).first()).toContainText("Data dikonfirmasi ulang (tidak ada perubahan angka)");
    expect(Date.parse((await staging.readBusiness()).confirmedAt!)).toBeGreaterThan(Date.parse(confirmed!));

    await page.goto("/produk/ikan-nila");
    await expect(page.getByText("999,5 kg").first()).toBeVisible();
    await expect(page.getByText("Rp36.000 / kg").first()).toBeVisible();
  });

  test("dialog harga Rp0: fokus awal Batal, fokus terkunci, Esc membatalkan & mengembalikan fokus, tanpa simpan", async ({ page }) => {
    await page.goto("/mitra");
    await page.getByLabel("Harga satuan per kg (Rp)").fill("0");
    const submit = page.getByRole("button", { name: "Simpan & Konfirmasi" });
    await submit.click();
    const dialog = page.getByRole("dialog", { name: "Harga Rp0 / kg" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Batal" })).toBeFocused();
    // <dialog> modal bawaan membuat halaman di belakangnya inert: Tab berputar di dalam dialog dan boleh
    // singgah ke UI browser (activeElement = body), tetapi TIDAK PERNAH ke elemen halaman di luar dialog.
    const visited = new Set<string>();
    for (let i = 0; i < 6; i += 1) {
      await page.keyboard.press("Tab");
      const where = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el || el === document.body) return "browser";
        return el.closest("dialog") ? `dialog:${el.textContent?.trim()}` : `LUAR:${el.tagName}:${el.textContent?.trim().slice(0, 20)}`;
      });
      visited.add(where);
      expect(where.startsWith("LUAR"), `fokus keluar ke ${where}`).toBe(false);
    }
    expect(visited).toContain("dialog:Batal");
    expect(visited).toContain("dialog:Ya, simpan Rp0");
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(submit).toBeFocused();
    await expect(page.getByLabel("Harga satuan per kg (Rp)")).toHaveValue("0");
    await expect(status(page)).toHaveCount(0);
  });

  test("stok habis dan harga Rp0: konfirmasi eksplisit, angka terbaru setelah reload, isi tautan WhatsApp", async ({ page, context, staging }) => {
    const visitor = await context.newPage();
    await visitor.goto("/produk/ikan-nila");
    const previous = await staging.readBusiness();
    staging.trackBusiness("stockPrice");
    await saveStockPrice(page, "0", "0");
    const dialog = page.getByRole("dialog", { name: "Harga Rp0 / kg" });
    await expect(dialog).toBeVisible();
    expect((await staging.readBusiness()).confirmedAt).toBe(previous.confirmedAt);
    await dialog.getByRole("button", { name: "Ya, simpan Rp0" }).click();
    await expect(status(page)).toContainText(/Data (diperbarui|dikonfirmasi ulang)/);
    await visitor.reload();
    await expect(visitor.getByText("Stok habis", { exact: true }).first()).toBeVisible();
    await expect(visitor.getByText("Rp0 / kg", { exact: true }).first()).toBeVisible();
    const link = visitor.locator('main a[href^="https://wa.me/"]').first();
    expect(waText(await link.getAttribute("href"))).toContain("kapan tersedia lagi");
  });

  test("paket: tambah (klik ganda tidak menggandakan), Hemat sesuai rumus, harga satuan tidak menimpa harga paket", async ({ page, staging }) => {
    staging.trackBusiness("stockPrice");
    await saveStockPrice(page, "999,5", "36000");
    await expect(status(page)).toContainText(/Data (diperbarui|dikonfirmasi ulang)/);
    await page.goto("/mitra/paket");
    const form = page.getByRole("region", { name: "Tambah paket" });
    const name = staging.packageName("Hemat");
    await form.getByLabel("Nama paket").fill(name);
    await form.getByLabel("Berat paket (kg)").fill("100");
    await form.getByLabel("Harga total paket (Rp)").fill("3.100.000");
    // Pratinjau di panel pada harga satuan Rp36.000 yang disiapkan oleh test ini.
    await expect(form.getByText("Hemat Rp500.000")).toBeVisible();
    await form.getByRole("button", { name: "Tambah paket" }).dblclick();
    await expect(form.getByRole("status")).toContainText("ditambahkan ke katalog");
    await page.reload();
    await expect(await packageCard(page, name)).toHaveCount(1);

    await page.goto("/produk/ikan-nila");
    const card = page.locator("li", { has: page.getByRole("heading", { name }) });
    await expect(card).toContainText("Rp3.100.000");
    await expect(card).toContainText("Hemat Rp500.000");
    await expect(card).toContainText("Setara Rp31.000/kg");

    // Harga satuan berubah → harga paket tetap, hanya Hemat yang dihitung ulang.
    await saveStockPrice(page, "999,5", "35000");
    await expect(status(page).first()).toContainText(/Data (diperbarui|dikonfirmasi ulang|tersimpan)/);
    await page.goto("/produk/ikan-nila");
    const after = page.locator("li", { has: page.getByRole("heading", { name }) });
    await expect(after).toContainText("Rp3.100.000");
    await expect(after).toContainText("Hemat Rp400.000");
  });

  test("paket: ubah (berat desimal), harga sama/lebih tinggi tanpa Hemat, hapus lewat dialog yang menyebut paket", async ({ page, staging }) => {
    staging.trackBusiness("stockPrice");
    await saveStockPrice(page, "999,5", "35000");
    await expect(status(page)).toContainText(/Data (diperbarui|dikonfirmasi ulang)/);
    const name = staging.packageName("Edit");
    const same = staging.packageName("Sama");
    const higher = staging.packageName("Mahal");
    await staging.seedPackage(name, "100", 3_100_000);
    await page.goto("/mitra/paket");
    const card = await packageCard(page, name);
    await card.getByRole("button", { name: "Ubah" }).click();
    await expect(card.getByLabel("Nama paket")).toHaveValue(name);
    await card.getByLabel("Berat paket (kg)").fill("12,5");
    await card.getByLabel("Harga total paket (Rp)").fill("400000");
    await card.getByRole("button", { name: "Simpan perubahan" }).click();
    await expect(card.getByRole("status")).toContainText("Paket diperbarui");
    await expect(card).toContainText("12,5 kg");

    await addPackage(page, same, "10", "350.000");
    await addPackage(page, higher, "1", "40.000");
    await page.goto("/produk/ikan-nila");
    const unit = 35_000;
    await expect(page.locator("li", { has: page.getByRole("heading", { name }) })).toContainText(`Hemat ${idr(12.5 * unit - 400_000)}`);
    for (const plain of [same, higher]) {
      const li = page.locator("li", { has: page.getByRole("heading", { name: plain }) });
      await expect(li).toBeVisible();
      await expect(li).not.toContainText("Hemat");
    }
    const link = await page.locator("li", { has: page.getByRole("heading", { name }) }).getByRole("link").getAttribute("href");
    expect(waText(link)).toContain(`paket ${name} (12,5 kg) seharga Rp400.000`);

    await page.goto("/mitra/paket");
    for (const target of [name, same, higher]) {
      const li = await packageCard(page, target);
      const removeButton = li.getByRole("button", { name: "Hapus" });
      await removeButton.click();
      const dialog = page.getByRole("dialog", { name: "Hapus paket?" });
      await expect(dialog).toContainText(target);
      if (target === name) {
        await page.keyboard.press("Escape");
        await expect(dialog).toBeHidden();
        await expect(removeButton).toBeFocused();
        await removeButton.click();
      }
      await dialog.getByRole("button", { name: "Ya, hapus paket" }).click();
      await expect(page.getByRole("status").filter({ hasText: `Paket “${target}” dihapus` })).toBeVisible();
    }
    await page.reload();
    for (const target of [name, same, higher]) await expect(page.getByRole("heading", { name: target, exact: true })).toHaveCount(0);
  });

  test("editor artikel: Sunting/Pratinjau, simpan dari kedua tab, error terlihat di Pratinjau, Markdown berbahaya aman", async ({ page, staging }) => {
    const o = originalValues();
    staging.trackBusiness("article");
    await page.goto("/mitra/artikel/artikel-1");
    const editTab = page.getByRole("button", { name: "Sunting" });
    const previewTab = page.getByRole("button", { name: "Pratinjau" });
    const save = page.getByRole("button", { name: "Simpan perubahan artikel" });

    // Error dari tab Pratinjau terlihat & isian tetap.
    await page.getByLabel("Judul artikel").fill("");
    await previewTab.click();
    await expect(previewTab).toHaveAttribute("aria-pressed", "true");
    await save.click();
    await expect(page.getByRole("alert").filter({ hasText: "Perbaiki isian berikut" })).toBeVisible();
    await page.getByRole("button", { name: "Kembali ke mode sunting" }).click();
    await expect(page.getByLabel("Judul artikel")).toHaveValue("");

    // Konten uji: HTML/skrip & tautan javascript: harus tampil aman.
    // Tanpa penanda [PLACEHOLDER]: bila judul/isi memuatnya, halaman publik sengaja menampilkan placeholder
    // (BR-A4) sehingga jalur render Markdown tidak teruji. Nilai asli dipulihkan di akhir test & teardown.
    const dangerous = `Isi uji otomatis.\n\n**${FIXTURE_PREFIX} tebal** <script>window.__xss = 1</script> [uji](javascript:window.__xss=2)`;
    await page.getByLabel("Judul artikel").fill(`${FIXTURE_PREFIX} judul artikel uji`);
    await page.getByLabel("Isi artikel").fill(dangerous);
    await previewTab.click();
    await expect(page.locator("strong", { hasText: `${FIXTURE_PREFIX} tebal` })).toBeVisible();
    await save.click(); // simpan dari tab Pratinjau
    await expect(status(page).first()).toContainText("Artikel tersimpan");

    await page.goto("/artikel/artikel-1");
    await expect(page.locator("h1")).toContainText(FIXTURE_PREFIX);
    await expect(page.locator("article strong", { hasText: `${FIXTURE_PREFIX} tebal` })).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined();
    await expect(page.locator('a[href^="javascript:"]')).toHaveCount(0);
    await expect(page.getByText("<script>window.__xss = 1</script>")).toBeVisible();

    // Pulihkan isi asli dari tab Sunting.
    await page.goto("/mitra/artikel/artikel-1");
    await editTab.click();
    await page.getByLabel("Judul artikel").fill(o.articleTitle);
    await page.getByLabel("Isi artikel").fill(o.articleBody);
    await save.click();
    await expect(status(page).first()).toContainText("Artikel tersimpan");
  });

  test("nama usaha panjang: tampil di publik setelah reload, header tidak meluap di 360 px, lalu dipulihkan", async ({ page, staging }) => {
    const o = originalValues();
    staging.trackBusiness("settings");
    const longName = `${FIXTURE_PREFIX} Nama Usaha Sangat Panjang untuk Menguji Tata Letak Header dan Footer`.slice(0, 80);
    await page.goto("/mitra/pengaturan");
    await page.getByLabel("Nama usaha").fill(longName);
    await page.getByRole("button", { name: "Simpan nama usaha" }).click();
    await expect(status(page).first()).toContainText(`Nama usaha disimpan: “${longName}”`);
    try {
      await page.setViewportSize({ width: 360, height: 800 });
      for (const path of ["/", "/kontak", "/produk/ikan-nila"]) {
        await page.goto(path);
        await expect(page.locator("header").first()).toContainText(longName);
        const overflow = await horizontalOverflow(page);
        expect(overflow.scrollWidth, overflow.culprits.join(", ")).toBeLessThanOrEqual(overflow.clientWidth + 1);
      }
      await expect(page).toHaveTitle(new RegExp(FIXTURE_PREFIX));
    } finally {
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto("/mitra/pengaturan");
      await page.getByLabel("Nama usaha").fill(o.businessName);
      await page.getByRole("button", { name: "Simpan nama usaha" }).click();
      await expect(status(page).first()).toContainText(`Nama usaha disimpan: “${o.businessName}”`);
    }
    await page.goto("/kontak");
    await expect(page.locator("header").first()).toContainText(o.businessName);
    await expect(page.locator("header").first()).not.toContainText(FIXTURE_PREFIX);
  });

  test("sesi berakhir saat formulir terbuka: pesan sesi, isian tetap, tidak ada yang tersimpan", async ({ page, context, staging }) => {
    const name = staging.packageName("Sesi");
    await page.goto("/mitra/paket");
    const form = page.getByRole("region", { name: "Tambah paket" });
    await form.getByLabel("Nama paket").fill(name);
    await form.getByLabel("Berat paket (kg)").fill("5");
    await form.getByLabel("Harga total paket (Rp)").fill("150000");
    await context.clearCookies();
    await form.getByRole("button", { name: "Tambah paket" }).click();
    await expect(form.getByRole("alert")).toContainText("Sesi Anda telah berakhir");
    await expect(form.getByRole("link", { name: "Login ulang di tab baru" })).toBeVisible();
    await expect(form.getByLabel("Nama paket")).toHaveValue(name);
    await expect(form.getByLabel("Harga total paket (Rp)")).toHaveValue("150000");
    await page.goto("/produk/ikan-nila");
    const offers = page.getByRole("region", { name: "Pilihan paket" });
    await expect(offers).toBeVisible();
    await expect(offers.getByRole("heading", { name, exact: true })).toHaveCount(0);
  });

  test("koneksi putus saat kirim: belum pasti (bukan 'tidak berubah'), isian tetap, Periksa ulang, simpan lagi tidak ganda", async ({ page, staging }) => {
    await page.goto("/mitra/paket");
    const form = page.getByRole("region", { name: "Tambah paket" });
    const name = staging.packageName("Putus");
    await form.getByLabel("Nama paket").fill(name);
    await form.getByLabel("Berat paket (kg)").fill("5");
    await form.getByLabel("Harga total paket (Rp)").fill("150000");
    await page.route("**/mitra/paket", (route) =>
      route.request().method() === "POST" ? route.abort("connectionreset") : route.continue(),
    );
    await form.getByRole("button", { name: "Tambah paket" }).click();
    const notice = form.getByRole("alert");
    await expect(notice).toContainText("Status penyimpanan belum dapat dipastikan");
    await expect(notice).toContainText("Koneksi ke server terputus");
    await expect(notice).not.toContainText("tidak berubah");
    await expect(form.getByLabel("Nama paket")).toHaveValue(name);

    await page.unroute("**/mitra/paket");
    await notice.getByRole("button", { name: "Periksa ulang" }).click();
    await expect(form.getByRole("alert")).toContainText("belum terlihat tersimpan");
    await form.getByRole("button", { name: "Tambah paket" }).click();
    await expect(form.getByRole("status")).toContainText("ditambahkan ke katalog");
    await page.reload();
    const saved = await packageCard(page, name);
    await expect(saved).toHaveCount(1);

    // Fixture staging menghapus paket meskipun assertion sebelum titik ini gagal.
  });

  test("pemeriksaan akses gagal sementara: pesan gangguan, BUKAN 'akses ditolak', tanpa formulir", async ({ page }) => {
    await page.goto(`${OUTAGE_URL}/mitra/paket`);
    await expect(page.getByRole("alert").filter({ hasText: "Pemeriksaan akses sedang terganggu" })).toBeVisible({ timeout: 30_000 });
    await expect(page).not.toHaveURL(/akses-ditolak|login/);
    await expect(page.getByRole("region", { name: "Tambah paket" })).toHaveCount(0);
  });
});

test.describe("akun non-mitra", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("login non-mitra ditolak dengan pesan akses; panel tetap tertutup", async ({ page }) => {
    const { outsider } = cloudTarget();
    await page.goto("/mitra/login");
    await page.getByLabel("Email mitra").fill(outsider!.email);
    await page.getByLabel("Password").fill(outsider!.password);
    await page.getByRole("button", { name: "Masuk ke panel mitra" }).click();
    await expect(page.getByRole("alert").filter({ hasText: /\S/ })).toHaveText("Akun ini tidak memiliki akses ke panel");
    await expect(page.getByLabel("Email mitra")).toHaveValue(outsider!.email);
    await page.goto("/mitra/paket");
    await expect(page).toHaveURL(/\/mitra\/login$/);
  });

  test("password salah → pesan umum, tanpa membocorkan akun", async ({ page }) => {
    const { partner } = cloudTarget();
    await page.goto("/mitra/login");
    await page.getByLabel("Email mitra").fill(partner!.email);
    await page.getByLabel("Password").fill("password-salah-uji-e2e");
    await page.getByRole("button", { name: "Masuk ke panel mitra" }).click();
    await expect(page.getByRole("alert").filter({ hasText: /\S/ })).toHaveText("Email atau password salah");
  });
});
