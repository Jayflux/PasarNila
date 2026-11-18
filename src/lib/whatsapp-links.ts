import "server-only";

import type { WhatsAppMessageKind } from "@/config/whatsapp-messages";
import { PRIMARY_PRODUCT_SLUG } from "@/lib/data/products";
import type { BusinessName } from "@/lib/data/site-settings";
import { getWhatsAppConfig, getSiteUrl } from "@/lib/env";
import {
  buildWhatsAppMessage,
  buildProductUrl,
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
  slug: string = PRIMARY_PRODUCT_SLUG,
): string | null {
  return buildWhatsAppUrl(
    getWhatsAppConfig(),
    buildWhatsAppMessage(kind, {
      productName,
      productUrl: buildProductUrl(getSiteUrl(), slug),
    }),
  );
}

export function getWhatsAppDisplayNumber(): string | null {
  return formatWhatsAppNumberForDisplay(getWhatsAppConfig());
}

export function getVolumeOrderWhatsAppHref(
  kg: number,
  productName: string,
  slug: string = PRIMARY_PRODUCT_SLUG,
): string | null {
  return buildWhatsAppUrl(
    getWhatsAppConfig(),
    buildWhatsAppMessage("product_available", {
      productName: `${kg} kg ${productName}`,
      productUrl: buildProductUrl(getSiteUrl(), slug),
    }),
  );
}
