/**
 * Parser input stok (kg), harga (Rp/kg), berat paket (kg), dan harga total paket (Rp) format Indonesia.
 * PRD BR-S2, BR-S3, BR-S9, BR-S10, BR-H2, BR-H3, BR-H7, BR-H8, §12.8; ARCHITECTURE.md §10.2.
 *
 * Prinsip: PERIKSA FORMAT DULU, BARU NORMALISASI. Karakter tidak pernah dibuang sebelum polanya
 * dipastikan sah, sehingga salah ketik (mis. harga `35.50`) ditolak, bukan berubah diam-diam menjadi
 * angka lain (`3550`). Notasi ilmiah (`1e3`), `NaN`, `Infinity`, dan angka dengan nol di depan ditolak
 * karena hanya digit dan pemisah yang diterima.
 */
import {
  PACKAGE_PRICE_MAX_IDR,
  PACKAGE_WEIGHT_MAX_KG,
  PRICE_MAX_IDR,
  STOCK_MAX_DECIMALS,
  STOCK_MAX_KG,
} from "@/lib/domain/limits";
import { formatKg, formatRupiah } from "@/lib/format/number";

// ---------------------------------------------------------------------------------------------
// Bilangan kg desimal (stok & berat paket)
// ---------------------------------------------------------------------------------------------

export type StockInputError =
  | "empty"
  | "negative"
  | "thousands_separator"
  | "invalid_format"
  | "too_many_decimals"
  | "out_of_range";

export type WeightInputError = StockInputError | "not_positive";

export type KgParseOk = {
  ok: true;
  /** String desimal kanonik untuk dikirim ke RPC (mis. "12.5"), bukan hasil parseFloat. */
  canonical: string;
  kg: number;
};

/**
 * String kg kanonik ("12.5") → perseratus kg sebagai bilangan bulat tepat (1250), untuk perhitungan dan
 * perbandingan tanpa galat biner. Hanya untuk nilai yang sudah lolos parser (maksimal 2 desimal).
 */
export function canonicalKgToCenti(canonical: string): number {
  const [integerPart = "0", fractionPart = ""] = canonical.split(".");
  return Number(integerPart) * 100 + Number(fractionPart.padEnd(2, "0").slice(0, 2));
}

export type StockParseResult = KgParseOk | { ok: false; error: StockInputError; message: string };
export type WeightParseResult = KgParseOk | { ok: false; error: WeightInputError; message: string };

export const STOCK_ERROR_MESSAGES: Readonly<Record<StockInputError, string>> = {
  empty: "Stok wajib diisi.",
  negative: "Stok tidak boleh negatif.",
  thousands_separator:
    "Stok ditulis tanpa pemisah ribuan, contoh: 1250 atau 12,5.",
  invalid_format: "Format stok tidak valid. Contoh: 12 atau 12,5.",
  too_many_decimals: `Stok maksimal ${STOCK_MAX_DECIMALS} angka di belakang koma, tanpa titik ribuan (contoh: 1250 atau 12,5).`,
  out_of_range: `Stok maksimal ${formatKg(STOCK_MAX_KG)}.`,
};

export const WEIGHT_ERROR_MESSAGES: Readonly<Record<WeightInputError, string>> = {
  empty: "Berat paket wajib diisi.",
  negative: "Berat paket tidak boleh negatif.",
  not_positive: "Berat paket harus lebih dari 0 kg.",
  thousands_separator:
    "Berat ditulis tanpa pemisah ribuan, contoh: 100 atau 12,5.",
  invalid_format: "Format berat tidak valid. Contoh: 10 atau 12,5.",
  too_many_decimals: `Berat maksimal ${STOCK_MAX_DECIMALS} angka di belakang koma, tanpa titik ribuan (contoh: 100 atau 12,5).`,
  out_of_range: `Berat paket maksimal ${formatKg(PACKAGE_WEIGHT_MAX_KG)}.`,
};

/** Satu pemisah desimal (koma atau titik) opsional, tanpa nol di depan. */
const KG_PATTERN = /^(0|[1-9]\d*)(?:[.,](\d+))?$/;
const LOOKS_NEGATIVE = /^-\s*[\d.,]+$/;
const DIGITS_AND_SEPARATORS = /^[\d.,]+$/;

type KgOptions<E extends string> = {
  max: number;
  allowZero: boolean;
  messages: Readonly<Record<E, string>>;
};

function parseKgValue<E extends WeightInputError>(
  raw: string | null | undefined,
  options: KgOptions<E>,
): KgParseOk | { ok: false; error: E; message: string } {
  const fail = (error: WeightInputError) => ({
    ok: false as const,
    error: error as E,
    message: options.messages[error as E],
  });

  let value = (raw ?? "").trim();
  if (value === "") return fail("empty");

  value = value.replace(/\s*kg$/i, "");
  if (value === "") return fail("invalid_format");

  if (LOOKS_NEGATIVE.test(value)) return fail("negative");

  const separatorCount = value.match(/[.,]/g)?.length ?? 0;
  if (separatorCount > 1 && DIGITS_AND_SEPARATORS.test(value)) return fail("thousands_separator");

  const match = KG_PATTERN.exec(value);
  if (!match) return fail("invalid_format");

  const integerPart = match[1] ?? "";
  const fractionPart = match[2] ?? "";

  if (fractionPart.length > STOCK_MAX_DECIMALS) return fail("too_many_decimals");
  if (integerPart.length > String(options.max).length) return fail("out_of_range");

  const fractionTrimmed = fractionPart.replace(/0+$/, "");
  const canonical = fractionTrimmed === "" ? integerPart : `${integerPart}.${fractionTrimmed}`;
  const kg = Number(canonical);

  if (kg > options.max) return fail("out_of_range");
  if (!options.allowZero && canonicalKgToCenti(canonical) === 0) return fail("not_positive");

  return { ok: true, canonical, kg };
}

export function parseStockInput(raw: string | null | undefined): StockParseResult {
  return parseKgValue<StockInputError>(raw, {
    max: STOCK_MAX_KG,
    allowZero: true,
    messages: STOCK_ERROR_MESSAGES,
  });
}

/** Berat paket: > 0, maksimal 2 desimal, maksimal `PACKAGE_WEIGHT_MAX_KG` (PRD §12.8). */
export function parsePackageWeightInput(raw: string | null | undefined): WeightParseResult {
  return parseKgValue<WeightInputError>(raw, {
    max: PACKAGE_WEIGHT_MAX_KG,
    allowZero: false,
    messages: WEIGHT_ERROR_MESSAGES,
  });
}

// ---------------------------------------------------------------------------------------------
// Rupiah bulat (harga per kg & harga total paket)
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

export const PACKAGE_PRICE_ERROR_MESSAGES: Readonly<Record<PriceInputError, string>> = {
  empty: "Harga paket wajib diisi.",
  negative: "Harga paket tidak boleh negatif.",
  not_whole: "Harga paket harus dalam rupiah bulat.",
  invalid_thousands:
    "Titik hanya boleh dipakai sebagai pemisah ribuan, contoh: 3.100.000. Harga paket harus dalam rupiah bulat.",
  invalid_format: "Format harga paket tidak valid. Contoh: 320000 atau 320.000.",
  out_of_range: `Harga paket maksimal ${formatRupiah(PACKAGE_PRICE_MAX_IDR)}.`,
};

/** Angka polos tanpa nol di depan: `35000`, `0`. */
const PRICE_PLAIN = /^(0|[1-9]\d*)$/;
/** Kelompok ribuan bertitik, setiap kelompok tepat 3 angka: `35.000`, `1.250.000`. */
const PRICE_GROUPED = /^[1-9]\d{0,2}(?:\.\d{3})+$/;
const DIGITS_AND_DOTS = /^[\d.]+$/;

function parseRupiahValue(
  raw: string | null | undefined,
  max: number,
  messages: Readonly<Record<PriceInputError, string>>,
): PriceParseResult {
  const fail = (error: PriceInputError): PriceParseResult => ({
    ok: false,
    error,
    message: messages[error],
  });

  let value = (raw ?? "").trim();
  if (value === "") return fail("empty");

  value = value.replace(/^rp\.?\s*/i, "");
  if (value === "") return fail("invalid_format");

  if (LOOKS_NEGATIVE.test(value)) return fail("negative");

  if (value.includes(",")) {
    return DIGITS_AND_SEPARATORS.test(value) ? fail("not_whole") : fail("invalid_format");
  }

  // Validasi format SEBELUM titik dihapus.
  let digits: string;
  if (PRICE_PLAIN.test(value)) {
    digits = value;
  } else if (PRICE_GROUPED.test(value)) {
    digits = value.replace(/\./g, "");
  } else if (DIGITS_AND_DOTS.test(value) && value.includes(".")) {
    return fail("invalid_thousands");
  } else {
    return fail("invalid_format");
  }

  if (digits.length > String(max).length) return fail("out_of_range");

  const idr = Number(digits);
  if (idr > max) return fail("out_of_range");

  return { ok: true, idr };
}

export function parsePriceInput(raw: string | null | undefined): PriceParseResult {
  return parseRupiahValue(raw, PRICE_MAX_IDR, PRICE_ERROR_MESSAGES);
}

/**
 * Harga total paket. Batasnya terpisah dari batas harga per kg dan TIDAK diturunkan dari
 * berat × harga satuan (PRD §12.8).
 */
export function parsePackagePriceInput(raw: string | null | undefined): PriceParseResult {
  return parseRupiahValue(raw, PACKAGE_PRICE_MAX_IDR, PACKAGE_PRICE_ERROR_MESSAGES);
}
