/**
 * Parser input stok (kg) dan harga (Rp/kg) format Indonesia.
 * PRD BR-S2, BR-S3, BR-S9, BR-S10, BR-H2, BR-H3, BR-H7, BR-H8; ARCHITECTURE.md §10.2.
 *
 * Prinsip: PERIKSA FORMAT DULU, BARU NORMALISASI. Karakter tidak pernah dibuang sebelum polanya
 * dipastikan sah, sehingga salah ketik (mis. harga `35.50`) ditolak, bukan berubah diam-diam menjadi
 * angka lain (`3550`).
 */
import {
  PRICE_MAX_IDR,
  STOCK_MAX_DECIMALS,
  STOCK_MAX_KG,
} from "@/lib/domain/limits";
import { formatKg, formatRupiah } from "@/lib/format/number";

// ---------------------------------------------------------------------------------------------
// Stok
// ---------------------------------------------------------------------------------------------

export type StockInputError =
  | "empty"
  | "negative"
  | "thousands_separator"
  | "invalid_format"
  | "too_many_decimals"
  | "out_of_range";

export type StockParseResult =
  | {
      ok: true;
      /** String desimal kanonik untuk dikirim ke RPC (mis. "12.5"), bukan hasil parseFloat. */
      canonical: string;
      kg: number;
    }
  | { ok: false; error: StockInputError; message: string };

export const STOCK_ERROR_MESSAGES: Readonly<Record<StockInputError, string>> = {
  empty: "Stok wajib diisi.",
  negative: "Stok tidak boleh negatif.",
  thousands_separator:
    "Stok ditulis tanpa pemisah ribuan, contoh: 1250 atau 12,5.",
  invalid_format: "Format stok tidak valid. Contoh: 12 atau 12,5.",
  too_many_decimals: `Stok maksimal ${STOCK_MAX_DECIMALS} angka di belakang koma, tanpa titik ribuan (contoh: 1250 atau 12,5).`,
  out_of_range: `Stok maksimal ${formatKg(STOCK_MAX_KG)}.`,
};

/** Satu pemisah desimal (koma atau titik) opsional, tanpa nol di depan. */
const STOCK_PATTERN = /^(0|[1-9]\d*)(?:[.,](\d+))?$/;
const LOOKS_NEGATIVE = /^-\s*[\d.,]+$/;
const DIGITS_AND_SEPARATORS = /^[\d.,]+$/;

function stockFail(error: StockInputError): StockParseResult {
  return { ok: false, error, message: STOCK_ERROR_MESSAGES[error] };
}

export function parseStockInput(raw: string | null | undefined): StockParseResult {
  let value = (raw ?? "").trim();
  if (value === "") return stockFail("empty");

  value = value.replace(/\s*kg$/i, "");
  if (value === "") return stockFail("invalid_format");

  if (LOOKS_NEGATIVE.test(value)) return stockFail("negative");

  const separatorCount = value.match(/[.,]/g)?.length ?? 0;
  if (separatorCount > 1 && DIGITS_AND_SEPARATORS.test(value)) {
    return stockFail("thousands_separator");
  }

  const match = STOCK_PATTERN.exec(value);
  if (!match) return stockFail("invalid_format");

  const integerPart = match[1] ?? "";
  const fractionPart = match[2] ?? "";

  if (fractionPart.length > STOCK_MAX_DECIMALS) return stockFail("too_many_decimals");
  if (integerPart.length > String(STOCK_MAX_KG).length) return stockFail("out_of_range");

  const fractionTrimmed = fractionPart.replace(/0+$/, "");
  const canonical =
    fractionTrimmed === "" ? integerPart : `${integerPart}.${fractionTrimmed}`;
  const kg = Number(canonical);

  if (kg > STOCK_MAX_KG) return stockFail("out_of_range");

  return { ok: true, canonical, kg };
}

// ---------------------------------------------------------------------------------------------
// Harga
// ---------------------------------------------------------------------------------------------

export type PriceInputError =
  | "empty"
  | "negative"
  | "not_whole"
  | "invalid_thousands"
  | "invalid_format"
  | "out_of_range";

export type PriceParseResult =
  | { ok: true; idr: number }
  | { ok: false; error: PriceInputError; message: string };

export const PRICE_ERROR_MESSAGES: Readonly<Record<PriceInputError, string>> = {
  empty: "Harga wajib diisi.",
  negative: "Harga tidak boleh negatif.",
  not_whole: "Harga harus dalam rupiah bulat.",
  invalid_thousands:
    "Titik hanya boleh dipakai sebagai pemisah ribuan, contoh: 35.000. Harga harus dalam rupiah bulat.",
  invalid_format: "Format harga tidak valid. Contoh: 35000 atau 35.000.",
  out_of_range: `Harga maksimal ${formatRupiah(PRICE_MAX_IDR)} per kg.`,
};

/** Angka polos tanpa nol di depan: `35000`, `0`. */
const PRICE_PLAIN = /^(0|[1-9]\d*)$/;
/** Kelompok ribuan bertitik, setiap kelompok tepat 3 angka: `35.000`, `1.250.000`. */
const PRICE_GROUPED = /^[1-9]\d{0,2}(?:\.\d{3})+$/;
const DIGITS_AND_DOTS = /^[\d.]+$/;

function priceFail(error: PriceInputError): PriceParseResult {
  return { ok: false, error, message: PRICE_ERROR_MESSAGES[error] };
}

export function parsePriceInput(raw: string | null | undefined): PriceParseResult {
  let value = (raw ?? "").trim();
  if (value === "") return priceFail("empty");

  value = value.replace(/^rp\.?\s*/i, "");
  if (value === "") return priceFail("invalid_format");

  if (LOOKS_NEGATIVE.test(value)) return priceFail("negative");

  if (value.includes(",")) {
    return DIGITS_AND_SEPARATORS.test(value)
      ? priceFail("not_whole")
      : priceFail("invalid_format");
  }

  // Validasi format SEBELUM titik dihapus.
  let digits: string;
  if (PRICE_PLAIN.test(value)) {
    digits = value;
  } else if (PRICE_GROUPED.test(value)) {
    digits = value.replace(/\./g, "");
  } else if (DIGITS_AND_DOTS.test(value) && value.includes(".")) {
    return priceFail("invalid_thousands");
  } else {
    return priceFail("invalid_format");
  }

  if (digits.length > String(PRICE_MAX_IDR).length) return priceFail("out_of_range");

  const idr = Number(digits);
  if (idr > PRICE_MAX_IDR) return priceFail("out_of_range");

  return { ok: true, idr };
}
