"use client";

import { useActionState, useState } from "react";
import Link from "next/link";

import { buttonClass } from "@/components/ui/button-styles";
import { updateArticleAction, type ArticleActionResult } from "@/lib/actions/article";

type ArticleFormProps = {
  slug: string;
  initialTitle: string;
  initialBody: string;
};

export function ArticleForm({ slug, initialTitle, initialBody }: ArticleFormProps) {
  const [title, setTitle] = useState(initialTitle);
  const [body, setBody] = useState(initialBody);
  const [activeTab, setActiveTab] = useState<"edit" | "preview">("edit");

  const [state, formAction, isPending] = useActionState<ArticleActionResult | null, FormData>(
    updateArticleAction,
    null,
  );

  return (
    <div className="space-y-6">
      {state?.ok && state.message ? (
        <div
          role="status"
          className="rounded-2xl border border-wa/30 bg-wa/10 p-5 text-wa flex items-center gap-3"
        >
          <span className="text-xl font-bold">✓</span>
          <p className="font-bold">{state.message}</p>
        </div>
      ) : null}

      {state && !state.ok && state.message ? (
        <div
          role="alert"
          className="rounded-2xl border border-error-ink/20 bg-error-soft p-5 text-error-ink flex items-center gap-3"
        >
          <span className="text-xl font-bold">!</span>
          <p className="font-bold">{state.message}</p>
        </div>
      ) : null}

      <div className="rounded-[1.75rem] border border-line bg-surface p-6 sm:p-8 shadow-sm">
        {/* Tab Editor vs Pratinjau (PRD FR-27) */}
        <div className="flex items-center justify-between border-b border-line pb-4">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setActiveTab("edit")}
              className={`rounded-lg px-4 py-2 text-sm font-bold transition ${
                activeTab === "edit"
                  ? "bg-deep text-white"
                  : "bg-cream text-ink-muted hover:text-ink"
              }`}
            >
              Mode Sunting
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("preview")}
              className={`rounded-lg px-4 py-2 text-sm font-bold transition ${
                activeTab === "preview"
                  ? "bg-deep text-white"
                  : "bg-cream text-ink-muted hover:text-ink"
              }`}
            >
              Pratinjau Tampilan
            </button>
          </div>

          <span className="text-xs text-ink-muted">Slug: {slug}</span>
        </div>

        <form action={formAction} className="mt-6 space-y-6">
          <input type="hidden" name="slug" value={slug} />

          {activeTab === "edit" ? (
            <>
              {/* Judul Artikel */}
              <div>
                <div className="flex items-center justify-between">
                  <label htmlFor="title" className="block text-sm font-semibold text-ink">
                    Judul Artikel <span className="text-error-ink">*</span>
                  </label>
                  <span className="text-xs text-ink-muted">{title.length} / 150</span>
                </div>
                <div className="mt-2">
                  <input
                    id="title"
                    name="title"
                    type="text"
                    required
                    maxLength={150}
                    disabled={isPending}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Judul artikel edukasi..."
                    className="block w-full rounded-xl border border-line bg-surface px-4 py-3 text-base font-semibold text-ink outline-none transition focus:border-accent-strong focus:ring-2 focus:ring-accent-strong/20 disabled:bg-neutral-soft/50"
                  />
                </div>
                {state?.fieldErrors?.title ? (
                  <p className="mt-1.5 text-xs font-semibold text-error-ink">
                    {state.fieldErrors.title}
                  </p>
                ) : null}
              </div>

              {/* Isi Artikel */}
              <div>
                <div className="flex items-center justify-between">
                  <label htmlFor="body" className="block text-sm font-semibold text-ink">
                    Isi Naskah Artikel <span className="text-error-ink">*</span>
                  </label>
                  <span className="text-xs text-ink-muted">
                    {body.length.toLocaleString("id-ID")} / 20.000
                  </span>
                </div>
                <div className="mt-2">
                  <textarea
                    id="body"
                    name="body"
                    rows={12}
                    required
                    maxLength={20000}
                    disabled={isPending}
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="Tuliskan naskah artikel edukasi di sini..."
                    className="block w-full rounded-xl border border-line bg-surface p-4 text-base leading-7 text-ink outline-none transition focus:border-accent-strong focus:ring-2 focus:ring-accent-strong/20 disabled:bg-neutral-soft/50 font-sans"
                  />
                </div>
                {state?.fieldErrors?.body ? (
                  <p className="mt-1.5 text-xs font-semibold text-error-ink">
                    {state.fieldErrors.body}
                  </p>
                ) : null}
              </div>
            </>
          ) : (
            /* Mode Pratinjau */
            <div className="rounded-2xl border border-line bg-cream/40 p-6 sm:p-8 space-y-6">
              <span className="rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold text-accent-strong uppercase">
                Pratinjau Artikel Publik
              </span>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-ink">
                {title || "(Judul masih kosong)"}
              </h2>
              <div className="border-t border-line pt-6 text-base leading-8 text-ink whitespace-pre-line">
                {body || "(Isi naskah masih kosong)"}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center pt-4 border-t border-line">
            <button
              type="submit"
              disabled={isPending}
              className={buttonClass("primary")}
            >
              {isPending ? "Menyimpan Artikel…" : "Simpan Perubahan Artikel"}
            </button>
            <Link href="/mitra/artikel" className={buttonClass("secondary")}>
              Batal
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
