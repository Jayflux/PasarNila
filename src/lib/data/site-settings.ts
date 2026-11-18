import "server-only";

import { PHASE_PRODUCTION_BUILD } from "next/constants";
import { cacheLife, cacheTag } from "next/cache";
import { cache } from "react";
import { z } from "zod";

import { site } from "@/config/site";
import { logReadError } from "@/lib/data/log";
import { getPublicSupabaseClient, publicReadSignal } from "@/lib/supabase/public-client";

/**
 * Nama usaha dari tabel `site_settings` (PRD §12.7, ARCHITECTURE.md §12.5).
 *
 * - Satu-satunya sumber nama usaha. Tidak ada nama usaha yang ditulis di komponen atau config.
 * - Di-cache dengan tag `site-settings`; Server Action ganti nama (tahap panel) memanggil
 *   `updateTag(SITE_SETTINGS_TAG)` setelah berhasil menyimpan.
 * - Error TIDAK ditangkap di dalam fungsi ber-cache, agar nama cadangan tidak ikut ter-cache.
 */
export const SITE_SETTINGS_TAG = "site-settings";

const siteSettingsRowSchema = z.object({
  business_name: z
    .string()
    .transform((value) => value.trim())
    .pipe(
      z
        .string()
        .min(2)
        .max(80)
        .regex(/^[^\r\n]+$/),
    ),
});

async function getSiteSettingsCached(): Promise<{ businessName: string }> {
  "use cache";
  cacheTag(SITE_SETTINGS_TAG);
  // Jaring pengaman bila DB diubah langsung lewat SQL editor (bukan lewat panel).
  cacheLife("hours");

  const { data, error } = await getPublicSupabaseClient()
    .from("site_settings")
    .select("business_name")
    .eq("id", true)
    .abortSignal(publicReadSignal())
    .single();

  if (error) {
    throw new Error(`site_settings tidak dapat dibaca (kode=${error.code ?? "-"})`);
  }
  return { businessName: siteSettingsRowSchema.parse(data).business_name };
}

export type BusinessName = {
  name: string;
  /** `fallback` = pengaturan gagal dimuat; nama netral dipakai (PRD BR-P6). */
  source: "settings" | "fallback";
};

/**
 * Nama usaha untuk header, footer, metadata, dan pesan WhatsApp. Di-dedupe per render dengan
 * React `cache` sehingga header/footer/metadata tidak masing-masing mencatat error yang sama.
 */
export const getBusinessName = cache(async (): Promise<BusinessName> => {
  try {
    const { businessName } = await getSiteSettingsCached();
    return { name: businessName, source: "settings" };
  } catch (error) {
    // ARCHITECTURE.md §12.5 (risiko build): kegagalan saat `next build` harus menggagalkan build,
    // bukan menanam nama cadangan di shell statis.
    if (process.env.NEXT_PHASE === PHASE_PRODUCTION_BUILD) throw error;
    logReadError("site_settings", error);
    return { name: site.fallbackDisplayName, source: "fallback" };
  }
});
