/**
 * URL peta sematan (iframe) dari alamat tertulis di `src/config/site.ts`.
 *
 * - Memakai pencarian alamat (`q=`) dengan `output=embed`: tanpa API key dan tanpa koordinat tebakan.
 * - Hasil pencarian alamat bisa kurang tepat. Titik yang DIKONFIRMASI klien hanya ada di `site.mapsUrl`
 *   (tombol "Buka di Google Maps"), jadi UI wajib menampilkan tombol itu di samping peta.
 * - Bila nanti CSP diperketat dengan `frame-src`, origin `https://www.google.com` harus diizinkan
 *   (ARCHITECTURE.md §13.1).
 */
export function buildMapEmbedUrl(address: string): string {
  const query = address.replace(/\s+/g, " ").trim();
  return `https://www.google.com/maps?q=${encodeURIComponent(query)}&output=embed`;
}
