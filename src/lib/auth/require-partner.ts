import "server-only";

import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";

import { createServerSupabaseClient } from "@/lib/supabase/server-client";

export type PartnerSession = {
  user: User;
  email: string;
};

/**
 * Memeriksa status login dan hak akses mitra (ARCHITECTURE.md §7, §9.3; PRD FR-15, FR-16, AC-19–AC-21).
 * 1. Jika belum login → redirect ke /mitra/login
 * 2. Jika login tetapi bukan partner_admin → redirect ke /mitra/akses-ditolak
 * 3. Jika terverifikasi → mengembalikan data sesi mitra
 */
export async function requirePartner(): Promise<PartnerSession> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user || !user.email) {
    redirect("/mitra/login");
  }

  const { data: isPartner, error: rpcError } = await supabase.rpc(
    "current_user_is_partner",
  );

  if (rpcError || isPartner !== true) {
    redirect("/mitra/akses-ditolak");
  }

  return {
    user,
    email: user.email,
  };
}

/**
 * Memeriksa apakah sesi aktif adalah mitra yang terdaftar (tanpa redirect).
 * Dipakai oleh halaman login untuk auto-redirect ke /mitra jika sudah login.
 */
export async function getPartnerOrNull(): Promise<PartnerSession | null> {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user || !user.email) return null;

    const { data: isPartner } = await supabase.rpc("current_user_is_partner");
    if (isPartner !== true) return null;

    return { user, email: user.email };
  } catch {
    return null;
  }
}
