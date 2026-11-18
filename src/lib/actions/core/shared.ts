/**
 * Utilitas bersama inti Server Action panel (tanpa kode framework, agar dapat diuji).
 */
import { z } from "zod";

import type { ActionResult } from "@/lib/write/action-result";
import { isRawTimestamp } from "@/lib/write/outcome";

/** Gerbang akses mitra yang disuntikkan ke inti action (implementasi nyata: `gatePartnerAction`). */
export type Gate<TDb> = () => Promise<
  { ok: true; db: TDb } | { ok: false; result: ActionResult<never, never> }
>;

/** Jeda sebelum membaca ulang hasil yang belum pasti (ARCHITECTURE §10.4: ± 1 detik). */
export const RECHECK_DELAY_MS = 1_000;

export function formText(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

/** Baseline waktu dari formulir: hanya timestamp mentah yang diterima; selain itu dianggap tidak ada. */
export function formTimestamp(formData: FormData, name: string): string | null {
  const value = formText(formData, name).trim();
  return isRawTimestamp(value) ? value : null;
}

const uuidSchema = z.string().uuid();

export function formUuid(formData: FormData, name: string): string | null {
  const parsed = uuidSchema.safeParse(formText(formData, name).trim());
  return parsed.success ? parsed.data.toLowerCase() : null;
}

/** PostgREST mengirim `numeric` sebagai angka JSON; string angka diterima sebagai cadangan. */
export const numericColumn = z.union([
  z.number().finite(),
  z
    .string()
    .regex(/^\d+(\.\d+)?$/)
    .transform(Number),
]);

/** Menjalankan efek samping setelah simpan (revalidasi). Kegagalannya tidak mengubah status simpan. */
export function runSideEffect(effect: (() => void) | undefined): boolean {
  if (!effect) return true;
  try {
    effect();
    return true;
  } catch {
    return false;
  }
}

/** Nilai kg dalam perseratus kg (bilangan bulat), untuk membandingkan tanpa galat biner. */
export function kgToCenti(kg: number): number {
  return Math.round(kg * 100);
}
