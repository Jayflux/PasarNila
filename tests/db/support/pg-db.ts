/**
 * Implementasi `Db` untuk Supabase cloud dev/staging lewat koneksi Postgres (`pg`), tanpa Docker/psql.
 * Sertifikat TLS SELALU diverifikasi. Bila server memakai CA Supabase, isi SUPABASE_DB_CA_PATH di
 * .env.local dengan path file sertifikat dari Dashboard → Database → SSL.
 */
import { readFileSync } from "node:fs";

import pg from "pg";

import type { Db, QueryResult } from "./db";

class CloudDb implements Db {
  readonly kind = "cloud" as const;
  constructor(private readonly client: pg.Client) {}

  async query<T>(sql: string, params: unknown[] = []): Promise<QueryResult<T>> {
    const result = await this.client.query(sql, params);
    return { rows: result.rows as T[], rowCount: result.rowCount ?? 0 };
  }

  async exec(sql: string): Promise<void> {
    await this.client.query(sql);
  }

  async close(): Promise<void> {
    await this.client.end();
  }
}

export async function connectCloudDb(dbUrl: string, caPath?: string): Promise<Db> {
  const url = new URL(dbUrl);
  url.searchParams.delete("sslmode"); // TLS diatur di bawah, bukan lewat string koneksi
  const client = new pg.Client({
    connectionString: url.toString(),
    ssl: caPath ? { ca: readFileSync(caPath, "utf8"), rejectUnauthorized: true } : { rejectUnauthorized: true },
    application_name: "pasarnila-db-tests",
    statement_timeout: 20_000,
  });
  await client.connect();
  await client.query("set timezone to 'UTC'");
  return new CloudDb(client);
}
