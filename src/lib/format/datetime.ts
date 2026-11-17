/**
 * Format waktu dalam WIB (Asia/Jakarta), PRD BR-W2 dan ARCHITECTURE.md §11.2.
 *
 * Konversi zona waktu memakai Intl dengan `timeZone` eksplisit, sehingga hasil tidak bergantung pada
 * zona waktu server (Vercel berjalan dalam UTC). Nama bulan ditulis sendiri agar keluaran tidak berubah
 * mengikuti versi data lokal ICU.
 */

export const WIB_TIME_ZONE = "Asia/Jakarta";

const MONTHS_ID = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
] as const;

const wibPartsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: WIB_TIME_ZONE,
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function toDate(input: Date | string): Date {
  const date = input instanceof Date ? new Date(input.getTime()) : new Date(input);
  if (Number.isNaN(date.getTime())) {
    throw new RangeError("Waktu tidak valid");
  }
  return date;
}

function readPart(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string {
  const part = parts.find((p) => p.type === type);
  if (!part) {
    throw new RangeError(`Bagian waktu "${type}" tidak tersedia`);
  }
  return part.value;
}

/**
 * `2026-11-17T07:05:00Z` → "17 November 2026 pukul 14.05 WIB".
 * Menerima `Date` atau string ISO (termasuk format `timestamptz` dari PostgREST).
 */
export function formatWib(input: Date | string): string {
  const parts = wibPartsFormatter.formatToParts(toDate(input));
  const day = Number(readPart(parts, "day"));
  const monthIndex = Number(readPart(parts, "month")) - 1;
  const year = readPart(parts, "year");
  const hour = readPart(parts, "hour");
  const minute = readPart(parts, "minute");
  const month = MONTHS_ID[monthIndex];
  if (month === undefined) {
    throw new RangeError("Bulan tidak valid");
  }
  return `${day} ${month} ${year} pukul ${hour}.${minute} WIB`;
}
