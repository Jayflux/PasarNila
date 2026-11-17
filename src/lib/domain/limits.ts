/**
 * Batas wajar input stok dan harga (PRD BR-S9, BR-H7, A-07).
 *
 * Angka ini HARUS sama dengan constraint tabel `public.products` dan pemeriksaan di fungsi
 * `public.confirm_product_stock_price` (ARCHITECTURE.md §10.5). Mengubah batas berarti mengubah
 * file ini DAN membuat migrasi baru dalam satu perubahan.
 */
export const STOCK_MIN_KG = 0;
export const STOCK_MAX_KG = 100_000;
export const STOCK_MAX_DECIMALS = 2;

export const PRICE_MIN_IDR = 0;
export const PRICE_MAX_IDR = 10_000_000;
