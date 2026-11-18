"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  recheckArticle,
  saveArticle,
  type ArticleDb,
  type ArticleDeps,
  type ArticleResult,
} from "@/lib/actions/core/article";
import { supabaseGate, verifyReadSignal, wait, writeSignal } from "@/lib/actions/core/supabase-gate";
import { settle } from "@/lib/write/outcome";

/** Server Action edit judul & isi artikel (PRD FR-23, AC-37–AC-41, AC-52; ARCHITECTURE.md §5.4). */

const COLUMNS = "slug, title, body, updated_at";

function articleDb(supabase: SupabaseClient): ArticleDb {
  return {
    update: ({ slug, title, body }) =>
      settle(() =>
        supabase.from("articles").update({ title, body }).eq("slug", slug).select(COLUMNS).abortSignal(writeSignal()),
      ),
    read: (slug) =>
      settle(() =>
        supabase.from("articles").select(COLUMNS).eq("slug", slug).abortSignal(verifyReadSignal()).maybeSingle(),
      ),
  };
}

function deps(): ArticleDeps {
  return {
    gate: supabaseGate(articleDb),
    wait,
    afterSave: (slug) => {
      revalidatePath("/");
      revalidatePath("/artikel");
      revalidatePath(`/artikel/${slug}`);
      revalidatePath("/mitra/artikel");
      revalidatePath(`/mitra/artikel/${slug}`);
    },
  };
}

export async function updateArticleAction(formData: FormData): Promise<ArticleResult> {
  return saveArticle(formData, deps());
}

export async function recheckArticleAction(formData: FormData): Promise<ArticleResult> {
  return recheckArticle(formData, deps());
}
