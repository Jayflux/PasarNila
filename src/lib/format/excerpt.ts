/**
 * Cuplikan teks polos dari isi artikel berformat Markdown terbatas (ARCHITECTURE.md §8.3, PRD A-10).
 *
 * Hasilnya teks biasa (dirender React sebagai teks, tidak pernah sebagai HTML). Penanda format
 * dibuang, tautan `[teks](url)` menjadi `teks`, lalu dipotong di batas kata.
 */
export const EXCERPT_MAX_CHARS = 160;

export function toPlainExcerpt(markdown: string, maxChars: number = EXCERPT_MAX_CHARS): string {
  const plain = markdown
    // Tautan dan gambar: [teks](url) / ![alt](url) → teks
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    // Penanda baris: subjudul, kutipan, butir daftar
    .replace(/^\s{0,3}(?:#{1,6}\s+|>\s?|[-*+]\s+|\d+[.)]\s+)/gm, "")
    // Penanda tebal/miring/kode/coret
    .replace(/(\*\*|__|\*|_|~~|`)/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (plain.length <= maxChars) return plain;

  const cut = plain.slice(0, maxChars);
  const lastSpace = cut.lastIndexOf(" ");
  const base = lastSpace > maxChars * 0.6 ? cut.slice(0, lastSpace) : cut;
  return `${base.replace(/[\s.,;:!?-]+$/, "")}…`;
}
