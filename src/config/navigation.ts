/**
 * Navigasi publik (PRD §7, ARCHITECTURE.md §6).
 *
 * Seluruh halaman publik (/produk, /artikel, /profil, /kontak) sudah tersedia (Langkah 5 selesai).
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
  { label: "Produk", href: "/produk" },
  { label: "Artikel", href: "/artikel" },
  { label: "Profil", href: "/profil" },
  { label: "Kontak", href: "/kontak" },
];
