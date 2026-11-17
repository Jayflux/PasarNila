/**
 * Format angka Indonesia: koma desimal, titik ribuan (PRD NFR-10).
 * Format dilakukan di server saat render agar hasilnya sama di semua perangkat.
 */

const kgFormatter = new Intl.NumberFormat("id-ID", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
  useGrouping: true,
});

const rupiahFormatter = new Intl.NumberFormat("id-ID", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
  useGrouping: true,
});

function assertFiniteNonNegative(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${label} harus berupa angka terhingga dan tidak negatif`);
  }
}

/** 12.5 → "12,5 kg", 12.25 → "12,25 kg", 10 → "10 kg". */
export function formatKg(kg: number): string {
  assertFiniteNonNegative(kg, "Stok");
  return `${kgFormatter.format(kg)} kg`;
}

/**
 * 35000 → "Rp35.000". Prefiks "Rp" ditulis sendiri (bukan `style: "currency"`) agar keluaran
 * persis sama dengan PRD dan tidak bergantung pada spasi/desimal versi data lokal ICU.
 */
export function formatRupiah(idr: number): string {
  assertFiniteNonNegative(idr, "Harga");
  if (!Number.isInteger(idr)) {
    throw new RangeError("Harga harus berupa rupiah bulat");
  }
  return `Rp${rupiahFormatter.format(idr)}`;
}

/** 35000 → "Rp35.000 / kg". */
export function formatPricePerKg(idr: number): string {
  return `${formatRupiah(idr)} / kg`;
}
