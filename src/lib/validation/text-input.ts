/**
 * Validasi teks panel: nama usaha (PRD BR-P3), judul & isi artikel (BR-A6), nama paket (§12.8).
 *
 * Panjang dihitung dalam karakter Unicode (code point), sama seperti `char_length` di Postgres, supaya
 * batas di browser, server, dan constraint database selaras (mis. emoji dihitung satu karakter).
 */
import {
  ARTICLE_BODY_MAX_CHARS,
  ARTICLE_TITLE_MAX_CHARS,
  BUSINESS_NAME_MAX_CHARS,
  BUSINESS_NAME_MIN_CHARS,
  PACKAGE_NAME_MAX_CHARS,
} from "@/lib/domain/limits";

export function charLength(value: string): number {
  return Array.from(value).length;
}

const LINE_BREAK = /[\r\n]/;

type TextResult = { ok: true; value: string } | { ok: false; message: string };

/** Satu baris: tolak baris baru, buang spasi di tepi, rapikan spasi ganda menjadi satu. */
function singleLine(raw: string): { ok: true; value: string } | { ok: false } {
  if (LINE_BREAK.test(raw)) return { ok: false };
  return { ok: true, value: raw.replace(/\s+/g, " ").trim() };
}

export const BUSINESS_NAME_MESSAGES = {
  length: `Nama usaha harus terdiri dari ${BUSINESS_NAME_MIN_CHARS} hingga ${BUSINESS_NAME_MAX_CHARS} karakter.`,
  lineBreak: "Nama usaha tidak boleh memuat baris baru.",
} as const;

export function validateBusinessName(raw: string | null | undefined): TextResult {
  const line = singleLine(raw ?? "");
  if (!line.ok) return { ok: false, message: BUSINESS_NAME_MESSAGES.lineBreak };
  const length = charLength(line.value);
  if (length < BUSINESS_NAME_MIN_CHARS || length > BUSINESS_NAME_MAX_CHARS) {
    return { ok: false, message: BUSINESS_NAME_MESSAGES.length };
  }
  return { ok: true, value: line.value };
}

export const PACKAGE_NAME_MESSAGES = {
  empty: "Nama paket wajib diisi.",
  length: `Nama paket maksimal ${PACKAGE_NAME_MAX_CHARS} karakter.`,
  lineBreak: "Nama paket tidak boleh memuat baris baru.",
} as const;

export function validatePackageName(raw: string | null | undefined): TextResult {
  const line = singleLine(raw ?? "");
  if (!line.ok) return { ok: false, message: PACKAGE_NAME_MESSAGES.lineBreak };
  const length = charLength(line.value);
  if (length === 0) return { ok: false, message: PACKAGE_NAME_MESSAGES.empty };
  if (length > PACKAGE_NAME_MAX_CHARS) return { ok: false, message: PACKAGE_NAME_MESSAGES.length };
  return { ok: true, value: line.value };
}

export const ARTICLE_MESSAGES = {
  title: `Judul artikel wajib diisi (1 - ${ARTICLE_TITLE_MAX_CHARS} karakter).`,
  body: `Isi artikel wajib diisi (1 - ${ARTICLE_BODY_MAX_CHARS.toLocaleString("id-ID")} karakter).`,
} as const;

export type ArticleInputResult =
  | { ok: true; title: string; body: string }
  | { ok: false; fieldErrors: { title?: string; body?: string } };

/** Judul & isi di-trim (ARCHITECTURE §10.2). Isi disimpan apa adanya selain trim di tepi. */
export function validateArticleInput(
  rawTitle: string | null | undefined,
  rawBody: string | null | undefined,
): ArticleInputResult {
  const title = (rawTitle ?? "").trim();
  const body = (rawBody ?? "").trim();
  const fieldErrors: { title?: string; body?: string } = {};
  const titleLength = charLength(title);
  const bodyLength = charLength(body);
  if (titleLength < 1 || titleLength > ARTICLE_TITLE_MAX_CHARS) fieldErrors.title = ARTICLE_MESSAGES.title;
  if (bodyLength < 1 || bodyLength > ARTICLE_BODY_MAX_CHARS) fieldErrors.body = ARTICLE_MESSAGES.body;
  if (fieldErrors.title || fieldErrors.body) return { ok: false, fieldErrors };
  return { ok: true, title, body };
}
