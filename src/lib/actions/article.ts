"use server";

import { revalidatePath } from "next/cache";

import { requirePartner } from "@/lib/auth/require-partner";
import { createServerSupabaseClient } from "@/lib/supabase/server-client";

export type ArticleActionResult = {
  ok: boolean;
  message?: string;
  fieldErrors?: {
    title?: string;
    body?: string;
  };
};

/**
 * Server Action untuk memperbarui judul dan isi artikel oleh mitra (PRD FR-23, AC-37, AC-38).
 */
export async function updateArticleAction(
  _prevState: ArticleActionResult | null,
  formData: FormData,
): Promise<ArticleActionResult> {
  await requirePartner();

  const slug = (formData.get("slug") as string | null)?.trim() ?? "";
  const title = (formData.get("title") as string | null)?.trim() ?? "";
  const body = (formData.get("body") as string | null)?.trim() ?? "";

  if (!slug) {
    return { ok: false, message: "Slug artikel tidak valid." };
  }

  // Validasi batas karakter (PRD BR-A6; ARCHITECTURE §10.2)
  const fieldErrors: { title?: string; body?: string } = {};

  if (title.length < 1 || title.length > 150) {
    fieldErrors.title = "Judul artikel wajib diisi (1 - 150 karakter).";
  }

  if (body.length < 1 || body.length > 20000) {
    fieldErrors.body = "Isi artikel wajib diisi (1 - 20.000 karakter).";
  }

  if (fieldErrors.title || fieldErrors.body) {
    return { ok: false, fieldErrors };
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("articles")
      .update({
        title,
        body,
      })
      .eq("slug", slug)
      .select("slug, title, body, updated_at");

    if (error) {
      return {
        ok: false,
        message: "Gagal menyimpan artikel. Terjadi kesalahan pada database.",
      };
    }

    // ARCHITECTURE §10.3: UPDATE yang ditolak RLS menghasilkan 0 baris
    if (!data || data.length === 0) {
      return {
        ok: false,
        message: "Gagal menyimpan. Artikel tidak ditemukan atau Anda tidak memiliki akses.",
      };
    }

    // Revalidasi halaman publik dan panel
    revalidatePath("/");
    revalidatePath("/artikel");
    revalidatePath(`/artikel/${slug}`);
    revalidatePath("/mitra/artikel");
    revalidatePath(`/mitra/artikel/${slug}`);

    return {
      ok: true,
      message: "Artikel berhasil disimpan dan diperbarui.",
    };
  } catch (err) {
    return {
      ok: false,
      message:
        err instanceof Error
          ? `Gagal menyimpan: ${err.message}`
          : "Gagal menyimpan artikel. Silakan coba lagi.",
    };
  }
}
