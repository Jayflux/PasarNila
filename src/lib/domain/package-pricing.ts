/**
 * Perhitungan harga paket katalog (PRD §12.8, BR-PK5–BR-PK8; ARCHITECTURE.md §11.4).
 *
 *   nilai pembanding = berat paket × harga satuan per kg (harga satuan SAAT INI di produk)
 *   penghematan      = nilai pembanding − harga total paket
 *   harga efektif/kg = harga total paket ÷ berat paket
 *
 * Presisi: berat dihitung dalam perseratus kg (bilangan bulat) dan semua perkalian/pembagian memakai
 * BigInt, jadi tidak ada galat biner. Hasil yang mengandung pecahan rupiah dibulatkan SEKALI pada hasil
 * akhir ke rupiah terdekat, setengah ke atas, dan diberi tanda `approximate` ("sekitar").
 *
 * Penghematan dan harga efektif TIDAK disimpan di database; selalu dihitung dari data terbaru.
 */
import { formatKg, formatPricePerKg, formatRupiah } from "@/lib/format/number";

export type RoundedIdr = { idr: number; approximate: boolean };

const HUNDRED = BigInt(100);
const TWO = BigInt(2);
const ZERO = BigInt(0);

/** pembilang/penyebut (keduanya ≥ 0, penyebut > 0) → rupiah terdekat, setengah ke atas. */
function roundHalfUp(numerator: bigint, denominator: bigint): RoundedIdr {
  const quotient = (numerator * TWO + denominator) / (denominator * TWO);
  return { idr: Number(quotient), approximate: numerator % denominator !== ZERO };
}

/** Berat (kg, maksimal 2 desimal) → perseratus kg. Melempar bila presisinya lebih dari 2 desimal. */
export function weightToCenti(weightKg: number): number {
  const centi = Math.round(weightKg * 100);
  if (!Number.isFinite(weightKg) || weightKg <= 0 || Math.abs(centi - weightKg * 100) > 1e-6) {
    throw new RangeError("Berat paket tidak valid");
  }
  return centi;
}

export type PackagePricing = {
  priceTotalIdr: number;
  weightKg: number;
  /** Harga total ÷ berat. */
  effectivePerKg: RoundedIdr;
  /** `null` bila harga satuan per kg belum tersedia: pembanding & badge tidak ditampilkan. */
  comparison: { compareIdr: RoundedIdr; savingsIdr: RoundedIdr | null; unitPricePerKgIdr: number } | null;
  /** Badge "Hemat Rp…": hanya bila pembanding valid dan penghematan > 0. */
  showSavingsBadge: boolean;
};

export function computePackagePricing(input: {
  weightKg: number;
  priceTotalIdr: number;
  /** Harga satuan per kg saat ini; `null` = belum tersedia/tidak terbaca. */
  unitPricePerKgIdr: number | null;
}): PackagePricing {
  const { weightKg, priceTotalIdr, unitPricePerKgIdr } = input;
  if (!Number.isInteger(priceTotalIdr) || priceTotalIdr < 0) {
    throw new RangeError("Harga paket harus rupiah bulat dan tidak negatif");
  }
  const centi = BigInt(weightToCenti(weightKg));
  const price = BigInt(priceTotalIdr);

  // Harga efektif = price / (centi / 100) = price × 100 / centi
  const effectivePerKg = roundHalfUp(price * HUNDRED, centi);

  if (unitPricePerKgIdr === null || !Number.isInteger(unitPricePerKgIdr) || unitPricePerKgIdr < 0) {
    return { priceTotalIdr, weightKg, effectivePerKg, comparison: null, showSavingsBadge: false };
  }

  // Pembanding = centi × harga satuan / 100. Penghematan dihitung dari nilai TEPAT lalu dibulatkan sekali.
  const exactCompareNumerator = centi * BigInt(unitPricePerKgIdr);
  const compareIdr = roundHalfUp(exactCompareNumerator, HUNDRED);
  const savingsNumerator = exactCompareNumerator - price * HUNDRED;
  const savingsIdr = savingsNumerator > ZERO ? roundHalfUp(savingsNumerator, HUNDRED) : null;

  return {
    priceTotalIdr,
    weightKg,
    effectivePerKg,
    comparison: { compareIdr, savingsIdr, unitPricePerKgIdr },
    showSavingsBadge: savingsIdr !== null && savingsIdr.idr > 0,
  };
}

// ---------------------------------------------------------------------------------------------
// Label tampilan
// ---------------------------------------------------------------------------------------------

export function effectivePerKgLabel(value: RoundedIdr): string {
  return value.approximate
    ? `Setara sekitar ${formatRupiah(value.idr)}/kg`
    : `Setara ${formatRupiah(value.idr)}/kg`;
}

export function savingsBadgeLabel(pricing: PackagePricing): string | null {
  if (!pricing.showSavingsBadge || !pricing.comparison?.savingsIdr) return null;
  const savings = pricing.comparison.savingsIdr;
  return `Hemat ${savings.approximate ? "sekitar " : ""}${formatRupiah(savings.idr)}`;
}

/** "Dibanding harga satuan saat ini: 100 kg × Rp35.000 / kg = Rp3.500.000." */
export function comparisonLabel(pricing: PackagePricing): string | null {
  if (!pricing.comparison) return null;
  const { compareIdr, unitPricePerKgIdr } = pricing.comparison;
  return `Dibanding harga satuan saat ini: ${formatKg(pricing.weightKg)} × ${formatPricePerKg(unitPricePerKgIdr)} = ${
    compareIdr.approximate ? "sekitar " : ""
  }${formatRupiah(compareIdr.idr)}.`;
}

// ---------------------------------------------------------------------------------------------
// Ketersediaan terhadap stok total bersama (A-21)
// ---------------------------------------------------------------------------------------------

export type PackageAvailability =
  /** Stok tercatat ≥ berat paket. Tetap bukan jaminan (BR-W3). */
  | "within_recorded_stock"
  /** Berat paket melebihi stok tercatat: ketersediaan perlu dikonfirmasi lewat WhatsApp. */
  | "exceeds_recorded_stock"
  | "out_of_stock"
  /** Stok belum pernah diisi atau tidak diketahui: jangan menjanjikan paket tersedia. */
  | "unknown";

export function packageAvailability(stockKg: number | null, weightKg: number): PackageAvailability {
  if (stockKg === null || !Number.isFinite(stockKg) || stockKg < 0) return "unknown";
  if (stockKg === 0) return "out_of_stock";
  return Math.round(stockKg * 100) >= weightToCenti(weightKg) ? "within_recorded_stock" : "exceeds_recorded_stock";
}
