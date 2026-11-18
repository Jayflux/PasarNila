/**
 * Klasifikasi hasil operasi tulis ke Supabase (ARCHITECTURE.md §10.3–§10.4; PRD AC-29, AC-51, AC-52).
 *
 * Aturan utama: hasil dianggap PASTI hanya bila
 *   (a) permintaan belum dikirim,
 *   (b) ada jawaban sukses yang memuat baris tersimpan, atau
 *   (c) ada jawaban error TERSTRUKTUR dari PostgREST/Postgres yang menjamin transaksi dibatalkan.
 * Selain itu hasilnya BELUM PASTI: data mungkin sudah tersimpan, mungkin belum.
 *
 * Catatan perilaku library terpasang (@supabase/postgrest-js 2.119, diverifikasi dari kode di
 * node_modules dan diuji di tests/unit/write-outcome.test.ts): kegagalan jaringan, timeout, dan respons
 * gateway non-JSON TIDAK dilempar sebagai exception. Library mengembalikan `{ error }` dengan `code`
 * kosong/tidak ada. Karena itu klasifikasi tidak boleh hanya bergantung pada `catch`.
 */

export type WriteFailure =
  /** JWT/sesi tidak berlaku menurut PostgREST (PGRST3xx). Pasti tidak berubah. */
  | { kind: "session" }
  /** Postgres 42501. Pasti tidak berubah. */
  | { kind: "forbidden" }
  /** Postgres P0002 (mis. `product_not_found`). Pasti tidak berubah. */
  | { kind: "not_found"; key: string | null }
  /** Validasi database (22023 dengan kunci, 23514, 22P02, …). Pasti tidak berubah. */
  | { kind: "invalid"; key: string | null; code: string }
  /** Pelanggaran keunikan (23505). Pasti tidak berubah. */
  | { kind: "conflict"; key: string | null }
  /** Error terstruktur lain yang membatalkan transaksi. Pasti tidak berubah. */
  | { kind: "rejected"; code: string }
  /** Tidak ada jaminan apa pun tentang hasilnya. */
  | { kind: "uncertain"; reason: UncertainReason };

export type UncertainReason = "transport" | "timeout" | "gateway" | "connection" | "unknown";

const SQLSTATE = /^[0-9A-Z]{5}$/;
const POSTGREST_CODE = /^PGRST\d{3}$/;
/** Kunci pesan exception dari fungsi database proyek ini, mis. `stock_out_of_range`. */
const MESSAGE_KEY = /^[a-z][a-z0-9_]{1,63}$/;

/**
 * SQLSTATE yang TIDAK menjamin pembatalan: koneksi putus (kelas 08), server dimatikan/crash
 * (57P01–57P05), error sistem/I/O (58), dan error internal (XX). Bila terjadi saat COMMIT, transaksi
 * bisa saja sudah tersimpan.
 *
 * `57014` (statement timeout/query dibatalkan) dan `40001`/`40P01` (serialisasi/deadlock) TIDAK masuk
 * daftar ini: statement dibatalkan sebelum commit dan PostgREST membatalkan transaksinya.
 */
function isAmbiguousSqlstate(code: string): boolean {
  return (
    code.startsWith("08") || /^57P0[1-5]$/.test(code) || code.startsWith("58") || code.startsWith("XX")
  );
}

type ErrorLike = { code?: unknown; message?: unknown; hint?: unknown; details?: unknown; name?: unknown };

function asErrorLike(error: unknown): ErrorLike | null {
  return typeof error === "object" && error !== null ? (error as ErrorLike) : null;
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function messageKey(error: ErrorLike): string | null {
  const message = text(error.message).trim();
  return MESSAGE_KEY.test(message) ? message : null;
}

/**
 * Mengklasifikasikan error dari respons Supabase (`{ error, status }`) ATAU exception yang dilempar.
 * `status` adalah kode HTTP respons bila tersedia (postgrest-js mengisinya; 0 bila tidak ada jawaban).
 */
export function classifyWriteError(error: unknown, status?: number | null): WriteFailure {
  const e = asErrorLike(error);
  if (e === null) return { kind: "uncertain", reason: "unknown" };

  const code = text(e.code).trim();

  if (POSTGREST_CODE.test(code)) {
    // PGRST3xx = JWT tidak valid/kedaluwarsa. Kode PGRST lain (koneksi pool, schema cache, permintaan
    // tidak valid) muncul SEBELUM perintah dijalankan atau dari transaksi yang dibatalkan.
    return code.startsWith("PGRST3") ? { kind: "session" } : { kind: "rejected", code };
  }

  if (SQLSTATE.test(code)) {
    if (isAmbiguousSqlstate(code)) return { kind: "uncertain", reason: "connection" };
    if (code === "42501") return { kind: "forbidden" };
    if (code === "P0002") return { kind: "not_found", key: messageKey(e) };
    if (code === "23505") return { kind: "conflict", key: messageKey(e) };
    if (code === "22023" || code === "23514" || code === "23502" || code.startsWith("22")) {
      return { kind: "invalid", key: messageKey(e), code };
    }
    return { kind: "rejected", code };
  }

  // Tanpa kode terstruktur: tidak ada jaminan dari database.
  const combined = `${text(e.name)} ${text(e.message)} ${text(e.hint)}`;
  if (/abort|timeout|timed out/i.test(combined)) return { kind: "uncertain", reason: "timeout" };
  if (typeof status === "number" && status >= 500) return { kind: "uncertain", reason: "gateway" };
  if (/fetch|network|socket|ECONN|ENOTFOUND|EAI_AGAIN|TypeError/i.test(combined)) {
    return { kind: "uncertain", reason: "transport" };
  }
  return { kind: "uncertain", reason: "unknown" };
}

export function isCertainFailure(failure: WriteFailure): boolean {
  return failure.kind !== "uncertain";
}

// ---------------------------------------------------------------------------------------------
// Respons basis data yang sudah dinormalisasi
// ---------------------------------------------------------------------------------------------

/** Bentuk respons Supabase yang dipakai lapisan aksi; `thrown` = exception ditangkap saat memanggil. */
export type DbResponse = { data: unknown; error: unknown; status?: number | null };

/**
 * Menjalankan pemanggilan Supabase dan menormalkan exception menjadi `{ error }`, sehingga pemanggil
 * memakai satu jalur klasifikasi untuk error berbentuk objek maupun exception.
 */
export async function settle(call: () => PromiseLike<DbResponse>): Promise<DbResponse> {
  try {
    const result = await call();
    return { data: result.data ?? null, error: result.error ?? null, status: result.status ?? null };
  } catch (thrown) {
    return { data: null, error: thrown ?? new Error("exception tanpa nilai"), status: null };
  }
}

// ---------------------------------------------------------------------------------------------
// Waktu mentah (baseline): dibandingkan sebagai titik waktu, BUKAN string tampilan WIB.
// ---------------------------------------------------------------------------------------------

const TIMESTAMP =
  /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2})(?:\.(\d{1,9}))?(Z|[+-]\d{2}(?::?\d{2})?)$/i;

/**
 * `2026-11-18T07:05:00.123456+00:00` → mikrodetik sejak epoch. Mendukung format JSON PostgREST dan
 * format teks Postgres (`2026-11-18 07:05:00.123456+00`). `null` bila bukan timestamp ber-zona waktu.
 */
export function timestampToMicros(value: string | null | undefined): bigint | null {
  if (typeof value !== "string") return null;
  const match = TIMESTAMP.exec(value.trim());
  if (!match) return null;
  const [, date, time, fraction = "", rawZone = "Z"] = match;
  let zone = rawZone.toUpperCase();
  if (zone !== "Z") {
    const sign = zone[0];
    const digits = zone.slice(1).replace(":", "");
    zone = `${sign}${digits.slice(0, 2)}:${(digits.slice(2) || "00").padEnd(2, "0")}`;
  }
  const millis = Date.parse(`${date}T${time}${zone}`);
  if (Number.isNaN(millis)) return null;
  const micros = BigInt((fraction + "000000").slice(0, 6));
  return BigInt(millis) * BigInt(1000) + micros;
}

export function isRawTimestamp(value: string | null | undefined): value is string {
  return timestampToMicros(value) !== null;
}

/** Dua nilai waktu mentah menunjuk titik yang sama. `null` hanya sama dengan `null`. */
export function isSameInstant(a: string | null, b: string | null): boolean {
  if (a === null || b === null) return a === b;
  const left = timestampToMicros(a);
  const right = timestampToMicros(b);
  if (left === null || right === null) return a === b;
  return left === right;
}

// ---------------------------------------------------------------------------------------------
// Keputusan pembacaan ulang (§10.4)
// ---------------------------------------------------------------------------------------------

export type RecheckVerdict =
  /** Penanda waktu berubah dan isi sama dengan isian: data tersimpan sesuai isian. */
  | "matches_submission"
  /** Penanda waktu berubah tetapi isi berbeda: data diubah dari tempat lain. */
  | "changed_elsewhere"
  /**
   * Penanda waktu masih sama dengan baseline. BUKAN bukti gagal: permintaan mungkin masih diproses
   * atau belum sampai. Status tetap belum pasti.
   */
  | "not_yet_visible";

export function judgeRecheck(input: {
  baselineAt: string | null;
  currentAt: string | null;
  matchesSubmission: boolean;
}): RecheckVerdict {
  if (isSameInstant(input.baselineAt, input.currentAt)) return "not_yet_visible";
  return input.matchesSubmission ? "matches_submission" : "changed_elsewhere";
}
