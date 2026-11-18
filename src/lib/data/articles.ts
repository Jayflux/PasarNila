import "server-only";

import { connection } from "next/server";
import { z } from "zod";

import { isPlaceholderText } from "@/lib/content/placeholder";
import { logReadError } from "@/lib/data/log";
import { toPlainExcerpt } from "@/lib/format/excerpt";
import { getPublicSupabaseClient, publicReadSignal } from "@/lib/supabase/public-client";

/**
 * Pembacaan daftar artikel terbit untuk halaman publik (ARCHITECTURE.md §6, §12.3).
 *
 * Dinamis di MVP (tanpa cache) agar hasil edit mitra langsung terlihat setelah dimuat ulang.
 * Pemanggil wajib membungkus komponennya dengan <Suspense>.
 */

/** PRD BR-A1: tepat dua artikel. */
export const MAX_PUBLIC_ARTICLES = 2;

const articleRowSchema = z.object({
  slug: z.string().min(1),
  title: z.string().min(1),
  body: z.string(),
});

export type PublicArticleSummary = {
  slug: string;
  title: string;
  excerpt: string;
  /** Judul atau isi masih memuat penanda [PLACEHOLDER] (PRD BR-A4). */
  isPlaceholder: boolean;
};

export type PublicArticlesResult =
  | { status: "ok"; articles: PublicArticleSummary[] }
  | { status: "error" };

export async function loadPublishedArticles(
  limit: number = MAX_PUBLIC_ARTICLES,
): Promise<PublicArticlesResult> {
  await connection();

  try {
    const { data, error } = await getPublicSupabaseClient()
      .from("articles")
      .select("slug, title, body")
      .eq("is_published", true)
      .order("sort_order", { ascending: true })
      .limit(limit)
      .abortSignal(publicReadSignal());

    if (error) {
      logReadError("articles", error);
      return { status: "error" };
    }

    const parsed = z.array(articleRowSchema).safeParse(data ?? []);
    if (!parsed.success) {
      logReadError("articles", new Error("bentuk baris artikel tidak sesuai skema"));
      return { status: "error" };
    }

    return {
      status: "ok",
      articles: parsed.data.map((row) => ({
        slug: row.slug,
        title: row.title,
        excerpt: toPlainExcerpt(row.body),
        isPlaceholder: isPlaceholderText(row.title) || isPlaceholderText(row.body),
      })),
    };
  } catch (error) {
    logReadError("articles", error);
    return { status: "error" };
  }
}
