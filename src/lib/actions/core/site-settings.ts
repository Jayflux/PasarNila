/**
 * Inti Server Action nama usaha (ARCHITECTURE.md §5.6, §10.4, §12.5; PRD AC-45–AC-50, AC-52).
 *
 * - Hanya kolom `business_name` yang dikirim.
 * - Cache nama (`site-settings`) dibersihkan setelah simpan berhasil, setelah hasil terverifikasi, dan
 *   SETIAP pemeriksaan ulang (membersihkan cache tidak berbahaya; melewatkannya setelah commit yang tidak
 *   terlaporkan membuat nama lama tetap tampil).
 * - Bila simpan berhasil tetapi pembersihan cache gagal, status tetap "tersimpan" disertai peringatan.
 */
import { z } from "zod";

import { formText, formTimestamp, RECHECK_DELAY_MS, runSideEffect, type Gate } from "@/lib/actions/core/shared";
import { formatWib } from "@/lib/format/datetime";
import { validateBusinessName } from "@/lib/validation/text-input";
import { MESSAGES, type ActionResult } from "@/lib/write/action-result";
import { certainFailureResult } from "@/lib/write/map-failure";
import { classifyWriteError, judgeRecheck, type DbResponse } from "@/lib/write/outcome";

export type BusinessNameField = "businessName";
export type BusinessNameSaved = { name: string; updatedAt: string; updatedAtLabel: string };
export type BusinessNameResult = ActionResult<BusinessNameSaved, BusinessNameField>;

export interface BusinessNameDb {
  update(name: string): Promise<DbResponse>;
  read(): Promise<DbResponse>;
}

export type BusinessNameDeps = {
  gate: Gate<BusinessNameDb>;
  wait(ms: number): Promise<void>;
  /** `updateTag('site-settings')` + revalidasi layout. Boleh melempar. */
  invalidate: () => void;
};

export const CACHE_REFRESH_WARNING =
  "Nama sudah tersimpan, tetapi penyegaran tampilan publik gagal. Halaman publik bisa masih menampilkan nama lama hingga sekitar 1 jam. Tekan “Segarkan tampilan publik” untuk mencoba lagi.";

const settingsRow = z.object({ business_name: z.string(), updated_at: z.string() });

function toSaved(row: z.infer<typeof settingsRow>): BusinessNameSaved | null {
  try {
    return { name: row.business_name, updatedAt: row.updated_at, updatedAtLabel: formatWib(row.updated_at) };
  } catch {
    return null;
  }
}

type Parsed =
  | { ok: true; name: string; baselineUpdatedAt: string | null }
  | { ok: false; result: BusinessNameResult };

function parse(formData: FormData): Parsed {
  const name = validateBusinessName(formText(formData, "businessName"));
  if (!name.ok) {
    return {
      ok: false,
      result: { state: "invalid", message: MESSAGES.invalid, fieldErrors: { businessName: name.message } },
    };
  }
  return { ok: true, name: name.value, baselineUpdatedAt: formTimestamp(formData, "baselineUpdatedAt") };
}

function withCacheRefresh(result: BusinessNameResult, deps: BusinessNameDeps): BusinessNameResult {
  return runSideEffect(deps.invalidate) ? result : { ...result, warning: CACHE_REFRESH_WARNING };
}

async function verify(db: BusinessNameDb, submission: Extract<Parsed, { ok: true }>, deps: BusinessNameDeps): Promise<BusinessNameResult> {
  // Pemeriksaan ulang SELALU membersihkan cache nama (§10.4 butir 6), apa pun hasilnya.
  const cacheRefreshed = runSideEffect(deps.invalidate);
  const read = await db.read();
  const parsed = read.error ? null : settingsRow.nullable().safeParse(read.data);
  if (!parsed || !parsed.success || parsed.data === null) {
    return { state: "uncertain", message: MESSAGES.uncertain, detail: MESSAGES.uncertainReadFailed, canRecheck: true };
  }
  const saved = toSaved(parsed.data);
  const verdict = judgeRecheck({
    baselineAt: submission.baselineUpdatedAt,
    currentAt: parsed.data.updated_at,
    matchesSubmission: parsed.data.business_name === submission.name,
  });
  const warning = cacheRefreshed ? undefined : CACHE_REFRESH_WARNING;
  if (verdict === "matches_submission" && saved) {
    return {
      state: "verified",
      message: `Status penyimpanan sempat belum pasti. Saat diperiksa ulang, nama usaha tersimpan sudah sesuai isian Anda: “${saved.name}”.`,
      saved,
      warning,
    };
  }
  if (verdict === "changed_elsewhere" && saved) {
    return { state: "changed_elsewhere", message: MESSAGES.changedElsewhere, detail: `Nama tersimpan: “${saved.name}”.`, saved, warning };
  }
  return { state: "uncertain", message: MESSAGES.uncertain, detail: MESSAGES.uncertainNotYetVisible, canRecheck: true, warning };
}

export async function saveBusinessName(formData: FormData, deps: BusinessNameDeps): Promise<BusinessNameResult> {
  const submission = parse(formData);
  if (!submission.ok) return submission.result;

  const gate = await deps.gate();
  if (!gate.ok) return gate.result;

  const response = await gate.db.update(submission.name);
  if (response.error) {
    const failure = classifyWriteError(response.error, response.status);
    if (failure.kind !== "uncertain") {
      return certainFailureResult<BusinessNameSaved, BusinessNameField>(failure, {
        fieldForKey: (key) =>
          key === null ? null : { field: "businessName", message: "Nama usaha ditolak database. Periksa panjang dan isinya." },
        notFoundMessage: "Pengaturan usaha tidak ditemukan atau Anda tidak memiliki akses. Nama tidak berubah.",
      });
    }
    await deps.wait(RECHECK_DELAY_MS);
    return verify(gate.db, submission, deps);
  }

  const rows = z.array(settingsRow).safeParse(response.data);
  if (!rows.success) {
    await deps.wait(RECHECK_DELAY_MS);
    return verify(gate.db, submission, deps);
  }
  const row = rows.data[0];
  if (!row) {
    // 0 baris = ditolak RLS atau baris tidak ada: gagal yang PASTI (§5.6).
    return { state: "not_found", message: "Pengaturan usaha tidak ditemukan atau Anda tidak memiliki akses. Nama tidak berubah." };
  }
  const saved = toSaved(row);
  if (!saved) {
    await deps.wait(RECHECK_DELAY_MS);
    return verify(gate.db, submission, deps);
  }
  return withCacheRefresh({ state: "saved", message: `Nama usaha disimpan: “${saved.name}”.`, saved }, deps);
}

export async function recheckBusinessName(formData: FormData, deps: BusinessNameDeps): Promise<BusinessNameResult> {
  const submission = parse(formData);
  if (!submission.ok) return submission.result;
  const gate = await deps.gate();
  if (!gate.ok) return gate.result;
  return verify(gate.db, submission, deps);
}

/** Tombol "Segarkan tampilan publik" setelah peringatan cache. */
export async function refreshBusinessNameCache(deps: Pick<BusinessNameDeps, "gate" | "invalidate">): Promise<ActionResult> {
  const gate = await deps.gate();
  if (!gate.ok) return gate.result;
  return runSideEffect(deps.invalidate)
    ? { state: "saved", message: "Tampilan publik disegarkan. Muat ulang halaman publik untuk melihat nama terbaru." }
    : { state: "uncertain", message: "Penyegaran tampilan publik masih gagal. Coba lagi beberapa saat lagi.", canRecheck: false };
}
