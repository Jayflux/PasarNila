/**
 * Penanda konten placeholder (PRD BR-A4, BR-K1; ARCHITECTURE.md §8.5, §13.1).
 *
 * Artikel awal di database diberi penanda `[PLACEHOLDER]` sampai bahan klien tersedia. UI memakai
 * fungsi ini untuk menampilkannya sebagai placeholder yang jelas, bukan konten final.
 */
export const PLACEHOLDER_MARKER = "[PLACEHOLDER]";

export function isPlaceholderText(text: string | null | undefined): boolean {
  return (text ?? "").toUpperCase().includes(PLACEHOLDER_MARKER);
}
