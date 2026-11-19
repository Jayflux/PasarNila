/**
 * Saluran fixture untuk uji Data API cloud (ARCHITECTURE.md §17.3).
 *
 * Fixture (produk uji TERSEMBUNYI) dibuat dan dihapus dengan hak pemilik, karena akun mitra tidak boleh
 * membuat produk. Dua saluran, dipilih otomatis:
 * 1. `SUPABASE_DB_URL` → koneksi Postgres langsung (`pg`).
 * 2. Bila tidak ada, `SUPABASE_ACCESS_TOKEN` → Management API (`/database/query`) pada proyek yang SAMA
 *    dengan target terverifikasi.
 *
 * Aturan: hanya dipakai setelah `resolveCloudTarget()` lolos (peruntukan development/staging eksplisit +
 * ref cocok URL). Hanya untuk INSERT/DELETE fixture bertanda uji. Token tidak pernah dicetak. Nilai
 * parameter dibatasi ke pola aman karena Management API tidak menerima parameter terikat.
 */
import { connectCloudDb } from "../db/support/pg-db";
import { readEnvLocalFile, type CloudTarget } from "./cloud-target";

export type FixtureDb = {
  readonly via: "pg" | "management-api";
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
  close(): Promise<void>;
};

const SAFE_STRING = /^[A-Za-z0-9 _.:-]{0,120}$/;

/** Mengisi `$1…$n` dengan literal SQL yang sudah divalidasi. Melempar untuk nilai di luar pola aman. */
export function bindParams(sql: string, params: unknown[]): string {
  return sql.replace(/\$(\d+)/g, (_match, index: string) => {
    const value = params[Number(index) - 1];
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
    if (typeof value === "boolean") return value ? "true" : "false";
    if (typeof value === "string" && SAFE_STRING.test(value)) return `'${value}'`;
    throw new Error(`Parameter fixture $${index} tidak aman atau tidak didukung`);
  });
}

class ManagementApiDb implements FixtureDb {
  readonly via = "management-api" as const;
  constructor(
    private readonly ref: string,
    private readonly token: string,
  ) {}

  async query<T>(sql: string, params: unknown[] = []): Promise<{ rows: T[] }> {
    const response = await fetch(`https://api.supabase.com/v1/projects/${this.ref}/database/query`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.token}`, "content-type": "application/json" },
      body: JSON.stringify({ query: bindParams(sql, params) }),
    });
    const body: unknown = await response.json().catch(() => null);
    if (response.status >= 300 || !Array.isArray(body)) {
      // Pesan error server dapat memuat potongan SQL; hanya status yang dilaporkan.
      throw new Error(`Management API fixture gagal (HTTP ${response.status})`);
    }
    return { rows: body as T[] };
  }

  async close(): Promise<void> {}
}

export async function connectFixtureDb(target: CloudTarget): Promise<FixtureDb | null> {
  const env = readEnvLocalFile() ?? {};
  if (target.dbUrl) {
    const db = await connectCloudDb(target.dbUrl, env.SUPABASE_DB_CA_PATH || undefined);
    return {
      via: "pg",
      query: async <T>(sql: string, params?: unknown[]) => {
        const result = await db.query<T>(sql, params);
        return { rows: result.rows };
      },
      close: () => db.close(),
    };
  }
  const token = env.SUPABASE_ACCESS_TOKEN ?? "";
  return token ? new ManagementApiDb(target.ref, token) : null;
}
