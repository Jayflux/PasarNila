/**
 * Aturan tampilan stok, harga, dan waktu konfirmasi.
 * PRD BR-S6, BR-S7, BR-H4, BR-H5, BR-W2, BR-W3, BR-W7, FR-08; AC-01–AC-08, AC-12.
 *
 * Membedakan dengan tegas:
 * - stok NULL ("Belum tersedia") vs stok 0 ("Stok habis");
 * - harga NULL ("Belum tersedia") vs harga 0 ("Rp0 / kg");
 * - data gagal dimuat (pesan gangguan) vs data kosong.
 */
import type { WhatsAppMessageKind } from "@/config/whatsapp-messages";
import { formatWib } from "@/lib/format/datetime";
import { formatKg, formatPricePerKg } from "@/lib/format/number";

export const NOT_AVAILABLE_LABEL = "Belum tersedia";
export const OUT_OF_STOCK_LABEL = "Stok habis";
export const NEVER_CONFIRMED_LABEL = "Belum pernah diperbarui";
export const PRODUCT_LOAD_ERROR_MESSAGE =
  "Informasi stok dan harga sedang tidak dapat dimuat";
export const CONFIRMED_AT_HEADING = "Stok & harga terakhir diperbarui:";
/** Arti waktu konfirmasi (PRD BR-W3). [Saran] untuk teks persisnya. */
export const CONFIRMED_AT_EXPLANATION =
  "Waktu ini menunjukkan kapan stok dan harga terakhir disimpan atau diperiksa ulang oleh penjual. " +
  "Ketersediaan sebenarnya dapat berubah sewaktu-waktu. Silakan konfirmasi melalui WhatsApp.";

export type StockStatus =
  | { kind: "unset"; label: string }
  | { kind: "out_of_stock"; label: string }
  | { kind: "available"; label: string; kg: number };

export type PriceStatus =
  | { kind: "unset"; label: string }
  | { kind: "set"; label: string; idr: number };

/** Nilai tersimpan stok: `null` = belum pernah diisi. Melempar RangeError bila nilainya mustahil. */
export function getStockStatus(stockKg: number | null): StockStatus {
  if (stockKg === null) return { kind: "unset", label: NOT_AVAILABLE_LABEL };
  if (!Number.isFinite(stockKg) || stockKg < 0) {
    throw new RangeError("Nilai stok tersimpan tidak valid");
  }
  if (stockKg === 0) return { kind: "out_of_stock", label: OUT_OF_STOCK_LABEL };
  return { kind: "available", label: formatKg(stockKg), kg: stockKg };
}

/** Nilai tersimpan harga: `null` = belum pernah diisi; `0` ditampilkan apa adanya (A-06). */
export function getPriceStatus(priceIdr: number | null): PriceStatus {
  if (priceIdr === null) return { kind: "unset", label: NOT_AVAILABLE_LABEL };
  if (!Number.isInteger(priceIdr) || priceIdr < 0) {
    throw new RangeError("Nilai harga tersimpan tidak valid");
  }
  return { kind: "set", label: formatPricePerKg(priceIdr), idr: priceIdr };
}

export function getConfirmedAtLabel(confirmedAt: Date | string | null): string {
  return confirmedAt === null ? NEVER_CONFIRMED_LABEL : formatWib(confirmedAt);
}

export type StoredStockPrice = {
  stockKg: number | null;
  pricePerKgIdr: number | null;
  confirmedAt: Date | string | null;
};

export type ProductLoadResult =
  | { status: "ok"; data: StoredStockPrice }
  | { status: "error" };

export type ProductDisplay =
  | {
      status: "ok";
      stock: StockStatus;
      price: PriceStatus;
      confirmedAtLabel: string;
      whatsAppMessageKind: WhatsAppMessageKind;
    }
  | {
      status: "error";
      /** `invalid_data` perlu dicatat di log oleh pemanggil; keduanya tampil sama ke pengunjung. */
      reason: "load_failed" | "invalid_data";
      message: string;
      whatsAppMessageKind: WhatsAppMessageKind;
    };

function errorDisplay(reason: "load_failed" | "invalid_data"): ProductDisplay {
  return {
    status: "error",
    reason,
    message: PRODUCT_LOAD_ERROR_MESSAGE,
    // Kondisi stok tidak diketahui: pesan menanyakan ketersediaan & harga, tombol tetap aktif.
    whatsAppMessageKind: "product_unknown",
  };
}

export function getProductDisplay(result: ProductLoadResult): ProductDisplay {
  if (result.status === "error") return errorDisplay("load_failed");

  const { stockKg, pricePerKgIdr, confirmedAt } = result.data;

  // Angka tanpa waktu konfirmasi tidak boleh tampil (sejalan constraint integritas, ARCHITECTURE §8.2).
  if (confirmedAt === null && (stockKg !== null || pricePerKgIdr !== null)) {
    return errorDisplay("invalid_data");
  }

  try {
    const stock = getStockStatus(stockKg);
    const price = getPriceStatus(pricePerKgIdr);
    const confirmedAtLabel = getConfirmedAtLabel(confirmedAt);
    const whatsAppMessageKind: WhatsAppMessageKind =
      stock.kind === "available"
        ? "product_available"
        : stock.kind === "out_of_stock"
          ? "product_out_of_stock"
          : "product_unknown";
    return { status: "ok", stock, price, confirmedAtLabel, whatsAppMessageKind };
  } catch (error) {
    if (error instanceof RangeError) return errorDisplay("invalid_data");
    throw error;
  }
}
