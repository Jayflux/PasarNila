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
  /** Ringkasan lokasi untuk hero/header. Diturunkan dari `address`, bukan data tambahan. */
  shortLocation: string | null;
  /** Tautan berbagi Google yang dikonfirmasi klien membuka titik lokasi yang benar. */
  mapsUrl: string | null;
  /** Menunggu klien (K9). */
  operatingHours: OperatingHours | null;
  socials: ReadonlyArray<{ label: string; url: string }>;
};

export const site: SiteInfo = {
  fallbackDisplayName: "Ikan Nila",
  tagline: null,
  profile:
    "Juki Fish Farm adalah usaha pembesaran ikan nila merah milik Bapak Ahmad Marzuki di Kelurahan Meruyung, Kecamatan Limo, Depok. Usaha ini sudah berjalan sekitar empat tahun dengan mengelola 10 kolam di lahan sekitar 2.000 m², dan ikannya dibesarkan sampai ukuran konsumsi. Selama ini hasil panen dijual lewat pengepul dan pasar lokal, dan seiring permintaan ikan konsumsi di Depok yang terus naik, Juki Fish Farm kini membuka penjualan langsung ke pelanggan. Untuk menjaga kualitas dan jumlah ikan, usaha ini bekerja sama dengan tim pengabdian UPNVJ lewat program Aksara Peduli, mulai dari pembenahan aerasi kolam agar oksigen lebih merata hingga penguatan pengelolaan usaha dan pemasaran digital.",
  address: "Jl. Swadaya Raya RT 05/11, Kelurahan Meruyung, Kecamatan Limo, Kota Depok, Jawa Barat",
  // Ringkasan dari alamat di atas (PRD §1.1, §2.1).
  shortLocation: "Meruyung, Depok",
  mapsUrl: "https://share.google/u0j1tZY5Q6MoMTD5P",
  operatingHours: [{ day: "Setiap hari", hours: "07:00 – 17:00" }],
  socials: [],
};
