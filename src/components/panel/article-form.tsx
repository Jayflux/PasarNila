"use client";

import { useRef, useState } from "react";
import Link from "next/link";

import { ArticleMarkdown } from "@/components/content/article-markdown";
import { ResultNotice } from "@/components/panel/result-notice";
import { usePanelAction } from "@/components/panel/use-panel-action";
import { buttonClass } from "@/components/ui/button-styles";
import type { ArticleResult } from "@/lib/actions/core/article";
import { recheckArticleAction, updateArticleAction } from "@/lib/actions/article";
import { ARTICLE_BODY_MAX_CHARS, ARTICLE_TITLE_MAX_CHARS } from "@/lib/domain/limits";
import { charLength } from "@/lib/validation/text-input";

type Props = {
  slug: string;
  initialTitle: string;
  initialBody: string;
  /** `updated_at` MENTAH dari database, untuk pemeriksaan ulang hasil belum pasti. */
  initialUpdatedAt: string | null;
  /** Hanya untuk uji/pratinjau awal. */
  initialTab?: Tab;
};

type Tab = "edit" | "preview";

/**
 * Editor judul & isi artikel (PRD FR-23, FR-27, AC-37–AC-41, AC-52).
 *
 * - Satu sumber state (`title`, `body`). Kedua input SELALU ada di dalam formulir; tab Pratinjau hanya
 *   menyembunyikannya, sehingga simpan dari tab mana pun mengirim judul & isi yang sama.
 * - Ringkasan error tampil di atas tab, jadi terlihat dari tab yang sedang aktif.
 * - Tidak ada tombol tambah/hapus artikel (AC-39).
 */
export function ArticleForm({ slug, initialTitle, initialBody, initialUpdatedAt, initialTab = "edit" }: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const [title, setTitle] = useState(initialTitle);
  const [body, setBody] = useState(initialBody);
  const [baselineUpdatedAt, setBaselineUpdatedAt] = useState(initialUpdatedAt ?? "");
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);

  const action = usePanelAction<ArticleResult>({
    save: updateArticleAction,
    recheck: recheckArticleAction,
    onResult: (result) => {
      if (result.saved) setBaselineUpdatedAt(result.saved.updatedAt);
    },
  });

  const fieldErrors = action.result?.fieldErrors ?? {};
  const errorList = [fieldErrors.title, fieldErrors.body].filter((value): value is string => Boolean(value));

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (action.pending) return;
    action.submit(new FormData(event.currentTarget));
  }

  const tabClass = (tab: Tab) =>
    `min-h-11 rounded-lg px-4 py-2 text-sm font-bold transition ${
      activeTab === tab ? "bg-deep text-white" : "bg-cream text-ink-muted hover:text-ink"
    }`;

  return (
    <div className="space-y-6">
      <div aria-live="polite">
        <ResultNotice result={action.result} pending={action.pending} onRecheck={action.recheck} />
      </div>

      <div className="rounded-[1.75rem] border border-line bg-surface p-6 shadow-sm sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
          <div className="flex gap-2" role="group" aria-label="Mode tampilan editor">
            <button type="button" aria-pressed={activeTab === "edit"} onClick={() => setActiveTab("edit")} className={tabClass("edit")}>
              Sunting
            </button>
            <button
              type="button"
              aria-pressed={activeTab === "preview"}
              onClick={() => setActiveTab("preview")}
              className={tabClass("preview")}
            >
              Pratinjau
            </button>
          </div>
          <span className="text-xs text-ink-muted">Alamat tetap: /artikel/{slug}</span>
        </div>

        {errorList.length > 0 ? (
          <div role="alert" className="mt-5 rounded-2xl border border-error-ink/20 bg-error-soft p-4 text-sm text-error-ink">
            <p className="font-semibold">Perbaiki isian berikut sebelum menyimpan:</p>
            <ul className="mt-1 list-disc pl-5">
              {errorList.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
            {activeTab === "preview" ? (
              <button type="button" onClick={() => setActiveTab("edit")} className="mt-2 font-semibold underline">
                Kembali ke mode sunting
              </button>
            ) : null}
          </div>
        ) : null}

        <form ref={formRef} onSubmit={handleSubmit} noValidate className="mt-6 space-y-6">
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="baselineUpdatedAt" value={baselineUpdatedAt} />

          <div hidden={activeTab !== "edit"} className="space-y-6">
            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="title" className="block text-sm font-semibold text-ink">
                  Judul artikel <span className="text-error-ink">*</span>
                </label>
                <span className="text-xs text-ink-muted">
                  {charLength(title)} / {ARTICLE_TITLE_MAX_CHARS}
                </span>
              </div>
              <input
                id="title"
                name="title"
                type="text"
                required
                aria-invalid={fieldErrors.title ? true : undefined}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="mt-2 block w-full rounded-xl border border-line bg-surface px-4 py-3 text-base font-semibold text-ink outline-none transition focus:border-accent-strong focus:ring-2 focus:ring-accent-strong/20"
              />
              {fieldErrors.title ? (
                <p className="mt-1.5 text-sm font-semibold text-error-ink">{fieldErrors.title}</p>
              ) : null}
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="body" className="block text-sm font-semibold text-ink">
                  Isi artikel <span className="text-error-ink">*</span>
                </label>
                <span className="text-xs text-ink-muted">
                  {charLength(body).toLocaleString("id-ID")} / {ARTICLE_BODY_MAX_CHARS.toLocaleString("id-ID")}
                </span>
              </div>
              <textarea
                id="body"
                name="body"
                rows={14}
                required
                aria-invalid={fieldErrors.body ? true : undefined}
                aria-describedby="body-format"
                value={body}
                onChange={(event) => setBody(event.target.value)}
                className="mt-2 block w-full rounded-xl border border-line bg-surface p-4 font-sans text-base leading-7 text-ink outline-none transition focus:border-accent-strong focus:ring-2 focus:ring-accent-strong/20"
              />
              <p id="body-format" className="mt-1.5 text-xs leading-5 text-ink-muted">
                Format dasar: baris kosong untuk paragraf baru, <code>## Subjudul</code>, <code>**tebal**</code>,{" "}
                <code>*miring*</code>, daftar dengan <code>-</code>, dan tautan <code>[teks](https://…)</code>. HTML tidak
                dijalankan.
              </p>
              {fieldErrors.body ? (
                <p className="mt-1.5 text-sm font-semibold text-error-ink">{fieldErrors.body}</p>
              ) : null}
            </div>
          </div>

          {activeTab === "preview" ? (
            <div className="space-y-6 rounded-2xl border border-line bg-cream/40 p-6 sm:p-8">
              <span className="rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold uppercase text-accent-strong">
                Pratinjau tampilan publik
              </span>
              <h2 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">{title || "(Judul masih kosong)"}</h2>
              <div className="border-t border-line pt-6">
                {body.trim() ? <ArticleMarkdown source={body} /> : <p className="text-ink-muted">(Isi masih kosong)</p>}
              </div>
            </div>
          ) : null}

          <div className="flex flex-col gap-3 border-t border-line pt-4 sm:flex-row sm:items-center">
            <button type="submit" disabled={action.pending} className={buttonClass("primary")}>
              {action.pending ? "Menyimpan…" : "Simpan perubahan artikel"}
            </button>
            <Link href="/mitra/artikel" className={buttonClass("secondary")}>
              Kembali ke daftar
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
