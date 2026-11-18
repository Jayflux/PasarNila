/**
 * Klasifikasi hasil pemeriksaan sesi & allowlist mitra (ARCHITECTURE.md §5.2, §9.3, §9.8; PRD AC-18,
 * AC-20, AC-24). Modul murni agar dapat diuji tanpa jaringan.
 *
 * Tiga kegagalan dibedakan:
 * - `no_session`   → tidak ada sesi/sesi tidak berlaku. Halaman: arahkan ke login. Aksi: "sesi berakhir".
 * - `not_partner`  → database MENJAWAB `false`: akun login bukan mitra di allowlist.
 * - `check_failed` → pemeriksaan tidak dapat diselesaikan (jaringan, Auth/DB sementara terganggu).
 *   Operasi tetap ditolak, tetapi BUKAN bukti bahwa akun bukan mitra.
 */
import {
  isAuthApiError,
  isAuthRetryableFetchError,
  isAuthSessionMissingError,
} from "@supabase/supabase-js";

export type SessionCheck = "ok" | "no_session" | "check_failed";
export type PartnerCheck = "partner" | "not_partner" | "no_session" | "check_failed";

/** Hasil `supabase.auth.getUser()`. */
export function classifyUserLookup(result: { user: unknown; error: unknown }): SessionCheck {
  const { user, error } = result;
  if (!error) return user ? "ok" : "no_session";
  if (isAuthSessionMissingError(error)) return "no_session";
  if (isAuthRetryableFetchError(error)) return "check_failed";
  if (isAuthApiError(error)) {
    // 401/403/404: JWT tidak valid, sesi/pengguna tidak ditemukan (auth-js menangani status yang sama
    // sebagai "sudah keluar"). 5xx dan 429 adalah gangguan sementara.
    return error.status === 401 || error.status === 403 || error.status === 404 || error.status === 400
      ? "no_session"
      : "check_failed";
  }
  return "check_failed";
}

const POSTGREST_JWT_ERROR = /^PGRST3\d{2}$/;

/** Hasil `supabase.rpc("current_user_is_partner")`. */
export function classifyPartnerFlag(result: { data: unknown; error: unknown }): PartnerCheck {
  const { data, error } = result;
  if (!error) {
    if (data === true) return "partner";
    if (data === false) return "not_partner";
    return "check_failed";
  }
  const code =
    typeof error === "object" && error !== null && typeof (error as { code?: unknown }).code === "string"
      ? (error as { code: string }).code
      : "";
  if (POSTGREST_JWT_ERROR.test(code)) return "no_session";
  // Fungsi ditolak untuk role ini (mis. anon) berarti sesi tidak membawa JWT pengguna.
  if (code === "42501") return "no_session";
  return "check_failed";
}

// ---------------------------------------------------------------------------------------------
// Login
// ---------------------------------------------------------------------------------------------

export type SignInFailure = "invalid_credentials" | "rate_limited" | "unavailable";

export const SIGN_IN_MESSAGES: Readonly<Record<SignInFailure | "not_partner" | "check_failed" | "missing", string>> = {
  // PRD AC-18: pesan sama untuk password salah dan email tidak terdaftar.
  invalid_credentials: "Email atau password salah",
  rate_limited: "Terlalu banyak percobaan masuk. Tunggu beberapa saat, lalu coba lagi.",
  unavailable:
    "Layanan login sedang tidak dapat dihubungi. Periksa koneksi Anda, lalu coba lagi. Ini bukan berarti password Anda salah.",
  // PRD AC-20.
  not_partner: "Akun ini tidak memiliki akses ke panel",
  check_failed:
    "Login berhasil, tetapi pemeriksaan hak akses mitra sedang terganggu. Silakan coba masuk lagi beberapa saat lagi.",
  missing: "Email dan password wajib diisi",
};

/** Hasil error `supabase.auth.signInWithPassword()`. */
export function classifySignInError(error: unknown): SignInFailure {
  if (isAuthRetryableFetchError(error)) return "unavailable";
  if (isAuthApiError(error)) {
    if (error.status === 429 || error.code === "over_request_rate_limit") return "rate_limited";
    if (error.status >= 500) return "unavailable";
    // 400/401/403/422: kredensial ditolak. Kode rinci (mis. email belum dikonfirmasi) sengaja tidak
    // dibedakan agar tidak membocorkan keberadaan akun.
    return "invalid_credentials";
  }
  return "unavailable";
}
