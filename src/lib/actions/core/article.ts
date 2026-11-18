/**
 * Inti Server Action edit artikel (ARCHITECTURE.md §5.4, §10.3–§10.4; PRD AC-37–AC-41, AC-52).
 *
 * Hanya judul & isi yang dikirim (column grant di database juga hanya mengizinkan dua kolom itu).
 * Tidak ada jalur tambah/hapus artikel (AC-39).
 */
import { z } from "zod";

import { formText, formTimestamp, RECHECK_DELAY_MS, runSideEffect, type Gate } from "@/lib/actions/core/shared";
import { formatWib } from "@/lib/format/datetime";
import { validateArticleInput } from "@/lib/validation/text-input";
import { MESSAGES, type ActionResult } from "@/lib/write/action-result";
import { certainFailureResult } from "@/lib/write/map-failure";
import { classifyWriteError, judgeRecheck, type DbResponse } from "@/lib/write/outcome";

export type ArticleField = "title" | "body";
export type ArticleSaved = { slug: string; title: string; body: string; updatedAt: string; updatedAtLabel: string };
export type ArticleResult = ActionResult<ArticleSaved, ArticleField>;

export interface ArticleDb {
  /** UPDATE judul & isi, mengembalikan baris yang berubah (array). */
  update(input: { slug: string; title: string; body: string }): Promise<DbResponse>;
  read(slug: string): Promise<DbResponse>;
}

export type ArticleDeps = {
  gate: Gate<ArticleDb>;
  wait(ms: number): Promise<void>;
  afterSave?: (slug: string) => void;
};

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const articleRow = z.object({
  slug: z.string(),
  title: z.string(),
  body: z.string(),
  updated_at: z.string(),
});

function toSaved(row: z.infer<typeof articleRow>): ArticleSaved | null {
  try {
    return { ...row, updatedAt: row.updated_at, updatedAtLabel: formatWib(row.updated_at) };
  } catch {
    return null;
  }
}

type Parsed =
  | { ok: true; slug: string; title: string; body: string; baselineUpdatedAt: string | null }
  | { ok: false; result: ArticleResult };

function parse(formData: FormData): Parsed {
  const slug = formText(formData, "slug").trim();
  if (!SLUG.test(slug)) {
    return { ok: false, result: { state: "invalid", message: "Alamat artikel tidak valid. Muat ulang halaman. Data tidak berubah." } };
  }
  const input = validateArticleInput(formText(formData, "title"), formText(formData, "body"));
  if (!input.ok) {
    return { ok: false, result: { state: "invalid", message: MESSAGES.invalid, fieldErrors: input.fieldErrors } };
  }
  return { ok: true, slug, title: input.title, body: input.body, baselineUpdatedAt: formTimestamp(formData, "baselineUpdatedAt") };
}

async function verify(db: ArticleDb, submission: Extract<Parsed, { ok: true }>): Promise<ArticleResult> {
  const read = await db.read(submission.slug);
  const parsed = read.error ? null : articleRow.nullable().safeParse(read.data);
  if (!parsed || !parsed.success) {
    return { state: "uncertain", message: MESSAGES.uncertain, detail: MESSAGES.uncertainReadFailed, canRecheck: true };
  }
  if (parsed.data === null) {
    return { state: "not_found", message: MESSAGES.notFound };
  }
  const saved = toSaved(parsed.data);
  const verdict = judgeRecheck({
    baselineAt: submission.baselineUpdatedAt,
    currentAt: parsed.data.updated_at,
    matchesSubmission: parsed.data.title === submission.title && parsed.data.body === submission.body,
  });
  if (verdict === "matches_submission" && saved) {
    return {
      state: "verified",
      message: "Status penyimpanan sempat belum pasti. Saat diperiksa ulang, artikel tersimpan sudah sesuai isian Anda.",
      detail: `Terakhir diubah: ${saved.updatedAtLabel}.`,
      saved,
    };
  }
  if (verdict === "changed_elsewhere" && saved) {
    return {
      state: "changed_elsewhere",
      message: MESSAGES.changedElsewhere,
      detail: `Judul tersimpan: “${saved.title}” (diubah ${saved.updatedAtLabel}).`,
      saved,
    };
  }
  return { state: "uncertain", message: MESSAGES.uncertain, detail: MESSAGES.uncertainNotYetVisible, canRecheck: true };
}

export async function saveArticle(formData: FormData, deps: ArticleDeps): Promise<ArticleResult> {
  const submission = parse(formData);
  if (!submission.ok) return submission.result;

  const gate = await deps.gate();
  if (!gate.ok) return gate.result;

  const response = await gate.db.update({ slug: submission.slug, title: submission.title, body: submission.body });
  if (response.error) {
    const failure = classifyWriteError(response.error, response.status);
    if (failure.kind !== "uncertain") {
      return certainFailureResult<ArticleSaved, ArticleField>(failure, {
        fieldForKey: () => null,
        notFoundMessage: "Artikel tidak ditemukan atau Anda tidak memiliki akses. Artikel tidak berubah.",
      });
    }
    await deps.wait(RECHECK_DELAY_MS);
    return verify(gate.db, submission);
  }

  const rows = z.array(articleRow).safeParse(response.data);
  if (!rows.success) {
    await deps.wait(RECHECK_DELAY_MS);
    return verify(gate.db, submission);
  }
  // UPDATE yang ditolak RLS tidak menghasilkan error, melainkan 0 baris: gagal yang PASTI (§5.4).
  const row = rows.data[0];
  if (!row) {
    return {
      state: "not_found",
      message: "Artikel tidak ditemukan atau Anda tidak memiliki akses. Artikel tidak berubah.",
    };
  }
  const saved = toSaved(row);
  if (!saved) {
    await deps.wait(RECHECK_DELAY_MS);
    return verify(gate.db, submission);
  }
  runSideEffect(deps.afterSave ? () => deps.afterSave?.(submission.slug) : undefined);
  return {
    state: "saved",
    message: `Artikel tersimpan: “${saved.title}”. Halaman publik menampilkan perubahan setelah dimuat ulang.`,
    detail: `Terakhir diubah: ${saved.updatedAtLabel}.`,
    saved,
  };
}

export async function recheckArticle(formData: FormData, deps: ArticleDeps): Promise<ArticleResult> {
  const submission = parse(formData);
  if (!submission.ok) return submission.result;
  const gate = await deps.gate();
  if (!gate.ok) return gate.result;
  const result = await verify(gate.db, submission);
  if (result.state === "verified" || result.state === "changed_elsewhere") {
    runSideEffect(deps.afterSave ? () => deps.afterSave?.(submission.slug) : undefined);
  }
  return result;
}
