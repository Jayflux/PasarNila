/**
 * Navigasi publik (PRD §7, ARCHITECTURE.md §6).
 *
 * Route /produk, /artikel, /profil, dan /kontak belum dibuat. Sampai route itu ada, menu mengarah ke
 * bagian (anchor) di beranda agar tidak ada tautan yang berakhir di halaman 404. Saat route tahap
 * berikutnya selesai, cukup ganti `href` di sini.
 */
export const HOME_SECTIONS = {
  produk: "produk",
  profil: "profil",
  artikel: "artikel",
  lokasi: "lokasi",
  kontak: "kontak",
} as const;

export type NavItem = { label: string; href: string };

export const PUBLIC_NAV: readonly NavItem[] = [
  { label: "Beranda", href: "/" },
  // TAHAP BERIKUTNYA: ganti dengan "/produk" setelah halaman katalog dibuat.
  { label: "Produk", href: `/#${HOME_SECTIONS.produk}` },
  // TAHAP BERIKUTNYA: ganti dengan "/artikel".
  { label: "Artikel", href: `/#${HOME_SECTIONS.artikel}` },
  // TAHAP BERIKUTNYA: ganti dengan "/profil".
  { label: "Profil", href: `/#${HOME_SECTIONS.profil}` },
  // TAHAP BERIKUTNYA: ganti dengan "/kontak".
  { label: "Kontak", href: `/#${HOME_SECTIONS.kontak}` },
];
