/**
 * Normalisasi nomor WhatsApp, pembuat tautan wa.me, dan pesan terisi.
 * PRD BR-WA1–BR-WA6; ARCHITECTURE.md §13.2.
 *
 * - Tidak ada nomor cadangan/contoh. Nomor kosong atau tidak valid → `configured: false`.
 * - Tautan hanya bisa dibuat dari konfigurasi yang valid, sehingga `https://wa.me/?text=…` (tanpa
 *   nomor, membuka pemilih kontak) tidak mungkin terbentuk.
 */
import {
  WHATSAPP_MESSAGE_TEMPLATES,
  type WhatsAppMessageKind,
} from "@/config/whatsapp-messages";

export type WhatsAppConfig =
  | { configured: true; number: string }
  | { configured: false; reason: "missing" | "invalid" };

/** Karakter yang boleh muncul pada nomor sebelum dinormalisasi. Selain ini → tidak valid. */
const ALLOWED_NUMBER_CHARS = /^[\d\s+\-.()]+$/;
/** 62 + digit pertama bukan 0 + 7–12 digit (total 10–15 digit). */
const VALID_WHATSAPP_NUMBER = /^62[1-9]\d{7,12}$/;

const INVALID: WhatsAppConfig = { configured: false, reason: "invalid" };

export function resolveWhatsAppConfig(raw: string | null | undefined): WhatsAppConfig {
  const value = (raw ?? "").trim();
  if (value === "") return { configured: false, reason: "missing" };

  // Validasi karakter dulu; jangan membuang huruf atau simbol lain secara diam-diam.
  if (!ALLOWED_NUMBER_CHARS.test(value)) return INVALID;

  const plusCount = value.match(/\+/g)?.length ?? 0;
  const hasLeadingPlus = value.startsWith("+");
  if (plusCount > 1 || (plusCount === 1 && !hasLeadingPlus)) return INVALID;

  let digits = value.replace(/\D/g, "");
  if (hasLeadingPlus) {
    // Format internasional: hanya nomor Indonesia (+62) yang didukung.
    if (!digits.startsWith("62")) return INVALID;
  } else if (digits.startsWith("62")) {
    // sudah dalam format 62…
  } else if (digits.startsWith("0")) {
    digits = `62${digits.slice(1)}`;
  } else if (digits.startsWith("8")) {
    digits = `62${digits}`;
  } else {
    return INVALID;
  }

  return VALID_WHATSAPP_NUMBER.test(digits)
    ? { configured: true, number: digits }
    : INVALID;
}

/** Mengembalikan `null` bila nomor belum dikonfigurasi, sehingga tombol harus dinonaktifkan. */
export function buildWhatsAppUrl(config: WhatsAppConfig, message: string): string | null {
  if (!config.configured) return null;
  const base = `https://wa.me/${config.number}`;
  const text = message.trim();
  return text === "" ? base : `${base}?text=${encodeURIComponent(text)}`;
}

const PRODUCT_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** `https://contoh.vercel.app` + `ikan-nila` → `https://contoh.vercel.app/produk/ikan-nila`. */
export function buildProductUrl(siteUrl: URL | null, slug: string): string | null {
  if (!PRODUCT_SLUG.test(slug)) {
    throw new RangeError("Slug produk tidak valid");
  }
  if (siteUrl === null) return null;
  return new URL(`/produk/${slug}`, siteUrl).toString();
}

export type WhatsAppMessageValues = {
  businessName?: string | null;
  productName?: string | null;
  productUrl?: string | null;
};

function normalizeValue(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

/**
 * Mengisi templat. Variabel kosong dihilangkan beserta spasi di depannya:
 * "Halo {businessName}, saya…" tanpa nama → "Halo, saya…".
 */
export function buildWhatsAppMessage(
  kind: WhatsAppMessageKind,
  values: WhatsAppMessageValues,
  templates: Readonly<Record<WhatsAppMessageKind, string>> = WHATSAPP_MESSAGE_TEMPLATES,
): string {
  const template = templates[kind];
  const filled = template.replace(
    /(\s*)\{(businessName|productName|productUrl)\}/g,
    (_match, leadingSpace: string, key: keyof WhatsAppMessageValues) => {
      const value = normalizeValue(values[key]);
      return value === "" ? "" : `${leadingSpace}${value}`;
    },
  );
  return filled.replace(/\s{2,}/g, " ").trim();
}
