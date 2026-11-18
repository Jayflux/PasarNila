import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { getSupabasePublicEnv } from "@/lib/env";

/**
 * Klien Supabase sisi server dengan dukungan cookie (ARCHITECTURE.md §7, §9.8).
 * Digunakan untuk:
 * - Server Components di route terlindungi (/mitra/*)
 * - Server Actions (login, logout, simpan stok/harga, edit artikel, nama usaha)
 */
export async function createServerSupabaseClient() {
  const cookieStore = await cookies();
  const { url, publishableKey } = getSupabasePublicEnv();

  return createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Abaikan jika dipanggil dari Server Component murni yang tidak bisa memutasi cookie
        }
      },
    },
  });
}
