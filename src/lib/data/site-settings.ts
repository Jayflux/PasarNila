import "server-only";

import { PHASE_PRODUCTION_BUILD } from "next/constants";
import { cacheLife, cacheTag } from "next/cache";
import { connection } from "next/server";
import { cache } from "react";
import { z } from "zod";

import { site } from "@/config/site";
import { logReadError } from "@/lib/data/log";
import { getPublicSupabaseClient, publicReadSignal } from "@/lib/supabase/public-client";
import { createServerSupabaseClient } from "@/lib/supabase/server-client";

/**
 * Nama usaha dari tabel `site_settings` (PRD §12.7, ARCHITECTURE.md §12.5).
 *
 * - Satu-satunya sumber nama usaha. Tidak ada nama usaha yang ditulis di komponen atau config.
 * - Di-cache dengan tag `site-settings`; Server Action ganti nama memanggil `updateTag(SITE_SETTINGS_TAG)`
 *   setelah simpan berhasil dan pada setiap pemeriksaan ulang hasil yang belum pasti.
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

/**
 * Nama usaha TERSIMPAN untuk formulir panel (sesi mitra, tanpa cache).
 *
 * Berbeda dari `getBusinessName()`: TIDAK pernah memakai nama cadangan. Bila pembacaan gagal, panel
 * tidak menampilkan formulir, sehingga nama cadangan tampilan tidak dapat tersimpan tanpa sengaja
 * menimpa nama asli (PRD BR-P6).
 */
export type PartnerSiteSettingsResult =
  | { status: "ok"; businessName: string; updatedAt: string }
  | { status: "not_found" }
  | { status: "error" };

const partnerSettingsRowSchema = z.object({ business_name: z.string(), updated_at: z.string() });

export async function loadSiteSettingsForPartner(): Promise<PartnerSiteSettingsResult> {
  await connection();
  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("site_settings")
      .select("business_name, updated_at")
      .eq("id", true)
      .abortSignal(publicReadSignal())
      .maybeSingle();
    if (error) {
      logReadError("site_settings_partner", error);
      return { status: "error" };
    }
    if (data === null) return { status: "not_found" };
    const parsed = partnerSettingsRowSchema.safeParse(data);
    if (!parsed.success) {
      logReadError("site_settings_partner", new Error("bentuk baris pengaturan tidak sesuai skema"));
      return { status: "error" };
    }
    return { status: "ok", businessName: parsed.data.business_name, updatedAt: parsed.data.updated_at };
  } catch (error) {
    logReadError("site_settings_partner", error);
    return { status: "error" };
  }
}
