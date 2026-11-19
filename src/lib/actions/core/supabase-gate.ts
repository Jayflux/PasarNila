import "server-only";

import type { AppSupabaseClient } from "@/lib/supabase/public-client";

import type { Gate } from "@/lib/actions/core/shared";
import { gatePartnerAction } from "@/lib/auth/require-partner";

/** Batas waktu satu operasi tulis. Lewat dari ini hasilnya BELUM PASTI (dibaca ulang). */
export const WRITE_TIMEOUT_MS = 15_000;
/** Batas waktu pembacaan ulang/verifikasi. */
export const VERIFY_READ_TIMEOUT_MS = 8_000;

export function writeSignal(): AbortSignal {
  return AbortSignal.timeout(WRITE_TIMEOUT_MS);
}

export function verifyReadSignal(): AbortSignal {
  return AbortSignal.timeout(VERIFY_READ_TIMEOUT_MS);
}

/** Gerbang mitra untuk Server Action, lalu membangun akses database ber-JWT mitra. */
export function supabaseGate<TDb>(build: (supabase: AppSupabaseClient) => TDb): Gate<TDb> {
  return async () => {
    const gate = await gatePartnerAction();
    return gate.ok ? { ok: true, db: build(gate.supabase) } : gate;
  };
}

export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
