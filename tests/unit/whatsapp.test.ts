import { describe, expect, it } from "vitest";

import { WHATSAPP_MESSAGE_TEMPLATES } from "@/config/whatsapp-messages";
import {
  buildProductUrl,
  buildWhatsAppMessage,
  buildWhatsAppUrl,
  resolveWhatsAppConfig,
} from "@/lib/whatsapp";

// Nomor uji fiktif berpola valid. Bukan nomor usaha.
const TEST_NUMBER = "6281200000000";

describe("resolveWhatsAppConfig — normalisasi (ARCHITECTURE §13.2)", () => {
  it.each([
    ["6281200000000", TEST_NUMBER],
    ["+6281200000000", TEST_NUMBER],
    ["+62 812-0000-0000", TEST_NUMBER],
    ["081200000000", TEST_NUMBER],
    ["0812 0000 0000", TEST_NUMBER],
    ["(0812) 0000-0000", TEST_NUMBER],
    ["81200000000", TEST_NUMBER],
    ["  6281200000000  ", TEST_NUMBER],
  ])("%j → %s", (raw, number) => {
    expect(resolveWhatsAppConfig(raw)).toEqual({ configured: true, number });
  });

  it("format nomor production dari klien (PRD BR-WA5) lolos validasi", () => {
    expect(resolveWhatsAppConfig("6281575723540")).toEqual({
      configured: true,
      number: "6281575723540",
    });
  });

  it.each([undefined, null, "", "   "])("kosong (%j) → missing", (raw) => {
    expect(resolveWhatsAppConfig(raw)).toEqual({ configured: false, reason: "missing" });
  });

  it.each([
    "0812abc00000", // huruf tidak dibuang diam-diam
    "+62 0812 0000 0000", // salah tulis: menjadi 620812…
    "620812000000",
    "006281200000000", // awalan internasional 00
    "+1 555 000 0000", // bukan nomor Indonesia
    "62812", // terlalu pendek
    "62812000000000000", // terlalu panjang
    "6281200000000+",
    "++6281200000000",
    "12345678",
    "nomor-belum-ada",
  ])("tidak valid: %j", (raw) => {
    expect(resolveWhatsAppConfig(raw)).toEqual({ configured: false, reason: "invalid" });
  });
});

describe("buildWhatsAppUrl (BR-WA1, BR-WA3, AC-14)", () => {
  it("nomor valid → tautan wa.me dengan pesan ter-encode", () => {
    const url = buildWhatsAppUrl(
      { configured: true, number: TEST_NUMBER },
      "Halo, stok Ikan Nila & harga?",
    );
    expect(url).toBe(
      `https://wa.me/${TEST_NUMBER}?text=Halo%2C%20stok%20Ikan%20Nila%20%26%20harga%3F`,
    );
  });

  it("belum dikonfigurasi → null (tidak ada tautan sama sekali)", () => {
    expect(buildWhatsAppUrl({ configured: false, reason: "missing" }, "Halo")).toBeNull();
    expect(buildWhatsAppUrl({ configured: false, reason: "invalid" }, "Halo")).toBeNull();
  });

  it("tidak pernah menghasilkan wa.me tanpa nomor", () => {
    const url = buildWhatsAppUrl(resolveWhatsAppConfig(""), "Halo");
    expect(url).toBeNull();
  });
});

describe("buildProductUrl", () => {
  it("menyusun URL produk dari origin situs", () => {
    expect(buildProductUrl(new URL("https://contoh.vercel.app"), "ikan-nila")).toBe(
      "https://contoh.vercel.app/produk/ikan-nila",
    );
  });

  it("tanpa URL situs → null", () => {
    expect(buildProductUrl(null, "ikan-nila")).toBeNull();
  });

  it("menolak slug tidak valid", () => {
    expect(() => buildProductUrl(null, "../admin")).toThrow(RangeError);
  });
});

describe("buildWhatsAppMessage (PRD §12.4, BR-WA2, BR-WA4)", () => {
  const productUrl = "https://contoh.vercel.app/produk/ikan-nila";

  it("produk tersedia menyebut nama produk dan tautan", () => {
    expect(
      buildWhatsAppMessage("product_available", { productName: "Ikan Nila", productUrl }),
    ).toBe(
      `Halo, saya melihat produk Ikan Nila di website dan ingin bertanya/memesan. Apakah masih tersedia? ${productUrl}`,
    );
  });

  it("stok habis menanyakan kapan tersedia lagi (AC-16)", () => {
    const message = buildWhatsAppMessage("product_out_of_stock", {
      productName: "Ikan Nila",
      productUrl,
    });
    expect(message).toContain("Ikan Nila");
    expect(message).toContain("kapan tersedia lagi");
  });

  it("belum tersedia / gagal dimuat menanyakan ketersediaan dan harga", () => {
    expect(buildWhatsAppMessage("product_unknown", { productName: "Ikan Nila" })).toBe(
      "Halo, saya ingin menanyakan ketersediaan dan harga Ikan Nila.",
    );
  });

  it("pesan umum memakai nama usaha dari pengaturan", () => {
    expect(buildWhatsAppMessage("general", { businessName: "Nama Uji Usaha" })).toBe(
      "Halo Nama Uji Usaha, saya ingin bertanya tentang ikan nila.",
    );
  });

  it("variabel kosong dihilangkan dengan rapi", () => {
    expect(buildWhatsAppMessage("general", { businessName: "" })).toBe(
      "Halo, saya ingin bertanya tentang ikan nila.",
    );
    expect(
      buildWhatsAppMessage("product_available", { productName: "Ikan Nila", productUrl: null }),
    ).toBe(
      "Halo, saya melihat produk Ikan Nila di website dan ingin bertanya/memesan. Apakah masih tersedia?",
    );
  });

  it("spasi berlebih dan baris baru pada nilai dirapikan", () => {
    expect(buildWhatsAppMessage("general", { businessName: "  Nama \n  Uji  " })).toBe(
      "Halo Nama Uji, saya ingin bertanya tentang ikan nila.",
    );
  });

  it("templat tidak mencantumkan angka stok/harga (BR-WA4)", () => {
    for (const template of Object.values(WHATSAPP_MESSAGE_TEMPLATES)) {
      expect(template).not.toMatch(/\d/);
      expect(template).not.toMatch(/Rp|\bkg\b/i);
    }
  });

  it("nama berisi karakter khusus tetap aman di URL", () => {
    const message = buildWhatsAppMessage("general", { businessName: "<b>Ikan</b> & Co" });
    const url = buildWhatsAppUrl({ configured: true, number: TEST_NUMBER }, message);
    expect(url).not.toContain("<");
    expect(url).not.toContain("&Co");
    expect(decodeURIComponent(new URL(url ?? "").searchParams.get("text") ?? "")).toBe(
      "Halo <b>Ikan</b> & Co, saya ingin bertanya tentang ikan nila.",
    );
  });
});
