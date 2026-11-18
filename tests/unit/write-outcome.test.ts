/**
 * Klasifikasi hasil tulis (ARCHITECTURE.md §10.3–§10.4; PRD AC-29, AC-51, AC-52).
 *
 * Bagian pertama memakai klien @supabase/supabase-js SUNGGUHAN dengan `fetch` palsu, untuk membuktikan
 * bahwa library terpasang MENGEMBALIKAN error sebagai objek (tidak melempar) pada kegagalan jaringan,
 * sehingga klasifikasi tidak boleh hanya mengandalkan `catch`.
 */
import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import {
  classifyWriteError,
  isSameInstant,
  judgeRecheck,
  settle,
  timestampToMicros,
} from "@/lib/write/outcome";

const URL = "https://uji.supabase.co";
const KEY = "sb_publishable_uji";

function clientWith(fetchImpl: typeof fetch) {
  return createClient(URL, KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: fetchImpl },
  });
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

async function rpcWith(fetchImpl: typeof fetch) {
  return settle(() => clientWith(fetchImpl).rpc("confirm_product_stock_price", { p_product_id: "x" }));
}

describe("klien Supabase terpasang + klasifikasi (error sebagai objek)", () => {
  it("koneksi terputus: library mengembalikan { error } (tidak melempar) → belum pasti", async () => {
    const response = await rpcWith(async () => {
      throw new TypeError("fetch failed");
    });
    expect(response.data).toBeNull();
    expect(response.error).toBeTruthy();
    expect(classifyWriteError(response.error, response.status)).toEqual({ kind: "uncertain", reason: "transport" });
  });

  it("timeout (AbortError) → belum pasti", async () => {
    const response = await rpcWith(async () => {
      throw new DOMException("The operation was aborted", "AbortError");
    });
    expect(classifyWriteError(response.error, response.status)).toEqual({ kind: "uncertain", reason: "timeout" });
  });

  it("gateway 502 HTML tanpa kode database → belum pasti", async () => {
    const response = await rpcWith(async () => new Response("<html>502 Bad Gateway</html>", { status: 502 }));
    expect(classifyWriteError(response.error, response.status)).toEqual({ kind: "uncertain", reason: "gateway" });
  });

  it("error terstruktur 22023 dengan kunci → pasti ditolak (validasi)", async () => {
    const response = await rpcWith(async () =>
      jsonResponse(400, { code: "22023", message: "stock_out_of_range", details: null, hint: null }),
    );
    expect(classifyWriteError(response.error, response.status)).toEqual({
      kind: "invalid",
      key: "stock_out_of_range",
      code: "22023",
    });
  });

  it("JWT kedaluwarsa (PGRST303) → sesi, pasti tidak berubah", async () => {
    const response = await rpcWith(async () => jsonResponse(401, { code: "PGRST303", message: "JWT expired" }));
    expect(classifyWriteError(response.error, response.status)).toEqual({ kind: "session" });
  });

  it("42501 → forbidden; P0002 → not_found", async () => {
    const forbidden = await rpcWith(async () => jsonResponse(403, { code: "42501", message: "forbidden" }));
    expect(classifyWriteError(forbidden.error, forbidden.status)).toEqual({ kind: "forbidden" });
    const missing = await rpcWith(async () => jsonResponse(400, { code: "P0002", message: "product_not_found" }));
    expect(classifyWriteError(missing.error, missing.status)).toEqual({ kind: "not_found", key: "product_not_found" });
  });

  it("koneksi DB terputus saat transaksi (08006) → BELUM pasti walau berkode", async () => {
    const response = await rpcWith(async () => jsonResponse(503, { code: "08006", message: "connection failure" }));
    expect(classifyWriteError(response.error, response.status)).toEqual({ kind: "uncertain", reason: "connection" });
  });

  it("pool PostgREST tidak tersedia (PGRST003) → pasti belum dijalankan", async () => {
    const response = await rpcWith(async () => jsonResponse(504, { code: "PGRST003", message: "Timed out acquiring connection" }));
    expect(classifyWriteError(response.error, response.status)).toEqual({ kind: "rejected", code: "PGRST003" });
  });
});

describe("klasifikasi exception yang DILEMPAR", () => {
  it("settle() mengubah exception menjadi { error } dan diklasifikasikan sama", async () => {
    const response = await settle(async () => {
      throw new TypeError("Failed to fetch");
    });
    expect(response).toMatchObject({ data: null });
    expect(classifyWriteError(response.error)).toEqual({ kind: "uncertain", reason: "transport" });
  });

  it("exception berkode SQL (mis. PostgrestError dari throwOnError) tetap memakai kodenya", async () => {
    const response = await settle(async () => {
      throw Object.assign(new Error("price_not_whole"), { code: "22023" });
    });
    expect(classifyWriteError(response.error)).toEqual({ kind: "invalid", key: "price_not_whole", code: "22023" });
  });

  it("nilai aneh (null, string) → belum pasti, bukan 'tidak berubah'", () => {
    expect(classifyWriteError(null)).toEqual({ kind: "uncertain", reason: "unknown" });
    expect(classifyWriteError("putus")).toEqual({ kind: "uncertain", reason: "unknown" });
  });

  it.each(["57P01", "XX000", "58030"])("SQLSTATE ambigu %s → belum pasti", (code) => {
    expect(classifyWriteError({ code, message: "x" }).kind).toBe("uncertain");
  });

  it.each(["57014", "40001", "23514", "23505"])("SQLSTATE %s → pasti", (code) => {
    expect(classifyWriteError({ code, message: "x" }).kind).not.toBe("uncertain");
  });
});

describe("baseline waktu mentah", () => {
  it("format JSON PostgREST dan format teks Postgres menunjuk titik yang sama", () => {
    expect(isSameInstant("2026-11-18T07:05:00.123456+00:00", "2026-11-18 07:05:00.123456+00")).toBe(true);
    expect(isSameInstant("2026-11-18T14:05:00+07:00", "2026-11-18T07:05:00Z")).toBe(true);
  });

  it("selisih mikrodetik terdeteksi (tidak dipotong ke milidetik)", () => {
    expect(isSameInstant("2026-11-18T07:05:00.123456+00:00", "2026-11-18T07:05:00.123457+00:00")).toBe(false);
  });

  it("string tampilan WIB BUKAN timestamp mentah", () => {
    expect(timestampToMicros("18 November 2026 pukul 14.05 WIB")).toBeNull();
    expect(timestampToMicros("2026-11-18")).toBeNull();
  });
});

describe("keputusan pembacaan ulang", () => {
  const baseline = "2026-11-18T07:00:00+00:00";

  it("waktu masih sama dengan baseline → belum terlihat (BUKAN bukti gagal)", () => {
    expect(judgeRecheck({ baselineAt: baseline, currentAt: baseline, matchesSubmission: false })).toBe("not_yet_visible");
  });

  it("waktu berubah & isi sama → sesuai isian", () => {
    expect(
      judgeRecheck({ baselineAt: baseline, currentAt: "2026-11-18T07:01:00+00:00", matchesSubmission: true }),
    ).toBe("matches_submission");
  });

  it("waktu berubah & isi berbeda → diubah dari tempat lain", () => {
    expect(
      judgeRecheck({ baselineAt: baseline, currentAt: "2026-11-18T07:01:00+00:00", matchesSubmission: false }),
    ).toBe("changed_elsewhere");
  });

  it("belum pernah dikonfirmasi (baseline null) dan masih null → belum terlihat", () => {
    expect(judgeRecheck({ baselineAt: null, currentAt: null, matchesSubmission: false })).toBe("not_yet_visible");
  });
});
