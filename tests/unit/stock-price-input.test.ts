import { describe, expect, it } from "vitest";

import { PRICE_MAX_IDR, STOCK_MAX_KG } from "@/lib/domain/limits";
import {
  parsePriceInput,
  parseStockInput,
  PRICE_ERROR_MESSAGES,
  STOCK_ERROR_MESSAGES,
} from "@/lib/validation/stock-price-input";

describe("parseStockInput — input yang diterima (BR-S2, BR-S10, AC-27)", () => {
  it.each([
    ["12,5", "12.5", 12.5],
    ["12.5", "12.5", 12.5],
    ["12,25", "12.25", 12.25],
    ["10", "10", 10],
    ["0", "0", 0],
    ["0,5", "0.5", 0.5],
    ["0,01", "0.01", 0.01],
    ["12,50", "12.5", 12.5],
    ["10,00", "10", 10],
    ["  12,5  ", "12.5", 12.5],
    ["12,5 kg", "12.5", 12.5],
    ["12,5kg", "12.5", 12.5],
    ["8,5 KG", "8.5", 8.5],
  ])("%j → kanonik %j", (input, canonical, kg) => {
    expect(parseStockInput(input)).toEqual({ ok: true, canonical, kg });
  });

  it("menerima tepat batas maksimum", () => {
    expect(parseStockInput(String(STOCK_MAX_KG))).toEqual({
      ok: true,
      canonical: "100000",
      kg: STOCK_MAX_KG,
    });
  });
});

describe("parseStockInput — input yang ditolak (AC-28)", () => {
  it.each([
    ["", "empty"],
    ["   ", "empty"],
    ["-1", "negative"],
    ["- 1", "negative"],
    ["-0,5", "negative"],
    ["abc", "invalid_format"],
    ["kg", "invalid_format"],
    ["1e3", "invalid_format"],
    [".5", "invalid_format"],
    ["12.", "invalid_format"],
    ["012", "invalid_format"],
    ["+5", "invalid_format"],
    ["12 ,5", "invalid_format"],
    ["1,255", "too_many_decimals"],
    ["1.255", "too_many_decimals"],
    ["1.250", "too_many_decimals"],
    ["1.250,5", "thousands_separator"],
    ["1.000.000", "thousands_separator"],
    ["100000,01", "out_of_range"],
    ["100001", "out_of_range"],
    ["1000000", "out_of_range"],
  ] as const)("%j → %s", (input, error) => {
    const result = parseStockInput(input);
    expect(result).toEqual({ ok: false, error, message: STOCK_ERROR_MESSAGES[error] });
  });

  it("tidak membulatkan diam-diam 3 desimal (1,255 tidak menjadi 1,26)", () => {
    expect(parseStockInput("1,255").ok).toBe(false);
  });

  it("menerima null/undefined sebagai kosong", () => {
    expect(parseStockInput(null)).toMatchObject({ ok: false, error: "empty" });
    expect(parseStockInput(undefined)).toMatchObject({ ok: false, error: "empty" });
  });

  it("pesan batas memakai format Indonesia", () => {
    expect(STOCK_ERROR_MESSAGES.out_of_range).toBe("Stok maksimal 100.000 kg.");
  });
});

describe("parsePriceInput — input yang diterima (BR-H8, AC-27)", () => {
  it.each([
    ["35000", 35000],
    ["35.000", 35000],
    ["Rp 35.000", 35000],
    ["Rp35.000", 35000],
    ["Rp. 35.000", 35000],
    ["rp 35000", 35000],
    ["RP35000", 35000],
    ["  35.000  ", 35000],
    ["1.250.000", 1250000],
    ["32.000", 32000],
    ["0", 0],
    ["Rp 0", 0],
    ["10.000.000", PRICE_MAX_IDR],
  ])("%j → %d", (input, idr) => {
    expect(parsePriceInput(input)).toEqual({ ok: true, idr });
  });
});

describe("parsePriceInput — input yang ditolak (AC-28)", () => {
  it.each([
    ["", "empty"],
    ["-5000", "negative"],
    ["Rp -5000", "negative"],
    ["35000,5", "not_whole"],
    ["35.000,50", "not_whole"],
    ["35,000", "not_whole"],
    ["35.50", "invalid_thousands"],
    ["3.5", "invalid_thousands"],
    ["35.0000", "invalid_thousands"],
    ["0.500", "invalid_thousands"],
    ["35..000", "invalid_thousands"],
    ["35.000.5", "invalid_thousands"],
    ["Rp", "invalid_format"],
    ["abc", "invalid_format"],
    ["035000", "invalid_format"],
    ["35 000", "invalid_format"],
    ["35000/kg", "invalid_format"],
    ["1e5", "invalid_format"],
    ["10.000.001", "out_of_range"],
    ["10000001", "out_of_range"],
    ["100000000", "out_of_range"],
  ] as const)("%j → %s", (input, error) => {
    expect(parsePriceInput(input)).toEqual({
      ok: false,
      error,
      message: PRICE_ERROR_MESSAGES[error],
    });
  });

  it("35.50 TIDAK diam-diam menjadi 3550", () => {
    const result = parsePriceInput("35.50");
    expect(result.ok).toBe(false);
    expect(result).not.toEqual({ ok: true, idr: 3550 });
  });

  it("pesan harga pecahan sesuai PRD BR-H8", () => {
    expect(PRICE_ERROR_MESSAGES.not_whole).toBe("Harga harus dalam rupiah bulat.");
  });

  it("pesan batas memakai format rupiah", () => {
    expect(PRICE_ERROR_MESSAGES.out_of_range).toBe("Harga maksimal Rp10.000.000 per kg.");
  });
});
