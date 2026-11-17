/**
 * Membaca dan memvalidasi environment variable (ARCHITECTURE.md §15).
 *
 * ATURAN: pesan error, log, dan laporan hanya boleh menyebut NAMA variabel dan alasannya, tidak pernah
 * nilainya. Fungsi di sini menerima `source` agar dapat diuji dengan nilai palsu.
 *
 * Hasil "valid" hanya berarti format benar. Itu TIDAK membuktikan proyek Supabase dapat dihubungi
 * atau migrasinya sudah diterapkan.
 */
import { z } from "zod";

import { resolveWhatsAppConfig, type WhatsAppConfig } from "@/lib/whatsapp";

export type EnvSource = Readonly<Record<string, string | undefined>>;

/**
 * Snapshot variabel yang dipakai aplikasi. Akses ditulis literal (`process.env.NAMA`) agar Next.js
 * dapat meng-inline variabel `NEXT_PUBLIC_*` bila modul ini suatu saat dipakai di sisi klien.
 */
export function readProcessEnv(): EnvSource {
  return {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    WHATSAPP_NUMBER: process.env.WHATSAPP_NUMBER,
    ALLOW_INDEXING: process.env.ALLOW_INDEXING,
    VERCEL_ENV: process.env.VERCEL_ENV,
    VERCEL_URL: process.env.VERCEL_URL,
  };
}

export class EnvValidationError extends Error {
  readonly variables: readonly string[];

  constructor(issues: ReadonlyArray<{ name: string; reason: string }>) {
    super(
      `Konfigurasi lingkungan tidak valid: ${issues
        .map((issue) => `${issue.name} (${issue.reason})`)
        .join("; ")}`,
    );
    this.name = "EnvValidationError";
    this.variables = issues.map((issue) => issue.name);
  }
}

type Check<T> =
  | { ok: true; value: T }
  | { ok: false; status: "kosong" | "tidak valid"; reason: string };

function valueOf(source: EnvSource, name: string): string {
  return (source[name] ?? "").trim();
}

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** URL berupa origin saja: https, atau http hanya untuk localhost. */
function checkOriginUrl(raw: string): Check<URL> {
  if (raw === "") return { ok: false, status: "kosong", reason: "belum diisi" };
  if (!z.url().safeParse(raw).success) {
    return { ok: false, status: "tidak valid", reason: "bukan URL yang valid" };
  }
  const url = new URL(raw);
  const isLocal = LOCAL_HOSTS.has(url.hostname);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && isLocal)) {
    return {
      ok: false,
      status: "tidak valid",
      reason: "harus https (http hanya untuk localhost)",
    };
  }
  if (url.pathname !== "/" || url.search !== "" || url.hash !== "") {
    return {
      ok: false,
      status: "tidak valid",
      reason: "harus berupa origin tanpa path, query, atau hash",
    };
  }
  if (url.username !== "" || url.password !== "") {
    return { ok: false, status: "tidak valid", reason: "tidak boleh memuat kredensial" };
  }
  return { ok: true, value: url };
}

const PUBLISHABLE_KEY = /^sb_publishable_[A-Za-z0-9_-]+$/;
const SECRET_KEY_PREFIX = "sb_secret_";
const LOOKS_LIKE_JWT = /^eyJ[\w-]*\.[\w-]+\.[\w-]+$/;

function checkPublishableKey(raw: string): Check<string> {
  if (raw === "") return { ok: false, status: "kosong", reason: "belum diisi" };
  if (raw.startsWith(SECRET_KEY_PREFIX)) {
    return {
      ok: false,
      status: "tidak valid",
      reason:
        "berisi kunci RAHASIA (sb_secret_…); jangan dipakai di variabel NEXT_PUBLIC_ dan segera rotasi kunci itu",
    };
  }
  if (LOOKS_LIKE_JWT.test(raw)) {
    return {
      ok: false,
      status: "tidak valid",
      reason: "tampak seperti anon key lama (JWT); gunakan publishable key sb_publishable_…",
    };
  }
  if (!PUBLISHABLE_KEY.test(raw)) {
    return { ok: false, status: "tidak valid", reason: "format harus sb_publishable_…" };
  }
  return { ok: true, value: raw };
}

function checkAllowIndexing(raw: string): Check<boolean> {
  if (raw === "") return { ok: true, value: false };
  if (raw === "true") return { ok: true, value: true };
  if (raw === "false") return { ok: true, value: false };
  return { ok: false, status: "tidak valid", reason: 'hanya boleh "true" atau "false"' };
}

// ---------------------------------------------------------------------------------------------
// Pembaca untuk aplikasi
// ---------------------------------------------------------------------------------------------

export type SupabasePublicEnv = { url: string; publishableKey: string };

/** Melempar `EnvValidationError` (hanya berisi nama variabel) bila konfigurasi tidak lengkap. */
export function getSupabasePublicEnv(source: EnvSource = readProcessEnv()): SupabasePublicEnv {
  const url = checkOriginUrl(valueOf(source, "NEXT_PUBLIC_SUPABASE_URL"));
  const key = checkPublishableKey(valueOf(source, "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"));
  const issues: Array<{ name: string; reason: string }> = [];
  if (!url.ok) issues.push({ name: "NEXT_PUBLIC_SUPABASE_URL", reason: url.reason });
  if (!key.ok) issues.push({ name: "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", reason: key.reason });
  if (!url.ok || !key.ok) throw new EnvValidationError(issues);
  return { url: url.value.origin, publishableKey: key.value };
}

/**
 * URL kanonik situs. Production wajib mengisi `NEXT_PUBLIC_SITE_URL`. Preview boleh jatuh ke
 * `VERCEL_URL`. Lokal tanpa nilai → `null` (tautan produk di pesan WhatsApp dihilangkan).
 */
export function getSiteUrl(source: EnvSource = readProcessEnv()): URL | null {
  const site = checkOriginUrl(valueOf(source, "NEXT_PUBLIC_SITE_URL"));
  if (site.ok) return site.value;
  if (site.status === "tidak valid") {
    throw new EnvValidationError([{ name: "NEXT_PUBLIC_SITE_URL", reason: site.reason }]);
  }
  if (valueOf(source, "VERCEL_ENV") === "production") {
    throw new EnvValidationError([
      { name: "NEXT_PUBLIC_SITE_URL", reason: "wajib diisi di production" },
    ]);
  }
  const vercelUrl = valueOf(source, "VERCEL_URL");
  if (vercelUrl !== "") {
    const fallback = checkOriginUrl(`https://${vercelUrl}`);
    if (fallback.ok) return fallback.value;
  }
  return null;
}

export function getWhatsAppConfig(source: EnvSource = readProcessEnv()): WhatsAppConfig {
  return resolveWhatsAppConfig(source.WHATSAPP_NUMBER);
}

/** Hanya nilai persis "true" yang mengizinkan indeks. Selain itu situs `noindex` (PRD A-17). */
export function isIndexingAllowed(source: EnvSource = readProcessEnv()): boolean {
  const result = checkAllowIndexing(valueOf(source, "ALLOW_INDEXING"));
  return result.ok && result.value;
}

// ---------------------------------------------------------------------------------------------
// Laporan untuk `npm run check:env`
// ---------------------------------------------------------------------------------------------

export type EnvCheckStatus = "tersedia" | "kosong" | "tidak valid" | "tidak boleh ada";
export type EnvCheckGroup = "aplikasi" | "tooling" | "terlarang";

export type EnvCheckRow = {
  name: string;
  group: EnvCheckGroup;
  required: boolean;
  status: EnvCheckStatus;
  note?: string;
};

const FORBIDDEN_VARIABLES = ["SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY"] as const;
const PROJECT_REF = /^[a-z0-9]+$/;

function rowFromCheck(
  name: string,
  group: EnvCheckGroup,
  required: boolean,
  check: Check<unknown>,
  okNote?: string,
): EnvCheckRow {
  if (check.ok) return { name, group, required, status: "tersedia", note: okNote };
  return { name, group, required, status: check.status, note: check.reason };
}

function presence(source: EnvSource, name: string): Check<string> {
  const raw = valueOf(source, name);
  return raw === ""
    ? { ok: false, status: "kosong", reason: "belum diisi" }
    : { ok: true, value: raw };
}

function checkEmail(raw: string): Check<string> {
  if (raw === "") return { ok: false, status: "kosong", reason: "belum diisi" };
  return z.email().safeParse(raw).success
    ? { ok: true, value: raw.toLowerCase() }
    : { ok: false, status: "tidak valid", reason: "bukan alamat email yang valid" };
}

/**
 * Memeriksa format dan keberadaan variabel. Tidak pernah mengembalikan nilai variabel.
 * `source` biasanya `process.env` lengkap setelah file `.env*` dimuat.
 */
export function checkEnvironment(source: EnvSource): EnvCheckRow[] {
  const rows: EnvCheckRow[] = [];

  // --- Aplikasi ---
  const supabaseUrl = checkOriginUrl(valueOf(source, "NEXT_PUBLIC_SUPABASE_URL"));
  rows.push(rowFromCheck("NEXT_PUBLIC_SUPABASE_URL", "aplikasi", true, supabaseUrl));
  rows.push(
    rowFromCheck(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      "aplikasi",
      true,
      checkPublishableKey(valueOf(source, "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY")),
    ),
  );

  const siteUrl = checkOriginUrl(valueOf(source, "NEXT_PUBLIC_SITE_URL"));
  rows.push({
    ...rowFromCheck("NEXT_PUBLIC_SITE_URL", "aplikasi", false, siteUrl),
    ...(siteUrl.ok
      ? {}
      : siteUrl.status === "kosong"
        ? { note: "wajib di production; tanpa nilai, tautan produk di pesan WhatsApp dihilangkan" }
        : {}),
  });

  const whatsApp = resolveWhatsAppConfig(source.WHATSAPP_NUMBER);
  rows.push(
    whatsApp.configured
      ? { name: "WHATSAPP_NUMBER", group: "aplikasi", required: false, status: "tersedia" }
      : {
          name: "WHATSAPP_NUMBER",
          group: "aplikasi",
          required: false,
          status: whatsApp.reason === "missing" ? "kosong" : "tidak valid",
          note:
            whatsApp.reason === "missing"
              ? "tombol WhatsApp akan nonaktif"
              : "format harus nomor Indonesia (62…/08…/+62…); tombol WhatsApp akan nonaktif",
        },
  );

  const indexing = checkAllowIndexing(valueOf(source, "ALLOW_INDEXING"));
  rows.push(
    indexing.ok
      ? {
          name: "ALLOW_INDEXING",
          group: "aplikasi",
          required: false,
          status: valueOf(source, "ALLOW_INDEXING") === "" ? "kosong" : "tersedia",
          note: indexing.value ? "indeks DIIZINKAN" : "situs noindex",
        }
      : rowFromCheck("ALLOW_INDEXING", "aplikasi", false, indexing),
  );

  // --- Tooling (lokal/CI, tidak dipakai aplikasi) ---
  const projectRefRaw = valueOf(source, "SUPABASE_PROJECT_REF");
  let projectRef: Check<string> = presence(source, "SUPABASE_PROJECT_REF");
  if (projectRef.ok && !PROJECT_REF.test(projectRefRaw)) {
    projectRef = { ok: false, status: "tidak valid", reason: "hanya huruf kecil dan angka" };
  } else if (
    projectRef.ok &&
    supabaseUrl.ok &&
    supabaseUrl.value.hostname.endsWith(".supabase.co") &&
    supabaseUrl.value.hostname !== `${projectRefRaw}.supabase.co`
  ) {
    projectRef = {
      ok: false,
      status: "tidak valid",
      reason: "tidak cocok dengan host NEXT_PUBLIC_SUPABASE_URL",
    };
  }
  rows.push(rowFromCheck("SUPABASE_PROJECT_REF", "tooling", false, projectRef));
  rows.push(
    rowFromCheck("SUPABASE_ACCESS_TOKEN", "tooling", false, presence(source, "SUPABASE_ACCESS_TOKEN")),
  );
  rows.push(
    rowFromCheck("SUPABASE_DB_PASSWORD", "tooling", false, presence(source, "SUPABASE_DB_PASSWORD")),
  );

  const targetEnvRaw = valueOf(source, "SUPABASE_TARGET_ENV");
  rows.push(
    targetEnvRaw === ""
      ? {
          name: "SUPABASE_TARGET_ENV",
          group: "tooling",
          required: false,
          status: "kosong",
          note: "peruntukan proyek belum dinyatakan; migrasi & uji cloud ditahan",
        }
      : ["development", "staging", "production"].includes(targetEnvRaw)
        ? {
            name: "SUPABASE_TARGET_ENV",
            group: "tooling",
            required: false,
            status: "tersedia",
            note:
              targetEnvRaw === "production"
                ? "production: uji database & penerapan dari laptop ditolak"
                : `peruntukan: ${targetEnvRaw}`,
          }
        : {
            name: "SUPABASE_TARGET_ENV",
            group: "tooling",
            required: false,
            status: "tidak valid",
            note: 'hanya "development", "staging", atau "production"',
          },
  );

  const dbUrlRaw = valueOf(source, "SUPABASE_DB_URL");
  let dbUrl: Check<string> = presence(source, "SUPABASE_DB_URL");
  if (dbUrl.ok) {
    let matches = false;
    try {
      const parsed = new URL(dbUrlRaw);
      const user = decodeURIComponent(parsed.username);
      matches =
        (parsed.protocol === "postgresql:" || parsed.protocol === "postgres:") &&
        projectRef.ok &&
        (parsed.hostname === `${projectRefRaw}.supabase.co` ||
          parsed.hostname === `db.${projectRefRaw}.supabase.co` ||
          user === `postgres.${projectRefRaw}`);
    } catch {
      matches = false;
    }
    if (!matches) {
      dbUrl = {
        ok: false,
        status: "tidak valid",
        reason: "harus connection string postgres untuk SUPABASE_PROJECT_REF yang sama",
      };
    }
  }
  rows.push(rowFromCheck("SUPABASE_DB_URL", "tooling", false, dbUrl, "berisi kredensial; jangan dibagikan"));
  rows.push(
    rowFromCheck("SUPABASE_DB_CA_PATH", "tooling", false, presence(source, "SUPABASE_DB_CA_PATH")),
  );

  const partnerEmail = checkEmail(valueOf(source, "E2E_PARTNER_EMAIL"));
  let outsiderEmail = checkEmail(valueOf(source, "E2E_OUTSIDER_EMAIL"));
  if (partnerEmail.ok && outsiderEmail.ok && partnerEmail.value === outsiderEmail.value) {
    outsiderEmail = {
      ok: false,
      status: "tidak valid",
      reason: "harus akun yang berbeda dari E2E_PARTNER_EMAIL",
    };
  }
  rows.push(rowFromCheck("E2E_PARTNER_EMAIL", "tooling", false, partnerEmail));
  rows.push(
    rowFromCheck("E2E_PARTNER_PASSWORD", "tooling", false, presence(source, "E2E_PARTNER_PASSWORD")),
  );
  rows.push(rowFromCheck("E2E_OUTSIDER_EMAIL", "tooling", false, outsiderEmail));
  rows.push(
    rowFromCheck("E2E_OUTSIDER_PASSWORD", "tooling", false, presence(source, "E2E_OUTSIDER_PASSWORD")),
  );

  // --- Terlarang ---
  for (const name of FORBIDDEN_VARIABLES) {
    if (valueOf(source, name) !== "") {
      rows.push({
        name,
        group: "terlarang",
        required: false,
        status: "tidak boleh ada",
        note: "aplikasi tidak memakai secret key; hapus dari lingkungan ini dan jangan set di Vercel",
      });
    }
  }
  for (const name of Object.keys(source).sort()) {
    if (name.startsWith("NEXT_PUBLIC_") && valueOf(source, name).startsWith(SECRET_KEY_PREFIX)) {
      if (name === "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY") continue; // sudah dilaporkan di atas
      rows.push({
        name,
        group: "terlarang",
        required: false,
        status: "tidak boleh ada",
        note: "variabel NEXT_PUBLIC_ berisi kunci rahasia; hapus dan rotasi kunci itu",
      });
    }
  }

  return rows;
}

export function isEnvCheckPassing(rows: readonly EnvCheckRow[]): boolean {
  return rows.every(
    (row) =>
      row.status !== "tidak valid" &&
      row.status !== "tidak boleh ada" &&
      !(row.required && row.status === "kosong"),
  );
}
