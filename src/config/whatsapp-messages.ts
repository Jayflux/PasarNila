/**
 * Templat pesan WhatsApp terisi (PRD §12.4). Status: [Saran, menunggu Q-08].
 *
 * Variabel yang didukung: {businessName}, {productName}, {productUrl}, {packageName}, {packageWeight},
 * {packagePrice}. Variabel kosong dihilangkan beserta spasi di depannya (lihat `buildWhatsAppMessage`).
 *
 * Pesan TIDAK mencantumkan angka STOK (PRD BR-WA4, A-14). Pesan paket menyebut harga total paket yang
 * tertera di website, karena pengunjung memilih paket itu (BR-WA7); pesannya tidak mengklaim stok
 * tersedia dan tidak mencatat pesanan.
 */
export type WhatsAppMessageKind =
  | "product_available"
  | "product_out_of_stock"
  | "product_unknown"
  | "general"
  /** Paket; stok tercatat mencukupi berat paket (tetap ditanyakan, bukan dijanjikan). */
  | "package_order"
  /** Paket; stok tidak diketahui atau berat paket melebihi stok tercatat. */
  | "package_check"
  /** Paket; stok tercatat habis. */
  | "package_out_of_stock";

export const WHATSAPP_MESSAGE_TEMPLATES: Readonly<Record<WhatsAppMessageKind, string>> = {
  product_available:
    "Halo, saya melihat produk {productName} di website dan ingin bertanya/memesan. Apakah masih tersedia? {productUrl}",
  product_out_of_stock:
    "Halo, di website tertulis stok {productName} sedang habis. Apakah ada perkiraan kapan tersedia lagi? {productUrl}",
  // Dipakai saat stok belum pernah diisi DAN saat data produk gagal dimuat (kondisi tidak diketahui).
  product_unknown:
    "Halo, saya ingin menanyakan ketersediaan dan harga {productName}. {productUrl}",
  general: "Halo {businessName}, saya ingin bertanya tentang ikan nila.",
  package_order:
    "Halo, saya ingin memesan {productName} paket {packageName} ({packageWeight}) seharga {packagePrice} sesuai yang tertera di website. Apakah masih tersedia? {productUrl}",
  package_check:
    "Halo, saya tertarik dengan {productName} paket {packageName} ({packageWeight}) seharga {packagePrice} di website. Apakah stok saat ini cukup untuk paket ini? {productUrl}",
  package_out_of_stock:
    "Halo, di website tertulis stok {productName} sedang habis. Saya tertarik dengan paket {packageName} ({packageWeight}) seharga {packagePrice}. Apakah ada perkiraan kapan tersedia lagi? {productUrl}",
};
