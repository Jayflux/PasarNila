/**
 * Uji keamanan database di Supabase CLOUD dev/staging lewat koneksi Postgres (tanpa Docker/psql).
 *
 * Prasyarat (semua dari .env.local, bukan environment sistem; lihat tests/support/cloud-target.ts):
 *   SUPABASE_TARGET_ENV=development|staging, SUPABASE_PROJECT_REF cocok dengan URL, SUPABASE_DB_URL.
 * Keamanan data:
 * - Setiap kasus berjalan di transaksi yang SELALU di-ROLLBACK; fixture ikut dibatalkan.
 * - Allowlist tidak pernah diubah; identitas mitra = user_id yang sudah ada di allowlist.
 * - Tidak memakai service-role key. Peran anon/authenticated disimulasikan lewat SET ROLE + klaim JWT
 *   seperti PostgREST. Bukti lewat Data API sungguhan ada di tests/api/data-api.cloud.test.ts.
 */
import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, it } from "vitest";

import { readEnvLocalFile, resolveCloudTarget } from "../support/cloud-target";
import type { Db } from "./support/db";
import { connectCloudDb } from "./support/pg-db";
import { defineDbSecuritySuite, type SuiteContext } from "./support/security-cases";

const resolved = resolveCloudTarget();
const env = readEnvLocalFile() ?? {};
const skipReasons: string[] = !resolved.ok
  ? resolved.reasons
  : resolved.target.dbUrl === null
    ? ["SUPABASE_DB_URL kosong di .env.local"]
    : [];

if (skipReasons.length > 0) {
  describe("Supabase cloud — uji SQL langsung", () => {
    it.skip(`DILEWATI: ${skipReasons.join("; ")}`, () => {});
  });
} else {
  let ctx: SuiteContext | null = null;
  let db: Db | null = null;
  let notMigrated: string | null = null;

  beforeAll(async () => {
    if (!resolved.ok || !resolved.target.dbUrl) return;
    db = await connectCloudDb(resolved.target.dbUrl, env.SUPABASE_DB_CA_PATH || undefined);
    const migrated = await db.query<{ n: number }>(
      `select count(*)::int as n from pg_proc
        where oid = to_regprocedure('public.confirm_product_stock_price(uuid,numeric,numeric)')`,
    );
    if ((migrated.rows[0]?.n ?? 0) !== 1) {
      notMigrated = "migrasi v0.4 (20261118000001–06) belum diterapkan di proyek ini";
    }
    const partner = await db.query<{ user_id: string }>("select user_id::text from private.partner_admins");
    let outsider = randomUUID();
    while (partner.rows.some((r) => r.user_id === outsider)) outsider = randomUUID();
    ctx = { db, partnerSub: partner.rows[0]?.user_id ?? null, outsiderSub: outsider };
  });

  afterAll(async () => {
    await db?.close();
  });

  describe("Supabase cloud — prasyarat", () => {
    it("migrasi v0.4 sudah diterapkan dan allowlist berisi satu mitra", ({ skip }) => {
      if (notMigrated) skip(notMigrated);
      if (!ctx?.partnerSub) throw new Error("Allowlist mitra kosong; kasus mitra tidak dapat dijalankan");
    });
  });

  defineDbSecuritySuite(`Supabase cloud (${resolved.ok ? resolved.target.targetEnv : "?"})`, () => {
    if (notMigrated) throw new Error(notMigrated);
    if (!ctx) throw new Error("Koneksi cloud belum siap");
    return ctx;
  });
}
