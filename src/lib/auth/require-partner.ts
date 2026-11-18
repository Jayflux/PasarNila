import "server-only";

import { redirect } from "next/navigation";
import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

import { classifyPartnerFlag, classifyUserLookup } from "@/lib/auth/access-classify";
import { logReadError } from "@/lib/data/log";
import { createServerSupabaseClient } from "@/lib/supabase/server-client";
import { MESSAGES, type ActionResult } from "@/lib/write/action-result";

/**
 * Pemeriksaan sesi + allowlist mitra (ARCHITECTURE.md §5.2, §9.3, §9.8; PRD AC-17–AC-24).
 *
 * Mekanisme sesi: `supabase.auth.getUser()`, BUKAN `getSession()`. `getUser()` memvalidasi access token
 * ke server Supabase Auth, sehingga pengguna yang dihapus/diblokir atau sesi yang sudah dicabut
 * terdeteksi. Konsekuensinya satu panggilan jaringan per pemeriksaan. `getClaims()` (verifikasi tanda
 * tangan lokal) tidak dipakai karena tidak mendeteksi sesi yang dicabut sebelum token kedaluwarsa;
 * keduanya bukan pengganti RLS, yang tetap memeriksa allowlist di setiap query (§9.2).
 *
 * Status mitra selalu dari database (`current_user_is_partner`); login berhasil saja tidak cukup.
 */

export type PartnerAccess =
  | { status: "partner"; supabase: SupabaseClient; userId: string; email: string | null }
  | { status: "no_session" }
  | { status: "not_partner" }
  | { status: "check_failed" };

async function checkPartnerAccessUncached(): Promise<PartnerAccess> {
  let supabase: SupabaseClient;
  try {
    supabase = await createServerSupabaseClient();
  } catch (error) {
    logReadError("auth_client", error);
    return { status: "check_failed" };
  }

  let user: { id: string; email?: string | null } | null = null;
  try {
    const result = await supabase.auth.getUser();
    const session = classifyUserLookup({ user: result.data.user, error: result.error });
    if (session === "no_session") return { status: "no_session" };
    if (session === "check_failed") {
      logReadError("auth_user", result.error);
      return { status: "check_failed" };
    }
    user = result.data.user;
  } catch (error) {
    logReadError("auth_user", error);
    return { status: "check_failed" };
  }
  if (!user) return { status: "no_session" };

  try {
    const result = await supabase.rpc("current_user_is_partner");
    const flag = classifyPartnerFlag({ data: result.data, error: result.error });
    if (flag === "partner") {
      return { status: "partner", supabase, userId: user.id, email: user.email ?? null };
    }
    if (flag === "check_failed") logReadError("auth_partner_flag", result.error);
    return { status: flag };
  } catch (error) {
    logReadError("auth_partner_flag", error);
    return { status: "check_failed" };
  }
}

/** Satu pemeriksaan per render (layout + halaman memakai hasil yang sama). */
export const getPartnerAccess = cache(checkPartnerAccessUncached);

export type PartnerPageAccess =
  | Extract<PartnerAccess, { status: "partner" }>
  | { status: "check_failed" };

/**
 * Untuk layout/halaman panel. Tanpa sesi → /mitra/login; bukan mitra → /mitra/akses-ditolak.
 * Pemeriksaan gagal sementara TIDAK dialihkan ke "akses ditolak"; pemanggil menampilkan pesan gangguan
 * dan tidak merender data panel.
 */
export async function requirePartnerPage(): Promise<PartnerPageAccess> {
  const access = await getPartnerAccess();
  if (access.status === "no_session") redirect("/mitra/login");
  if (access.status === "not_partner") redirect("/mitra/akses-ditolak");
  return access;
}

export type ActionGate =
  | { ok: true; supabase: SupabaseClient }
  | { ok: false; result: ActionResult<never, never> };

/**
 * Untuk Server Action. Setiap action memanggil ini sendiri (Server Action = endpoint POST publik,
 * §9.8). Tidak pernah redirect: hasilnya dikembalikan agar isian formulir tetap ada (AC-24).
 */
export async function gatePartnerAction(): Promise<ActionGate> {
  const access = await checkPartnerAccessUncached();
  switch (access.status) {
    case "partner":
      return { ok: true, supabase: access.supabase };
    case "no_session":
      return { ok: false, result: { state: "session_expired", message: MESSAGES.sessionExpired } };
    case "not_partner":
      return { ok: false, result: { state: "forbidden", message: MESSAGES.forbidden } };
    case "check_failed":
      return {
        ok: false,
        result: { state: "access_check_failed", message: MESSAGES.accessCheckFailed },
      };
  }
}
