import "server-only";

import type { WhatsAppMessageKind } from "@/config/whatsapp-messages";
import type { BusinessName } from "@/lib/data/site-settings";
import { getWhatsAppConfig } from "@/lib/env";
import {
  buildWhatsAppMessage,
  buildWhatsAppUrl,
  formatWhatsAppNumberForDisplay,
} from "@/lib/whatsapp";

/**
 * Pembuat tautan WhatsApp untuk komponen publik (ARCHITECTURE.md §13.2).
 *
 * Nomor hanya dari env `WHATSAPP_NUMBER` lewat `getWhatsAppConfig()`. Tidak ada nomor di komponen.
 * Hasil `null` = nomor belum dikonfigurasi/tidak valid → tombol nonaktif tanpa tautan (AC-14).
 */

/** Nama cadangan ("Ikan Nila") tidak dipakai sebagai sapaan; templat menghapus variabel kosong. */
function greetingName(businessName: BusinessName): string | null {
  return businessName.source === "settings" ? businessName.name : null;
}

export function getGeneralWhatsAppHref(businessName: BusinessName): string | null {
  return buildWhatsAppUrl(
    getWhatsAppConfig(),
    buildWhatsAppMessage("general", { businessName: greetingName(businessName) }),
  );
}

export function getProductWhatsAppHref(
  kind: WhatsAppMessageKind,
  productName: string,
): string | null {
  return buildWhatsAppUrl(
    getWhatsAppConfig(),
    buildWhatsAppMessage(kind, {
      productName,
      // TAHAP BERIKUTNYA: isi dengan buildProductUrl(getSiteUrl(), slug) setelah route
      // /produk/[slug] dibuat. Sekarang dikosongkan agar pesan tidak memuat tautan ke halaman 404.
      productUrl: null,
    }),
  );
}

export function getWhatsAppDisplayNumber(): string | null {
  return formatWhatsAppNumberForDisplay(getWhatsAppConfig());
}
