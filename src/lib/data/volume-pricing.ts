import { formatRupiah } from "@/lib/format/number";

/**
 * Pilihan kuantitas dan harga bertingkat (volume pricing) ikan nila.
 * Dikonfirmasi pemilik usaha (18 Nov 2026):
 * - 1 kg  = Rp35.000 (Rp35.000 / kg)
 * - 10 kg = Rp320.000 (Rp32.000 / kg)
 * - 20 kg = Rp600.000 (Rp30.000 / kg)
 */
export type VolumeTier = {
  kg: number;
  totalPriceIdr: number;
  pricePerKgIdr: number;
  label: string;
  priceFormatted: string;
  pricePerKgFormatted: string;
  savingsNote: string | null;
};

export const VOLUME_TIERS: readonly VolumeTier[] = [
  {
    kg: 1,
    totalPriceIdr: 35_000,
    pricePerKgIdr: 35_000,
    label: "1 kg",
    priceFormatted: formatRupiah(35_000),
    pricePerKgFormatted: `${formatRupiah(35_000)} / kg`,
    savingsNote: null,
  },
  {
    kg: 10,
    totalPriceIdr: 320_000,
    pricePerKgIdr: 32_000,
    label: "10 kg",
    priceFormatted: formatRupiah(320_000),
    pricePerKgFormatted: `${formatRupiah(32_000)} / kg`,
    savingsNote: "Hemat Rp30.000",
  },
  {
    kg: 20,
    totalPriceIdr: 600_000,
    pricePerKgIdr: 30_000,
    label: "20 kg",
    priceFormatted: formatRupiah(600_000),
    pricePerKgFormatted: `${formatRupiah(30_000)} / kg`,
    savingsNote: "Hemat Rp100.000",
  },
];

export function getVolumeTierByKg(kg: number): VolumeTier | undefined {
  return VOLUME_TIERS.find((tier) => tier.kg === kg);
}
