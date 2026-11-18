import "server-only";

import { connection } from "next/server";
import { z } from "zod";

import { isPlaceholderText } from "@/lib/content/placeholder";
import { logReadError } from "@/lib/data/log";
import { toPlainExcerpt } from "@/lib/format/excerpt";
import { getPublicSupabaseClient, publicReadSignal } from "@/lib/supabase/public-client";
import { createServerSupabaseClient } from "@/lib/supabase/server-client";

/**
 * Pembacaan daftar artikel terbit untuk halaman publik (ARCHITECTURE.md §6, §12.3).
 *
 * Dinamis di MVP (tanpa cache) agar hasil edit mitra langsung terlihat setelah dimuat ulang.
 * Pemanggil wajib membungkus komponennya dengan <Suspense>.
 */

/** PRD BR-A1: tepat dua artikel. */
export const MAX_PUBLIC_ARTICLES = 2;

export type PartnerArticle = {
  slug: string;
  title: string;
  body: string;
  isPublished: boolean;
  sortOrder: number;
  updatedAt: string | null;
};

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

/**
 * Pembacaan artikel untuk panel mitra (sesi mitra; RLS mengizinkan mitra membaca semua artikel).
 * Gagal muat (`error`) dibedakan dari daftar kosong (`ok` dengan 0 artikel).
 */
export type PartnerArticlesResult =
  | { status: "ok"; articles: PartnerArticle[] }
  | { status: "error" };

export const partnerArticleRowSchema = z.object({
  slug: z.string().min(1),
  title: z.string(),
  body: z.string(),
  is_published: z.boolean(),
  sort_order: z.number().int(),
  updated_at: z.string().nullable(),
});

export function toPartnerArticle(row: z.infer<typeof partnerArticleRowSchema>): PartnerArticle {
  return {
    slug: row.slug,
    title: row.title,
    body: row.body,
    isPublished: row.is_published,
    sortOrder: row.sort_order,
    updatedAt: row.updated_at,
  };
}


export const PARTNER_ARTICLE_COLUMNS = "slug, title, body, is_published, sort_order, updated_at";

export async function loadArticlesForPartner(): Promise<PartnerArticlesResult> {
  await connection();
  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("articles")
      .select(PARTNER_ARTICLE_COLUMNS)
      .order("sort_order", { ascending: true })
      .abortSignal(publicReadSignal());

    if (error) {
      logReadError("articles_partner", error);
      return { status: "error" };
    }
    const parsed = z.array(partnerArticleRowSchema).safeParse(data ?? []);
    if (!parsed.success) {
      logReadError("articles_partner", new Error("bentuk baris artikel tidak sesuai skema"));
      return { status: "error" };
    }
    return { status: "ok", articles: parsed.data.map(toPartnerArticle) };
  } catch (error) {
    logReadError("articles_partner", error);
    return { status: "error" };
  }
}
