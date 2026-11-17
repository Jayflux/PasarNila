/**
 * Informasi usaha SELAIN nama (PRD A-18, ARCHITECTURE.md §13.1).
 *
 * Nama usaha TIDAK disimpan di sini: sumbernya tabel `site_settings` dan dapat diganti mitra dari
 * panel (PRD §12.7). `null` berarti konten belum tersedia dan harus tampil sebagai placeholder yang
 * jelas, bukan data karangan (PRD BR-K1, BR-K2).
 */
export type OperatingHours = ReadonlyArray<{ day: string; hours: string }>;

export type SiteInfo = {
  /** Hanya dipakai bila pengaturan usaha gagal dimuat (PRD BR-P6). */
  fallbackDisplayName: string;
  tagline: string | null;
  /** [[PLACEHOLDER: Sejarah dan gambaran usaha]], menyusul dari klien (K5). */
  profile: string | null;
  address: string | null;
  mapsUrl: string | null;
  /** Menunggu klien (K9). */
  operatingHours: OperatingHours | null;
  socials: ReadonlyArray<{ label: string; url: string }>;
};

export const site: SiteInfo = {
  fallbackDisplayName: "Ikan Nila",
  tagline: null,
  profile: null,
  // Dikonfirmasi klien, PRD §1.1.
  address:
    "Jl. Setia Bersama, RT 05/RW 11, Kelurahan Meruyung, Kecamatan Limo, " +
    "Kota Depok, Provinsi Jawa Barat",
  mapsUrl: "https://share.google/u0j1tZY5Q6MoMTD5P",
  operatingHours: null,
  socials: [],
};
