import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { getSupabasePublicEnv } from "@/lib/env";
import type { Database } from "@/types/database";

/**
 * Klien Supabase untuk BACA PUBLIK (ARCHITECTURE.md §7, §12.2).
 *
 * - Memakai publishable key tanpa cookie/sesi: query berjalan sebagai role `anon`, dibatasi RLS
 *   (hanya baris terbit). Data sesi tidak pernah ikut ter-render atau masuk cache.
 * - Hanya di server (`server-only`). Secret/service-role key tidak dipakai aplikasi (§9.7).
 * - Konfigurasi tidak lengkap melempar `EnvValidationError` yang hanya menyebut NAMA variabel.
 */

/** Batas waktu satu query baca publik. Lewat dari ini dianggap gagal dimuat (PRD AC-12). */
export const PUBLIC_READ_TIMEOUT_MS = 8_000;

export type AppSupabaseClient = SupabaseClient<Database>;
let publicClient: AppSupabaseClient | null = null;

export function getPublicSupabaseClient(): AppSupabaseClient {
  if (publicClient === null) {
    const { url, publishableKey } = getSupabasePublicEnv();
    publicClient = createClient<Database>(url, publishableKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  }
  return publicClient;
}

/** Sinyal batas waktu baru untuk setiap query. */
export function publicReadSignal(): AbortSignal {
  return AbortSignal.timeout(PUBLIC_READ_TIMEOUT_MS);
}
