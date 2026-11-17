/**
 * Penjaga target Supabase cloud untuk uji yang terhubung ke database (ARCHITECTURE.md §16.2, §17.3).
 *
 * Aturan:
 * - Nilai HANYA dibaca dari file `.env.local`, bukan dari environment sistem. Variabel seperti
 *   SUPABASE_DB_PASSWORD yang ada di environment sistem tidak dipakai otomatis.
 * - Uji hanya boleh berjalan bila `.env.local` menyatakan peruntukan eksplisit
 *   `SUPABASE_TARGET_ENV=development|staging` DAN `SUPABASE_PROJECT_REF` cocok dengan host
 *   `NEXT_PUBLIC_SUPABASE_URL`. Nilai `production` selalu ditolak.
 * - Alasan penolakan hanya menyebut NAMA variabel, tidak pernah nilainya.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { parseEnv } from "node:util";

export type CloudTarget = {
  ref: string;
  targetEnv: "development" | "staging";
  supabaseUrl: string;
  publishableKey: string;
  /** Hanya bila SUPABASE_DB_URL tersedia & cocok dengan ref. */
  dbUrl: string | null;
  partner: { email: string; password: string } | null;
  outsider: { email: string; password: string } | null;
};

export type CloudTargetResult =
  | { ok: true; target: CloudTarget; notes: string[] }
  | { ok: false; reasons: string[] };

export function readEnvLocalFile(root = process.cwd()): Record<string, string> | null {
  const file = path.join(root, ".env.local");
  if (!existsSync(file)) return null;
  const parsed = parseEnv(readFileSync(file, "utf8"));
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (typeof value === "string") result[key] = value.trim();
  }
  return result;
}

function refFromSupabaseUrl(raw: string): string | null {
  try {
    const host = new URL(raw).hostname;
    const match = /^([a-z0-9]+)\.supabase\.co$/.exec(host);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

/** Connection string harus milik ref yang sama (host direct `db.<ref>…` atau user pooler `postgres.<ref>`). */
function dbUrlMatchesRef(raw: string, ref: string): boolean {
  try {
    const url = new URL(raw);
    if (url.protocol !== "postgresql:" && url.protocol !== "postgres:") return false;
    const user = decodeURIComponent(url.username);
    return url.hostname === `db.${ref}.supabase.co` || user === `postgres.${ref}`;
  } catch {
    return false;
  }
}

export function resolveCloudTarget(env = readEnvLocalFile()): CloudTargetResult {
  if (env === null) return { ok: false, reasons: [".env.local tidak ditemukan"] };
  const reasons: string[] = [];
  const notes: string[] = [];

  const url = env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const urlRef = refFromSupabaseUrl(url);
  if (!urlRef) reasons.push("NEXT_PUBLIC_SUPABASE_URL bukan URL proyek *.supabase.co");

  const ref = env.SUPABASE_PROJECT_REF ?? "";
  if (ref === "") reasons.push("SUPABASE_PROJECT_REF kosong di .env.local");
  else if (urlRef && ref !== urlRef) {
    reasons.push("SUPABASE_PROJECT_REF tidak cocok dengan host NEXT_PUBLIC_SUPABASE_URL");
  }

  const targetEnv = env.SUPABASE_TARGET_ENV ?? "";
  if (targetEnv === "production") {
    reasons.push("SUPABASE_TARGET_ENV=production: uji database tidak pernah dijalankan ke production");
  } else if (targetEnv !== "development" && targetEnv !== "staging") {
    reasons.push(
      "SUPABASE_TARGET_ENV belum dinyatakan (development atau staging); peruntukan proyek belum terverifikasi",
    );
  }

  const publishableKey = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
  if (!publishableKey.startsWith("sb_publishable_")) {
    reasons.push("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY bukan publishable key");
  }

  let dbUrl: string | null = null;
  const rawDbUrl = env.SUPABASE_DB_URL ?? "";
  if (rawDbUrl === "") {
    notes.push("SUPABASE_DB_URL kosong di .env.local: uji SQL langsung (tests/db cloud) dilewati");
  } else if (!dbUrlMatchesRef(rawDbUrl, ref)) {
    reasons.push("SUPABASE_DB_URL bukan connection string untuk SUPABASE_PROJECT_REF yang sama");
  } else {
    dbUrl = rawDbUrl;
  }

  const account = (emailKey: string, passwordKey: string) => {
    const email = env[emailKey] ?? "";
    const password = env[passwordKey] ?? "";
    return email && password ? { email, password } : null;
  };
  const partner = account("E2E_PARTNER_EMAIL", "E2E_PARTNER_PASSWORD");
  const outsider = account("E2E_OUTSIDER_EMAIL", "E2E_OUTSIDER_PASSWORD");
  if (!partner) notes.push("E2E_PARTNER_EMAIL/PASSWORD kosong: uji Data API sebagai mitra dilewati");
  if (!outsider) notes.push("E2E_OUTSIDER_EMAIL/PASSWORD kosong: uji Data API sebagai non-mitra dilewati");
  if (partner && outsider && partner.email.toLowerCase() === outsider.email.toLowerCase()) {
    reasons.push("E2E_PARTNER_EMAIL dan E2E_OUTSIDER_EMAIL harus akun berbeda");
  }

  if (reasons.length > 0 || !urlRef) return { ok: false, reasons };
  return {
    ok: true,
    notes,
    target: {
      ref,
      targetEnv: targetEnv as "development" | "staging",
      supabaseUrl: new URL(url).origin,
      publishableKey,
      dbUrl,
      partner,
      outsider,
    },
  };
}
