"use server";

import { redirect } from "next/navigation";

import { createServerSupabaseClient } from "@/lib/supabase/server-client";

export type AuthActionResult = {
  error?: string;
};

/**
 * Server Action untuk login mitra (PRD FR-15, AC-17, AC-18, AC-20).
 */
export async function signInAction(
  _prevState: AuthActionResult | null,
  formData: FormData,
): Promise<AuthActionResult> {
  const email = (formData.get("email") as string | null)?.trim() ?? "";
  const password = (formData.get("password") as string | null) ?? "";

  if (!email || !password) {
    return { error: "Email dan password wajib diisi" };
  }

  const supabase = await createServerSupabaseClient();

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (signInError) {
    // PRD AC-18: pesan umum yang sama untuk password salah atau email tidak terdaftar
    return { error: "Email atau password salah" };
  }

  // Verifikasi apakah akun ada di allowlist partner_admins (PRD AC-20)
  const { data: isPartner } = await supabase.rpc("current_user_is_partner");

  if (isPartner !== true) {
    // Segera akhiri sesi jika bukan mitra
    await supabase.auth.signOut();
    return { error: "Akun ini tidak memiliki akses ke panel" };
  }

  redirect("/mitra");
}

/**
 * Server Action untuk logout mitra (PRD FR-26, AC-23).
 */
export async function signOutAction(): Promise<void> {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  redirect("/mitra/login");
}
