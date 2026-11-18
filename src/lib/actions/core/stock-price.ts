/**
 * Inti Server Action stok & harga (ARCHITECTURE.md §5.3, §10.3–§10.4; PRD AC-24–AC-34, AC-51).
 *
 * - Satu-satunya jalur tulis: RPC `confirm_product_stock_price` (waktu konfirmasi = jam database).
 * - Baseline (nilai & waktu yang tampil saat formulir dirender) hanya untuk memilih pesan dan untuk
 *   pembacaan ulang. Baseline bukan bukti otorisasi maupun bukti keberhasilan.
 */
import { z } from "zod";

import {
  formText,
  formTimestamp,
  formUuid,
  kgToCenti,
  numericColumn,
  RECHECK_DELAY_MS,
  runSideEffect,
  type Gate,
} from "@/lib/actions/core/shared";
import { formatWib } from "@/lib/format/datetime";
import { formatKg, formatPricePerKg } from "@/lib/format/number";
import {
  canonicalKgToCenti,
  parsePriceInput,
  parseStockInput,
  PRICE_ERROR_MESSAGES,
  STOCK_ERROR_MESSAGES,
} from "@/lib/validation/stock-price-input";
import { MESSAGES, type ActionResult } from "@/lib/write/action-result";
import { certainFailureResult, type FieldError } from "@/lib/write/map-failure";
import { classifyWriteError, judgeRecheck, type DbResponse } from "@/lib/write/outcome";

export type StockPriceField = "stock" | "price";

export type StockPriceSaved = {
  stockKg: number;
  /** Nilai stok kanonik ("12.5") untuk baseline berikutnya. */
  stockCanonical: string;
  pricePerKgIdr: number;
  /** Waktu konfirmasi MENTAH dari database (ISO). */
  confirmedAt: string;
  stockLabel: string;
  priceLabel: string;
  confirmedAtLabel: string;
};

export type StockPriceResult = ActionResult<StockPriceSaved, StockPriceField>;

export interface StockPriceDb {
  confirm(input: { productId: string; stockCanonical: string; priceIdr: number }): Promise<DbResponse>;
  read(productId: string): Promise<DbResponse>;
}

export type StockPriceDeps = {
  gate: Gate<StockPriceDb>;
  wait(ms: number): Promise<void>;
  afterSave?: () => void;
};

const productRow = z.object({
  stock_kg: numericColumn.nullable(),
  price_per_kg_idr: z.number().int().nullable(),
  stock_price_confirmed_at: z.string().nullable(),
});

type Submission = {
  productId: string | null;
  stockRaw: string;
  priceRaw: string;
  baseline: {
    confirmedAt: string | null;
    stockCanonical: string | null;
    priceIdr: number | null;
  };
};

export function readStockPriceSubmission(formData: FormData): Submission {
  const baselineStock = parseStockInput(formText(formData, "baselineStock"));
  const baselinePrice = parsePriceInput(formText(formData, "baselinePrice"));
  return {
    productId: formUuid(formData, "productId"),
    stockRaw: formText(formData, "stockKg"),
    priceRaw: formText(formData, "pricePerKgIdr"),
    baseline: {
      confirmedAt: formTimestamp(formData, "baselineConfirmedAt"),
      stockCanonical: baselineStock.ok ? baselineStock.canonical : null,
      priceIdr: baselinePrice.ok ? baselinePrice.idr : null,
    },
  };
}

function fieldForKey(key: string | null): FieldError<StockPriceField> | null {
  switch (key) {
    case "stock_out_of_range":
      return { field: "stock", message: STOCK_ERROR_MESSAGES.out_of_range };
    case "stock_too_many_decimals":
      return { field: "stock", message: STOCK_ERROR_MESSAGES.too_many_decimals };
    case "stock_price_required":
      return { field: "stock", message: STOCK_ERROR_MESSAGES.empty };
    case "price_out_of_range":
      return { field: "price", message: PRICE_ERROR_MESSAGES.out_of_range };
    case "price_not_whole":
      return { field: "price", message: PRICE_ERROR_MESSAGES.not_whole };
    default:
      return null;
  }
}

function stockLabelFor(kg: number): string {
  return kg === 0 ? `${formatKg(0)} (tampil “Stok habis” di website)` : formatKg(kg);
}

function toSaved(row: z.infer<typeof productRow>): StockPriceSaved | null {
  if (row.stock_kg === null || row.price_per_kg_idr === null || row.stock_price_confirmed_at === null) {
    return null;
  }
  try {
    return {
      stockKg: row.stock_kg,
      stockCanonical: String(row.stock_kg),
      pricePerKgIdr: row.price_per_kg_idr,
      confirmedAt: row.stock_price_confirmed_at,
      stockLabel: stockLabelFor(row.stock_kg),
      priceLabel: formatPricePerKg(row.price_per_kg_idr),
      confirmedAtLabel: formatWib(row.stock_price_confirmed_at),
    };
  } catch {
    return null;
  }
}

function describeSaved(saved: StockPriceSaved): string {
  return `stok ${saved.stockLabel}, harga ${saved.priceLabel}. Waktu konfirmasi: ${saved.confirmedAtLabel}.`;
}

type ChangeKind = "first" | "reconfirm" | "update";

function changeKind(submission: Submission, stockCentiValue: number, priceIdr: number): ChangeKind {
  const { baseline } = submission;
  if (baseline.confirmedAt === null) return "first";
  if (baseline.stockCanonical === null || baseline.priceIdr === null) return "update";
  const baselineCenti = canonicalKgToCenti(baseline.stockCanonical);
  return baselineCenti === stockCentiValue && baseline.priceIdr === priceIdr ? "reconfirm" : "update";
}

function successMessage(kind: ChangeKind, saved: StockPriceSaved): string {
  switch (kind) {
    case "reconfirm":
      // PRD AC-31.
      return `Data dikonfirmasi ulang (tidak ada perubahan angka): ${describeSaved(saved)}`;
    case "update":
      return `Data diperbarui: ${describeSaved(saved)}`;
    case "first":
      return `Data tersimpan dan dikonfirmasi: ${describeSaved(saved)}`;
  }
}

async function verifyAfterUncertain(
  db: StockPriceDb,
  submission: Submission & { productId: string },
  submitted: { stockCenti: number; priceIdr: number },
): Promise<StockPriceResult> {
  const read = await db.read(submission.productId);
  const parsed = read.error ? null : productRow.safeParse(read.data);
  if (!parsed || !parsed.success) {
    return {
      state: "uncertain",
      message: MESSAGES.uncertain,
      detail: MESSAGES.uncertainReadFailed,
      canRecheck: true,
    };
  }
  const row = parsed.data;
  const saved = toSaved(row);
  const matches =
    saved !== null &&
    kgToCenti(saved.stockKg) === submitted.stockCenti &&
    saved.pricePerKgIdr === submitted.priceIdr;
  const verdict = judgeRecheck({
    baselineAt: submission.baseline.confirmedAt,
    currentAt: row.stock_price_confirmed_at,
    matchesSubmission: matches,
  });

  if (verdict === "matches_submission" && saved) {
    return {
      state: "verified",
      message:
        "Status penyimpanan sempat belum pasti. Saat diperiksa ulang, data tersimpan sudah sesuai isian Anda.",
      detail: `Tersimpan: ${describeSaved(saved)}`,
      saved,
    };
  }
  if (verdict === "changed_elsewhere" && saved) {
    return {
      state: "changed_elsewhere",
      message: MESSAGES.changedElsewhere,
      detail: `Tersimpan: ${describeSaved(saved)}`,
      saved,
    };
  }
  return {
    state: "uncertain",
    message: MESSAGES.uncertain,
    detail: MESSAGES.uncertainNotYetVisible,
    canRecheck: true,
  };
}

type Parsed =
  | { ok: true; submission: Submission & { productId: string }; stockCanonical: string; stockCenti: number; priceIdr: number }
  | { ok: false; result: StockPriceResult };

function parseSubmission(formData: FormData): Parsed {
  const submission = readStockPriceSubmission(formData);
  if (submission.productId === null) {
    return {
      ok: false,
      result: { state: "invalid", message: "ID produk tidak valid. Muat ulang halaman panel. Data tidak berubah." },
    };
  }
  const stock = parseStockInput(submission.stockRaw);
  const price = parsePriceInput(submission.priceRaw);
  if (!stock.ok || !price.ok) {
    return {
      ok: false,
      result: {
        state: "invalid",
        message: MESSAGES.invalid,
        fieldErrors: {
          stock: stock.ok ? undefined : stock.message,
          price: price.ok ? undefined : price.message,
        },
      },
    };
  }
  return {
    ok: true,
    submission: { ...submission, productId: submission.productId },
    stockCanonical: stock.canonical,
    stockCenti: canonicalKgToCenti(stock.canonical),
    priceIdr: price.idr,
  };
}

/** Simpan & Konfirmasi (juga dipakai untuk konfirmasi ulang angka yang sama). */
export async function saveStockPrice(formData: FormData, deps: StockPriceDeps): Promise<StockPriceResult> {
  const parsed = parseSubmission(formData);
  if (!parsed.ok) return parsed.result;
  const { submission, stockCanonical, stockCenti, priceIdr } = parsed;

  const gate = await deps.gate();
  if (!gate.ok) return gate.result;

  const response = await gate.db.confirm({ productId: submission.productId, stockCanonical, priceIdr });

  if (response.error) {
    const failure = classifyWriteError(response.error, response.status);
    if (failure.kind !== "uncertain") {
      return certainFailureResult<StockPriceSaved, StockPriceField>(failure, {
        fieldForKey,
        notFoundMessage: "Produk tidak ditemukan di database. Data tidak berubah.",
      });
    }
    await deps.wait(RECHECK_DELAY_MS);
    return verifyAfterUncertain(gate.db, submission, { stockCenti, priceIdr });
  }

  const row = productRow.safeParse(response.data);
  const saved = row.success ? toSaved(row.data) : null;
  if (!saved) {
    // Jawaban sukses tetapi isinya tidak dapat dibaca: tidak ada jaminan, periksa ulang.
    await deps.wait(RECHECK_DELAY_MS);
    return verifyAfterUncertain(gate.db, submission, { stockCenti, priceIdr });
  }

  runSideEffect(deps.afterSave);
  return {
    state: "saved",
    message: successMessage(changeKind(submission, stockCenti, priceIdr), saved),
    saved,
  };
}

/**
 * "Periksa ulang" setelah hasil belum pasti (juga bila koneksi browser → server terputus).
 * Membaca data tersimpan dan membandingkannya dengan isian yang DIKIRIM sebelumnya.
 */
export async function recheckStockPrice(formData: FormData, deps: StockPriceDeps): Promise<StockPriceResult> {
  const parsed = parseSubmission(formData);
  if (!parsed.ok) return parsed.result;
  const gate = await deps.gate();
  if (!gate.ok) return gate.result;
  const result = await verifyAfterUncertain(gate.db, parsed.submission, {
    stockCenti: parsed.stockCenti,
    priceIdr: parsed.priceIdr,
  });
  if (result.state === "verified" || result.state === "changed_elsewhere") runSideEffect(deps.afterSave);
  return result;
}
