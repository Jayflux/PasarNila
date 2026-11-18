"use server";

import { revalidatePath, updateTag } from "next/cache";

import { requirePartner } from "@/lib/auth/require-partner";
import { SITE_SETTINGS_TAG } from "@/lib/data/site-settings";
import { createServerSupabaseClient } from "@/lib/supabase/server-client";

export type SiteSettingsActionResult = {
  ok: boolean;
  message?: string;
  fieldError?: string;
  savedName?: string;
};

/**
 * Server Action untuk memperbarui nama usaha mitra (PRD BR-P3, FR-16, AC-47; ARCHITECTURE §5.6, §12.5).
 */
export async function updateBusinessNameAction(
  _prevState: SiteSettingsActionResult | null,
  formData: FormData,
): Promise<SiteSettingsActionResult> {
  await requirePartner();

  const rawName = (formData.get("businessName") as string | null) ?? "";
  const trimmedName = rawName.replace(/\s+/g, " ").trim();

  // Validasi batas dan format (PRD BR-P3, A-20; ARCHITECTURE §10.2)
  if (trimmedName.length < 2 || trimmedName.length > 80) {
    return {
      ok: false,
      fieldError: "Nama usaha harus terdiri dari 2 hingga 80 karakter.",
    };
  }

  if (/[\r\n]/.test(rawName)) {
    return {
      ok: false,
      fieldError: "Nama usaha tidak boleh memuat baris baru.",
    };
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("site_settings")
      .update({
        business_name: trimmedName,
      })
      .eq("id", true)
      .select("business_name, updated_at");

    if (error) {
      return {
        ok: false,
        message: "Gagal menyimpan nama usaha. Terjadi kesalahan database.",
      };
    }

    if (!data || data.length === 0) {
      return {
        ok: false,
        message: "Gagal menyimpan. Anda tidak memiliki izin untuk mengubah pengaturan.",
      };
    }

    // Invalidasi cache nama usaha instan dengan updateTag (ARCHITECTURE §12.5)
    updateTag(SITE_SETTINGS_TAG);
    revalidatePath("/", "layout");

    return {
      ok: true,
      message: `Nama usaha berhasil diperbarui menjadi "${trimmedName}".`,
      savedName: trimmedName,
    };
  } catch (err) {
    return {
      ok: false,
      message:
        err instanceof Error
          ? `Gagal menyimpan: ${err.message}`
          : "Gagal menyimpan nama usaha. Silakan coba lagi.",
    };
  }
}
