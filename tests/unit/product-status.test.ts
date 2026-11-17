import { describe, expect, it } from "vitest";

import {
  getConfirmedAtLabel,
  getPriceStatus,
  getProductDisplay,
  getStockStatus,
  NEVER_CONFIRMED_LABEL,
  NOT_AVAILABLE_LABEL,
  OUT_OF_STOCK_LABEL,
  PRODUCT_LOAD_ERROR_MESSAGE,
} from "@/lib/domain/product-status";

describe("getStockStatus (BR-S6, BR-S7, AC-01–AC-03)", () => {
  it("NULL → Belum tersedia, bukan 0 kg / Stok habis", () => {
    const status = getStockStatus(null);
    expect(status).toEqual({ kind: "unset", label: "Belum tersedia" });
    expect(status.label).not.toContain("0 kg");
    expect(status.label).not.toBe(OUT_OF_STOCK_LABEL);
  });

  it("0 → Stok habis, bukan Belum tersedia", () => {
    const status = getStockStatus(0);
    expect(status).toEqual({ kind: "out_of_stock", label: "Stok habis" });
    expect(status.label).not.toBe(NOT_AVAILABLE_LABEL);
  });

  it.each([
    [12.5, "12,5 kg"],
    [12.25, "12,25 kg"],
    [10, "10 kg"],
  ])("%d → %j", (kg, label) => {
    expect(getStockStatus(kg)).toEqual({ kind: "available", label, kg });
  });

  it("nilai mustahil melempar RangeError", () => {
    expect(() => getStockStatus(-1)).toThrow(RangeError);
    expect(() => getStockStatus(Number.NaN)).toThrow(RangeError);
  });
});

describe("getPriceStatus (BR-H4, BR-H5, AC-04–AC-06)", () => {
  it("NULL → Belum tersedia tanpa angka rupiah apa pun", () => {
    const status = getPriceStatus(null);
    expect(status).toEqual({ kind: "unset", label: "Belum tersedia" });
    expect(status.label).not.toMatch(/Rp/);
  });

  it("0 → Rp0 / kg, bukan Belum tersedia", () => {
    expect(getPriceStatus(0)).toEqual({ kind: "set", label: "Rp0 / kg", idr: 0 });
  });

  it("35000 → Rp35.000 / kg", () => {
    expect(getPriceStatus(35000)).toEqual({ kind: "set", label: "Rp35.000 / kg", idr: 35000 });
  });

  it("nilai mustahil melempar RangeError", () => {
    expect(() => getPriceStatus(-5)).toThrow(RangeError);
    expect(() => getPriceStatus(35000.5)).toThrow(RangeError);
  });
});

describe("getConfirmedAtLabel (AC-07, AC-08)", () => {
  it("NULL → Belum pernah diperbarui", () => {
    expect(getConfirmedAtLabel(null)).toBe(NEVER_CONFIRMED_LABEL);
  });

  it("waktu tersimpan → WIB", () => {
    expect(getConfirmedAtLabel("2026-11-17T07:05:00Z")).toBe(
      "17 November 2026 pukul 14.05 WIB",
    );
  });
});

describe("getProductDisplay (AC-08, AC-12, FR-08)", () => {
  it("belum pernah dikonfirmasi → semua Belum tersedia + Belum pernah diperbarui", () => {
    const display = getProductDisplay({
      status: "ok",
      data: { stockKg: null, pricePerKgIdr: null, confirmedAt: null },
    });
    expect(display).toEqual({
      status: "ok",
      stock: { kind: "unset", label: "Belum tersedia" },
      price: { kind: "unset", label: "Belum tersedia" },
      confirmedAtLabel: "Belum pernah diperbarui",
      whatsAppMessageKind: "product_unknown",
    });
  });

  it("stok tersedia → templat produk tersedia", () => {
    const display = getProductDisplay({
      status: "ok",
      data: { stockKg: 8.5, pricePerKgIdr: 32000, confirmedAt: "2026-11-17T07:05:00Z" },
    });
    expect(display).toMatchObject({
      status: "ok",
      stock: { label: "8,5 kg" },
      price: { label: "Rp32.000 / kg" },
      confirmedAtLabel: "17 November 2026 pukul 14.05 WIB",
      whatsAppMessageKind: "product_available",
    });
  });

  it("stok 0 → templat stok habis (AC-16)", () => {
    const display = getProductDisplay({
      status: "ok",
      data: { stockKg: 0, pricePerKgIdr: 32000, confirmedAt: "2026-11-17T07:05:00Z" },
    });
    expect(display).toMatchObject({
      status: "ok",
      stock: { kind: "out_of_stock" },
      whatsAppMessageKind: "product_out_of_stock",
    });
  });

  it("gagal dimuat → pesan gangguan, bukan Belum tersedia / Stok habis / angka", () => {
    const display = getProductDisplay({ status: "error" });
    expect(display).toEqual({
      status: "error",
      reason: "load_failed",
      message: PRODUCT_LOAD_ERROR_MESSAGE,
      whatsAppMessageKind: "product_unknown",
    });
    const text = JSON.stringify(display);
    expect(text).not.toContain(NOT_AVAILABLE_LABEL);
    expect(text).not.toContain(OUT_OF_STOCK_LABEL);
    expect(text).not.toMatch(/\d/);
  });

  it("angka tanpa waktu konfirmasi tidak ditampilkan", () => {
    expect(
      getProductDisplay({
        status: "ok",
        data: { stockKg: 10, pricePerKgIdr: 32000, confirmedAt: null },
      }),
    ).toMatchObject({ status: "error", reason: "invalid_data" });
  });

  it("nilai tersimpan mustahil → pesan gangguan (invalid_data)", () => {
    expect(
      getProductDisplay({
        status: "ok",
        data: { stockKg: -1, pricePerKgIdr: 32000, confirmedAt: "2026-11-17T07:05:00Z" },
      }),
    ).toMatchObject({ status: "error", reason: "invalid_data" });
    expect(
      getProductDisplay({
        status: "ok",
        data: { stockKg: 1, pricePerKgIdr: 1, confirmedAt: "bukan-tanggal" },
      }),
    ).toMatchObject({ status: "error", reason: "invalid_data" });
  });
});
