import "server-only";

import { connection } from "next/server";
import { z } from "zod";

import { isPlaceholderText } from "@/lib/content/placeholder";
import { logReadError } from "@/lib/data/log";
import { getPublicSupabaseClient, publicReadSignal } from "@/lib/supabase/public-client";
import { createServerSupabaseClient } from "@/lib/supabase/server-client";
import type { PartnerArticle } from "@/lib/data/articles";

/**
 * Pembacaan detail artikel terbit untuk halaman /artikel/[slug] (ARCHITECTURE.md §6, §12.3).
 *
 * Dinamis tanpa cache agar hasil edit mitra langsung terlihat setelah dimuat ulang.
 * Pemanggil wajib membungkus komponennya dengan <Suspense>.
 */

export type PublicArticle = {
  slug: string;
  title: string;
  body: string;
  isPlaceholder: boolean;
};

export type PublicArticleResult =
  | { status: "ok"; article: PublicArticle }
  | { status: "not_found" }
  | { status: "error" };

const schema = z.object({ slug: z.string().min(1), title: z.string().min(1), body: z.string() });

export async function loadPublishedArticle(slug: string): Promise<PublicArticleResult> {
  await connection();
  try {
    const { data, error } = await getPublicSupabaseClient()
      .from("articles")
      .select("slug, title, body")
      .eq("slug", slug)
      .eq("is_published", true)
      .abortSignal(publicReadSignal())
      .maybeSingle();
    if (error) {
      logReadError("articles", error);
      return { status: "error" };
    }
    if (data === null) return { status: "not_found" };
    const parsed = schema.safeParse(data);
    if (!parsed.success) {
      logReadError("articles", new Error("bentuk baris artikel tidak sesuai"));
      return { status: "error" };
    }
    const row = parsed.data;
    return {
      status: "ok",
      article: {
        slug: row.slug,
        title: row.title,
        body: row.body,
        isPlaceholder: isPlaceholderText(row.title) || isPlaceholderText(row.body),
      },
    };
  } catch (err) {
    logReadError("articles", err);
    return { status: "error" };
  }
}

/**
 * Pembacaan detail artikel tunggal untuk panel mitra (menggunakan session cookie mitra).
 */
export async function loadArticleForPartner(slug: string): Promise<PartnerArticle | null> {
  await connection();
  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("articles")
      .select("slug, title, body, is_published, sort_order, updated_at")
      .eq("slug", slug)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    return {
      slug: data.slug,
      title: data.title,
      body: data.body,
      isPublished: data.is_published,
      sortOrder: data.sort_order,
      updatedAt: data.updated_at,
    };
  } catch {
    return null;
  }
}

