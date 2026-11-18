/** Alat bantu uji inti Server Action: gerbang & respons database tiruan (tanpa jaringan). */
import type { Gate } from "@/lib/actions/core/shared";
import { MESSAGES } from "@/lib/write/action-result";
import type { DbResponse } from "@/lib/write/outcome";

export function form(values: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

export function ok(data: unknown, status = 200): DbResponse {
  return { data, error: null, status };
}

export function fail(error: unknown, status: number | null = null): DbResponse {
  return { data: null, error, status };
}

/** Error berbentuk objek seperti yang dikembalikan postgrest-js saat koneksi putus. */
export const NETWORK_ERROR = { message: "TypeError: fetch failed", details: "", hint: "", code: "" };

export function partnerGate<TDb>(db: TDb): Gate<TDb> {
  return async () => ({ ok: true, db });
}

export function failingGate<TDb>(state: "session_expired" | "forbidden" | "access_check_failed"): Gate<TDb> {
  const message =
    state === "session_expired"
      ? MESSAGES.sessionExpired
      : state === "forbidden"
        ? MESSAGES.forbidden
        : MESSAGES.accessCheckFailed;
  return async () => ({ ok: false, result: { state, message } });
}

export const noWait = async () => {};
