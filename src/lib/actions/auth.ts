"use server";

import { redirect } from "next/navigation";

import {
  classifyPartnerFlag,
  classifySignInError,
  SIGN_IN_MESSAGES,
} from "@/lib/auth/access-classify";
import { logReadError } from "@/lib/data/log";
import { createServerSupabaseClient } from "@/lib/supabase/server-client";

export type AuthActionResult = {
  error?: string;
  /** Email dikembalikan agar kolom email tidak kosong lagi setelah gagal (password tidak). */
  email?: string;
};

/**
 * Login mitra (PRD FR-15, AC-17, AC-18, AC-20; ARCHITECTURE.md §5.2).
 *
 * - Kredensial ditolak → "Email atau password salah" (sama untuk email tidak terdaftar).
 * - Gangguan jaringan/layanan → pesan gangguan, BUKAN "password salah".
 * - Login berhasil tetapi bukan mitra → sesi diakhiri + "Akun ini tidak memiliki akses ke panel".
 * - Pemeriksaan allowlist gagal sementara → sesi diakhiri + pesan gangguan (bukan "tidak punya akses").
 * - Tujuan setelah login selalu `/mitra` (tidak ada parameter tujuan, jadi tidak ada open redirect).
 */
export async function signInAction(
  _prevState: AuthActionResult | null,
  formData: FormData,
): Promise<AuthActionResult> {
  const rawEmail = formData.get("email");
  const rawPassword = formData.get("password");
  const email = typeof rawEmail === "string" ? rawEmail.trim() : "";
  const password = typeof rawPassword === "string" ? rawPassword : "";

  if (!email || !password) {
    return { error: SIGN_IN_MESSAGES.missing, email };
  }

  let supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>;
  try {
    supabase = await createServerSupabaseClient();
  } catch (error) {
    logReadError("auth_client", error);
    return { error: SIGN_IN_MESSAGES.unavailable, email };
  }

  try {
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      const failure = classifySignInError(signInError);
      if (failure !== "invalid_credentials") logReadError("auth_sign_in", signInError);
      return { error: SIGN_IN_MESSAGES[failure], email };
    }
  } catch (error) {
    logReadError("auth_sign_in", error);
    return { error: SIGN_IN_MESSAGES.unavailable, email };
  }

  let flag: ReturnType<typeof classifyPartnerFlag>;
  try {
    const result = await supabase.rpc("current_user_is_partner");
    flag = classifyPartnerFlag({ data: result.data, error: result.error });
    if (flag === "check_failed" || flag === "no_session") logReadError("auth_partner_flag", result.error);
  } catch (error) {
    logReadError("auth_partner_flag", error);
    flag = "check_failed";
  }

  if (flag !== "partner") {
    // Akhiri sesi di perangkat ini. `scope: "local"` menghapus cookie sesi tanpa bergantung jaringan.
    await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
    return {
      error: flag === "not_partner" ? SIGN_IN_MESSAGES.not_partner : SIGN_IN_MESSAGES.check_failed,
      email,
    };
  }

  redirect("/mitra");
}

/**
 * Logout mitra (PRD FR-26, AC-23). POST dari tombol, bukan tautan GET.
 * Mencabut sesi di server (`global`); bila jaringan gagal, sesi di perangkat ini tetap dihapus.
 */
export async function signOutAction(): Promise<void> {
  try {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.signOut();
    if (error) {
      logReadError("auth_sign_out", error);
      await supabase.auth.signOut({ scope: "local" });
    }
  } catch (error) {
    logReadError("auth_sign_out", error);
  }
  redirect("/mitra/login");
}
