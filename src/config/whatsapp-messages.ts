/**
 * Templat pesan WhatsApp terisi (PRD §12.4). Status: [Saran, menunggu Q-08].
 *
 * Variabel yang didukung: {businessName}, {productName}, {productUrl}.
 * Variabel kosong dihilangkan beserta spasi di depannya (lihat `buildWhatsAppMessage`).
 * Pesan TIDAK mencantumkan angka stok/harga (PRD BR-WA4, A-14).
 */
export type WhatsAppMessageKind =
  | "product_available"
  | "product_out_of_stock"
  | "product_unknown"
  | "general";

export const WHATSAPP_MESSAGE_TEMPLATES: Readonly<Record<WhatsAppMessageKind, string>> = {
  product_available:
    "Halo, saya melihat produk {productName} di website dan ingin bertanya/memesan. Apakah masih tersedia? {productUrl}",
  product_out_of_stock:
    "Halo, di website tertulis stok {productName} sedang habis. Apakah ada perkiraan kapan tersedia lagi? {productUrl}",
  // Dipakai saat stok belum pernah diisi DAN saat data produk gagal dimuat (kondisi tidak diketahui).
  product_unknown:
    "Halo, saya ingin menanyakan ketersediaan dan harga {productName}. {productUrl}",
  general: "Halo {businessName}, saya ingin bertanya tentang ikan nila.",
};
