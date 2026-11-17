/**
 * Harness uji database TANPA Docker (ARCHITECTURE.md §17.3).
 *
 * - Lokal: PGlite (Postgres WASM) + shim Supabase (`supabase-shim.sql`).
 * - Cloud dev/staging: `pg` lewat koneksi Postgres, hanya setelah target terverifikasi
 *   (`cloud-target.ts`). Setiap kasus uji berjalan di dalam transaksi yang selalu di-ROLLBACK.
 *
 * Kedua implementasi memakai antarmuka `Db` yang sama sehingga kasus uji tidak diduplikasi.
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { PGlite } from "@electric-sql/pglite";

export type QueryResult<T> = { rows: T[]; rowCount: number };

export interface Db {
  readonly kind: "pglite" | "cloud";
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<QueryResult<T>>;
  exec(sql: string): Promise<void>;
  close(): Promise<void>;
}

const SUPPORT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SUPPORT_DIR, "../../..");
export const MIGRATIONS_DIR = path.join(ROOT, "supabase", "migrations");

export function migrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((file) => /^\d{14}_[a-z0-9_]+\.sql$/.test(file))
    .sort();
}

export function readMigration(file: string): string {
  return readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
}

class PgliteDb implements Db {
  readonly kind = "pglite" as const;
  constructor(private readonly pg: PGlite) {}

  async query<T>(sql: string, params: unknown[] = []): Promise<QueryResult<T>> {
    const result = await this.pg.query<T>(sql, params);
    return { rows: result.rows, rowCount: result.affectedRows ?? result.rows.length };
  }

  async exec(sql: string): Promise<void> {
    await this.pg.exec(sql);
  }

  async close(): Promise<void> {
    await this.pg.close();
  }
}

/** Menjalankan setiap migrasi dalam transaksinya sendiri, berurutan menurut versi. */
export async function applyMigrations(db: Db, files: string[] = migrationFiles()): Promise<void> {
  for (const file of files) {
    try {
      await db.exec(`begin;\n${readMigration(file)}\ncommit;`);
    } catch (error) {
      await db.exec("rollback;").catch(() => {});
      throw new Error(`Migrasi ${file} gagal: ${(error as Error).message}`);
    }
  }
}

export type LocalVariant = "fresh" | "upgrade-from-v03";

/** Database PGlite baru: shim Supabase → (opsional) baseline v0.3 cloud → semua migrasi repo. */
export async function createLocalDb(variant: LocalVariant): Promise<Db> {
  const db = new PgliteDb(new PGlite());
  await db.exec("set timezone to 'UTC';");
  await db.exec(readFileSync(path.join(SUPPORT_DIR, "supabase-shim.sql"), "utf8"));
  if (variant === "upgrade-from-v03") {
    await db.exec(readFileSync(path.join(SUPPORT_DIR, "v03-baseline.sql"), "utf8"));
  }
  await applyMigrations(db);
  return db;
}

// ---------------------------------------------------------------------------------------------
// Identitas & transaksi
// ---------------------------------------------------------------------------------------------

export type Actor = { role: "anon" } | { role: "authenticated"; sub: string };

export const ANON: Actor = { role: "anon" };
export const userActor = (sub: string): Actor => ({ role: "authenticated", sub });

/** Menyetel peran + klaim JWT seperti PostgREST, hanya untuk transaksi berjalan. */
export async function actAs(db: Db, actor: Actor): Promise<void> {
  const claims =
    actor.role === "anon" ? { role: "anon" } : { role: "authenticated", sub: actor.sub };
  await db.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(claims)]);
  await db.query("select set_config('request.jwt.claim.sub', $1, true)", [
    actor.role === "anon" ? "" : actor.sub,
  ]);
  await db.exec(`set local role ${actor.role};`);
}

export async function resetActor(db: Db): Promise<void> {
  await db.exec("reset role;");
  await db.query("select set_config('request.jwt.claims', '', true)");
  await db.query("select set_config('request.jwt.claim.sub', '', true)");
}

/** Menjalankan `fn` di dalam transaksi yang SELALU dibatalkan. */
export async function inRollbackTx<T>(db: Db, fn: () => Promise<T>): Promise<T> {
  await db.exec("begin;");
  try {
    return await fn();
  } finally {
    await db.exec("rollback;");
  }
}

export type SqlError = { code: string; message: string };

/**
 * Menjalankan `fn` di dalam savepoint dan mengembalikan error Postgres-nya (atau null bila berhasil).
 * Savepoint dibatalkan sehingga transaksi luar tetap dapat dipakai.
 */
export async function captureError(db: Db, fn: () => Promise<unknown>): Promise<SqlError | null> {
  await db.exec("savepoint uji;");
  try {
    await fn();
    await db.exec("release savepoint uji;");
    return null;
  } catch (error) {
    await db.exec("rollback to savepoint uji;");
    const e = error as { code?: string; message?: string };
    return { code: e.code ?? "", message: e.message ?? String(error) };
  }
}
