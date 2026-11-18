/**
 * Sesi, allowlist, dan login (PRD AC-18, AC-20, AC-24; ARCHITECTURE.md §5.2, §10.3).
 * Memakai kelas error asli dari @supabase/supabase-js terpasang.
 */
import {
  AuthApiError,
  AuthRetryableFetchError,
  AuthSessionMissingError,
} from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import {
  classifyPartnerFlag,
  classifySignInError,
  classifyUserLookup,
  SIGN_IN_MESSAGES,
} from "@/lib/auth/access-classify";

describe("pemeriksaan sesi (getUser)", () => {
  it("pengguna ada tanpa error → ok", () => {
    expect(classifyUserLookup({ user: { id: "u" }, error: null })).toBe("ok");
  });

  it("tidak ada sesi → no_session", () => {
    expect(classifyUserLookup({ user: null, error: new AuthSessionMissingError() })).toBe("no_session");
    expect(classifyUserLookup({ user: null, error: null })).toBe("no_session");
  });

  it("token ditolak Auth (401/403) → no_session", () => {
    expect(classifyUserLookup({ user: null, error: new AuthApiError("bad_jwt", 403, "bad_jwt") })).toBe("no_session");
    expect(classifyUserLookup({ user: null, error: new AuthApiError("invalid", 401, undefined) })).toBe("no_session");
  });

  it("jaringan/Auth terganggu → check_failed (bukan 'tidak login')", () => {
    expect(classifyUserLookup({ user: null, error: new AuthRetryableFetchError("fetch failed", 0) })).toBe("check_failed");
    expect(classifyUserLookup({ user: null, error: new AuthApiError("server", 500, undefined) })).toBe("check_failed");
    expect(classifyUserLookup({ user: null, error: new AuthApiError("rate", 429, "over_request_rate_limit") })).toBe(
      "check_failed",
    );
  });
});

describe("status mitra (current_user_is_partner)", () => {
  it("true → partner; false → not_partner", () => {
    expect(classifyPartnerFlag({ data: true, error: null })).toBe("partner");
    expect(classifyPartnerFlag({ data: false, error: null })).toBe("not_partner");
  });

  it("RPC gagal sementara → check_failed, BUKAN bukti bukan mitra", () => {
    expect(classifyPartnerFlag({ data: null, error: { code: "", message: "TypeError: fetch failed" } })).toBe("check_failed");
    expect(classifyPartnerFlag({ data: null, error: { code: "57014", message: "canceling statement" } })).toBe(
      "check_failed",
    );
    expect(classifyPartnerFlag({ data: "ya", error: null })).toBe("check_failed");
  });

  it("JWT ditolak PostgREST → no_session", () => {
    expect(classifyPartnerFlag({ data: null, error: { code: "PGRST301", message: "JWT" } })).toBe("no_session");
  });
});

describe("login", () => {
  it("kredensial ditolak → pesan umum yang sama (AC-18)", () => {
    expect(classifySignInError(new AuthApiError("Invalid login credentials", 400, "invalid_credentials"))).toBe(
      "invalid_credentials",
    );
    expect(SIGN_IN_MESSAGES.invalid_credentials).toBe("Email atau password salah");
  });

  it("gangguan jaringan TIDAK dilaporkan sebagai password salah", () => {
    const failure = classifySignInError(new AuthRetryableFetchError("fetch failed", 0));
    expect(failure).toBe("unavailable");
    expect(SIGN_IN_MESSAGES[failure]).not.toContain("password salah");
    expect(classifySignInError(new AuthApiError("gateway", 503, undefined))).toBe("unavailable");
  });

  it("batas percobaan → rate_limited", () => {
    expect(classifySignInError(new AuthApiError("rate", 429, "over_request_rate_limit"))).toBe("rate_limited");
  });
});
