/**
 * Batas wajar input (PRD BR-S9, BR-H7, A-07, §12.8 / A-22).
 *
 * Angka ini HARUS sama dengan constraint tabel dan pemeriksaan di fungsi database
 * (ARCHITECTURE.md §10.5). Mengubah batas berarti mengubah file ini DAN membuat migrasi baru dalam satu
 * perubahan:
 * - stok & harga per kg → `public.products` + `public.confirm_product_stock_price`;
 * - paket → `public.product_packages` + fungsi `*_product_package` (migrasi 20261119000001).
 */
export const STOCK_MIN_KG = 0;
export const STOCK_MAX_KG = 100_000;
export const STOCK_MAX_DECIMALS = 2;

export const PRICE_MIN_IDR = 0;
export const PRICE_MAX_IDR = 10_000_000;

/** Nama paket setelah spasi di awal/akhir dibuang dan spasi ganda dirapikan (karakter Unicode). */
export const PACKAGE_NAME_MAX_CHARS = 60;
/** Berat paket: > 0 kg, maksimal 2 desimal. Batas atas menangkap salah ketik (A-22). */
export const PACKAGE_WEIGHT_MAX_KG = 10_000;
/** Harga total paket, rupiah bulat. Batas teknis terpisah dari harga per kg (A-22). */
export const PACKAGE_PRICE_MAX_IDR = 1_000_000_000;

/** Judul & isi artikel (PRD BR-A6), dihitung dalam karakter Unicode seperti `char_length` Postgres. */
export const ARTICLE_TITLE_MAX_CHARS = 150;
export const ARTICLE_BODY_MAX_CHARS = 20_000;

/** Nama usaha (PRD BR-P3). */
export const BUSINESS_NAME_MIN_CHARS = 2;
export const BUSINESS_NAME_MAX_CHARS = 80;
