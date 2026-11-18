/**
 * Perhitungan harga paket (PRD §12.8 BR-PK5–BR-PK8; ARCHITECTURE §11.4) dan validasi input paket.
 */
import { describe, expect, it } from "vitest";

import {
  comparisonLabel,
  computePackagePricing,
  effectivePerKgLabel,
  packageAvailability,
  savingsBadgeLabel,
} from "@/lib/domain/package-pricing";
import { parsePackagePriceInput, parsePackageWeightInput } from "@/lib/validation/stock-price-input";
import { validatePackageName } from "@/lib/validation/text-input";

describe("pembanding, penghematan, harga efektif", () => {
  it("contoh PRD: 100 kg, Rp3.100.000, harga satuan Rp35.000/kg → hemat Rp400.000, setara Rp31.000/kg", () => {
    const pricing = computePackagePricing({ weightKg: 100, priceTotalIdr: 3_100_000, unitPricePerKgIdr: 35_000 });
    expect(pricing.comparison?.compareIdr).toEqual({ idr: 3_500_000, approximate: false });
    expect(pricing.comparison?.savingsIdr).toEqual({ idr: 400_000, approximate: false });
    expect(pricing.effectivePerKg).toEqual({ idr: 31_000, approximate: false });
    expect(pricing.showSavingsBadge).toBe(true);
    expect(savingsBadgeLabel(pricing)).toBe("Hemat Rp400.000");
    expect(effectivePerKgLabel(pricing.effectivePerKg)).toBe("Setara Rp31.000/kg");
    expect(comparisonLabel(pricing)).toBe("Dibanding harga satuan saat ini: 100 kg × Rp35.000 / kg = Rp3.500.000.");
  });

  it("harga paket SAMA dengan pembanding → tanpa badge", () => {
    const pricing = computePackagePricing({ weightKg: 10, priceTotalIdr: 350_000, unitPricePerKgIdr: 35_000 });
    expect(pricing.showSavingsBadge).toBe(false);
    expect(savingsBadgeLabel(pricing)).toBeNull();
  });

  it("harga paket LEBIH TINGGI dari pembanding → tanpa badge, harga paket tetap", () => {
    const pricing = computePackagePricing({ weightKg: 1, priceTotalIdr: 40_000, unitPricePerKgIdr: 35_000 });
    expect(pricing.showSavingsBadge).toBe(false);
    expect(pricing.priceTotalIdr).toBe(40_000);
    expect(pricing.comparison?.savingsIdr).toBeNull();
  });

  it("harga satuan belum tersedia → harga paket & harga efektif tampil, pembanding & badge tidak", () => {
    const pricing = computePackagePricing({ weightKg: 10, priceTotalIdr: 320_000, unitPricePerKgIdr: null });
    expect(pricing.comparison).toBeNull();
    expect(pricing.showSavingsBadge).toBe(false);
    expect(comparisonLabel(pricing)).toBeNull();
    expect(effectivePerKgLabel(pricing.effectivePerKg)).toBe("Setara Rp32.000/kg");
  });

  it("perubahan harga satuan hanya mengubah pembanding/penghematan, bukan harga paket", () => {
    const a = computePackagePricing({ weightKg: 10, priceTotalIdr: 320_000, unitPricePerKgIdr: 35_000 });
    const b = computePackagePricing({ weightKg: 10, priceTotalIdr: 320_000, unitPricePerKgIdr: 30_000 });
    expect(a.priceTotalIdr).toBe(320_000);
    expect(b.priceTotalIdr).toBe(320_000);
    expect(a.comparison?.savingsIdr?.idr).toBe(30_000);
    expect(b.showSavingsBadge).toBe(false);
  });

  it("berat desimal dihitung tepat: 12,5 kg × Rp35.000 = Rp437.500", () => {
    const pricing = computePackagePricing({ weightKg: 12.5, priceTotalIdr: 400_000, unitPricePerKgIdr: 35_000 });
    expect(pricing.comparison?.compareIdr).toEqual({ idr: 437_500, approximate: false });
    expect(pricing.comparison?.savingsIdr).toEqual({ idr: 37_500, approximate: false });
    expect(pricing.effectivePerKg).toEqual({ idr: 32_000, approximate: false });
  });

  it("pecahan rupiah dibulatkan SEKALI ke rupiah terdekat, setengah ke atas, dan diberi label 'sekitar'", () => {
    // 0,5 kg × Rp35.001 = Rp17.500,5 → Rp17.501
    const half = computePackagePricing({ weightKg: 0.5, priceTotalIdr: 17_000, unitPricePerKgIdr: 35_001 });
    expect(half.comparison?.compareIdr).toEqual({ idr: 17_501, approximate: true });
    expect(half.comparison?.savingsIdr).toEqual({ idr: 501, approximate: true });
    expect(savingsBadgeLabel(half)).toBe("Hemat sekitar Rp501");
    // Rp100.000 ÷ 3 kg = Rp33.333,33… → "Setara sekitar Rp33.333/kg"
    const third = computePackagePricing({ weightKg: 3, priceTotalIdr: 100_000, unitPricePerKgIdr: null });
    expect(effectivePerKgLabel(third.effectivePerKg)).toBe("Setara sekitar Rp33.333/kg");
    // 0,03 kg dengan harga Rp1 → efektif Rp33,33/kg → Rp33
    expect(computePackagePricing({ weightKg: 0.03, priceTotalIdr: 1, unitPricePerKgIdr: null }).effectivePerKg).toEqual({
      idr: 33,
      approximate: true,
    });
  });

  it("penghematan kurang dari setengah rupiah → tanpa badge", () => {
    // 0,01 kg × Rp30 = Rp0,3; harga Rp0 → hemat Rp0,3 → dibulatkan Rp0
    const pricing = computePackagePricing({ weightKg: 0.01, priceTotalIdr: 0, unitPricePerKgIdr: 30 });
    expect(pricing.showSavingsBadge).toBe(false);
  });

  it("tidak ada galat biner pada berat seperti 0,1 / 0,7", () => {
    expect(computePackagePricing({ weightKg: 0.7, priceTotalIdr: 0, unitPricePerKgIdr: 10 }).comparison?.compareIdr).toEqual({
      idr: 7,
      approximate: false,
    });
    expect(computePackagePricing({ weightKg: 0.1, priceTotalIdr: 3_500, unitPricePerKgIdr: 35_000 }).effectivePerKg).toEqual({
      idr: 35_000,
      approximate: false,
    });
  });

  it("menolak berat > 2 desimal atau harga tidak bulat (tidak dibulatkan diam-diam)", () => {
    expect(() => computePackagePricing({ weightKg: 1.255, priceTotalIdr: 1, unitPricePerKgIdr: 1 })).toThrow(RangeError);
    expect(() => computePackagePricing({ weightKg: 1, priceTotalIdr: 1.5, unitPricePerKgIdr: 1 })).toThrow(RangeError);
  });
});

describe("ketersediaan terhadap stok total bersama", () => {
  it.each([
    [null, 10, "unknown"],
    [0, 10, "out_of_stock"],
    [50, 100, "exceeds_recorded_stock"],
    [100, 100, "within_recorded_stock"],
    [12.5, 12.51, "exceeds_recorded_stock"],
    [12.51, 12.5, "within_recorded_stock"],
  ] as const)("stok %s kg, paket %s kg → %s", (stock, weight, expected) => {
    expect(packageAvailability(stock, weight)).toBe(expected);
  });
});

describe("validasi input paket (parser Indonesia)", () => {
  it.each([
    ["10", "10"],
    ["12,5", "12.5"],
    ["0,5 kg", "0.5"],
    ["10000", "10000"],
  ])("berat %j diterima → %j", (input, canonical) => {
    expect(parsePackageWeightInput(input)).toMatchObject({ ok: true, canonical });
  });

  it.each([
    ["", "empty"],
    ["0", "not_positive"],
    ["0,00", "not_positive"],
    ["-1", "negative"],
    ["1,255", "too_many_decimals"],
    ["1.250", "too_many_decimals"],
    ["1.250,5", "thousands_separator"],
    ["1e3", "invalid_format"],
    ["NaN", "invalid_format"],
    ["Infinity", "invalid_format"],
    ["10000,01", "out_of_range"],
  ])("berat %j ditolak (%s)", (input, error) => {
    expect(parsePackageWeightInput(input)).toMatchObject({ ok: false, error });
  });

  it.each([
    ["3.100.000", 3_100_000],
    ["Rp 320.000", 320_000],
    ["0", 0],
    ["1.000.000.000", 1_000_000_000],
  ])("harga %j diterima → %d (batas harga total terpisah dari harga per kg)", (input, idr) => {
    expect(parsePackagePriceInput(input)).toEqual({ ok: true, idr });
  });

  it.each([
    ["", "empty"],
    ["-5000", "negative"],
    ["3100000,5", "not_whole"],
    ["35.50", "invalid_thousands"],
    ["1e6", "invalid_format"],
    ["1.000.000.001", "out_of_range"],
  ])("harga %j ditolak (%s)", (input, error) => {
    expect(parsePackagePriceInput(input)).toMatchObject({ ok: false, error });
  });

  it("nama paket dirapikan; kosong, baris baru, dan > 60 karakter ditolak", () => {
    expect(validatePackageName("  Paket   Hemat  ")).toEqual({ ok: true, value: "Paket Hemat" });
    expect(validatePackageName("   ").ok).toBe(false);
    expect(validatePackageName("Baris\nBaru").ok).toBe(false);
    expect(validatePackageName("x".repeat(61)).ok).toBe(false);
    expect(validatePackageName("🐟".repeat(60)).ok).toBe(true);
  });
});
