/**
 * Uji migrasi & keamanan database secara LOKAL tanpa Docker (PGlite + shim Supabase).
 * Membuktikan logika SQL migrasi; BUKAN bukti bahwa proyek cloud sudah benar. Untuk cloud, lihat
 * tests/db/migrations.cloud.test.ts (ARCHITECTURE.md §17.3).
 */
import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  applyMigrations,
  createLocalDb,
  inRollbackTx,
  migrationFiles,
  readMigration,
  type Db,
  type LocalVariant,
} from "./support/db";
import { defineDbSecuritySuite, type SuiteContext } from "./support/security-cases";

const PARTNER = "11111111-1111-4111-8111-111111111111";

async function seedIdentities(db: Db): Promise<SuiteContext> {
  const outsider = randomUUID();
  await db.query("insert into auth.users (id, email) values ($1, 'mitra@example.test'), ($2, 'luar@example.test')", [
    PARTNER,
    outsider,
  ]);
  await db.query("insert into private.partner_admins (user_id) values ($1)", [PARTNER]);
  return { db, partnerSub: PARTNER, outsiderSub: outsider };
}

/** Sidik jari skema: constraint, kolom, policy, fungsi, trigger, dan ACL (urutan dinormalkan). */
async function schemaFingerprint(db: Db): Promise<string[]> {
  const { rows } = await db.query<{ line: string }>(`
    select 'constraint ' || conrelid::regclass || ' ' || conname || ' ' || pg_get_constraintdef(oid) as line
      from pg_constraint where connamespace in ('public'::regnamespace, 'private'::regnamespace)
    union all
    select 'column ' || table_schema || '.' || table_name || '.' || column_name || ' ' || data_type
           || ' null=' || is_nullable || ' default=' || coalesce(column_default, '-')
      from information_schema.columns where table_schema in ('public', 'private')
    union all
    select 'policy ' || tablename || ' ' || policyname || ' ' || cmd || ' ' || roles::text || ' '
           || coalesce(qual, '-') || ' ' || coalesce(with_check, '-')
      from pg_policies where schemaname in ('public', 'private')
    union all
    select 'function ' || p.oid::regprocedure || ' definer=' || p.prosecdef || ' config='
           || coalesce(p.proconfig::text, '-') || ' src=' || md5(p.prosrc)
      from pg_proc p where p.pronamespace in ('public'::regnamespace, 'private'::regnamespace)
    union all
    select 'function-acl ' || p.oid::regprocedure || ' ' || pg_get_userbyid(a.grantee) || ' ' || a.privilege_type
      from pg_proc p, aclexplode(p.proacl) a
     where p.pronamespace in ('public'::regnamespace, 'private'::regnamespace)
    union all
    select 'table-acl ' || c.oid::regclass || ' ' || pg_get_userbyid(a.grantee) || ' ' || a.privilege_type
      from pg_class c, aclexplode(c.relacl) a
     where c.relnamespace in ('public'::regnamespace, 'private'::regnamespace) and c.relkind = 'r'
    union all
    select 'column-acl ' || c.oid::regclass || '.' || att.attname || ' ' || pg_get_userbyid(a.grantee) || ' ' || a.privilege_type
      from pg_attribute att join pg_class c on c.oid = att.attrelid, aclexplode(att.attacl) a
     where c.relnamespace in ('public'::regnamespace, 'private'::regnamespace) and att.attacl is not null
    union all
    select 'schema-acl ' || n.nspname || ' ' || pg_get_userbyid(a.grantee) || ' ' || a.privilege_type
      from pg_namespace n, aclexplode(n.nspacl) a where n.nspname = 'private'
    union all
    select 'trigger ' || tgrelid::regclass || ' ' || tgname || ' ' || tgfoid::regproc
      from pg_trigger where not tgisinternal
       and tgrelid in (select oid from pg_class where relnamespace in ('public'::regnamespace, 'private'::regnamespace))
    union all
    select 'rls ' || oid::regclass || ' ' || relrowsecurity
      from pg_class where relkind = 'r' and relnamespace in ('public'::regnamespace, 'private'::regnamespace)
  `);
  return rows.map((r) => r.line).sort();
}

const variants: LocalVariant[] = ["fresh", "upgrade-from-v03"];
const contexts = new Map<LocalVariant, SuiteContext>();
const contentBeforeSeed = new Map<LocalVariant, Record<string, unknown>>();

beforeAll(async () => {
  for (const variant of variants) {
    const db = await createLocalDb(variant);
    const counts = await db.query(
      `select (select count(*)::int from public.products) as products,
              (select count(*)::int from public.articles) as articles,
              (select count(*)::int from public.site_settings) as settings,
              (select count(*)::int from private.partner_admins) as partners,
              (select count(*)::int from auth.users) as users`,
    );
    contentBeforeSeed.set(variant, counts.rows[0] ?? {});
    contexts.set(variant, await seedIdentities(db));
  }
});

afterAll(async () => {
  for (const ctx of contexts.values()) await ctx.db.close();
});

for (const variant of variants) {
  defineDbSecuritySuite(`PGlite ${variant}`, () => {
    const ctx = contexts.get(variant);
    if (!ctx) throw new Error(`Database ${variant} belum siap`);
    return ctx;
  });
}

describe("PGlite — migrasi & rekonsiliasi", () => {
  const db = (variant: LocalVariant) => {
    const ctx = contexts.get(variant);
    if (!ctx) throw new Error(`Database ${variant} belum siap`);
    return ctx.db;
  };

  it("urutan file migrasi: 4 catatan riwayat cloud lalu 6 tahap v0.4", () => {
    expect(migrationFiles()).toEqual([
      "20261117000001_schema.sql",
      "20261117000002_security.sql",
      "20261117000003_functions.sql",
      "20261117000004_initial_content.sql",
      "20261118000001_schemas_and_helpers.sql",
      "20261118000002_tables.sql",
      "20261118000003_access_functions.sql",
      "20261118000004_policies_and_grants.sql",
      "20261118000005_rpc_functions.sql",
      "20261118000006_initial_content.sql",
    ]);
  });

  it("migrasi tidak memuat akun, password, atau baris allowlist mitra", () => {
    for (const file of migrationFiles()) {
      // Abaikan komentar SQL (`-- …`) agar penjelasan seperti "tidak ada password" tidak salah terdeteksi.
      const sql = readMigration(file)
        .split("\n")
        .map((line) => line.replace(/--.*$/, ""))
        .join("\n")
        .toLowerCase();
      expect(sql, file).not.toMatch(/insert\s+into\s+(auth\.|private\.partner_admins)/);
      expect(sql, file).not.toMatch(/password|encrypted_pass/);
    }
  });

  it("database baru: data awal 1 produk, 2 artikel, 1 pengaturan; tanpa akun/allowlist", () => {
    expect(contentBeforeSeed.get("fresh")).toEqual({
      products: 1,
      articles: 2,
      settings: 1,
      partners: 0,
      users: 0,
    });
  });

  it("database baru: stok/harga/waktu konfirmasi belum diisi; nama awal Juki Fish Farm", async () => {
    const product = await db("fresh").query(
      "select slug, stock_kg, price_per_kg_idr, stock_price_confirmed_at from public.products",
    );
    expect(product.rows).toEqual([
      { slug: "ikan-nila", stock_kg: null, price_per_kg_idr: null, stock_price_confirmed_at: null },
    ]);
    const settings = await db("fresh").query("select business_name from public.site_settings");
    expect(settings.rows).toEqual([{ business_name: "Juki Fish Farm" }]);
  });

  it("upgrade dari v0.3: data yang sudah ada tidak berubah", async () => {
    const articles = await db("upgrade-from-v03").query(
      "select slug, body from public.articles order by slug",
    );
    expect(articles.rows).toEqual([
      { slug: "artikel-1", body: "Isi uji v0.3 artikel 1." },
      { slug: "artikel-2", body: "Isi uji v0.3 artikel 2." },
    ]);
    expect(contentBeforeSeed.get("upgrade-from-v03")).toMatchObject({ products: 1, articles: 2, settings: 1 });
  });

  it("upgrade dari v0.3 menghasilkan skema yang IDENTIK dengan database baru", async () => {
    const fresh = await schemaFingerprint(db("fresh"));
    const upgraded = await schemaFingerprint(db("upgrade-from-v03"));
    expect(upgraded).toEqual(fresh);
    expect(fresh.length).toBeGreaterThan(50);
  });

  it("menjalankan ulang semua migrasi aman dan tidak menimpa data yang sudah diedit", async () => {
    const target = db("fresh");
    await inRollbackTx(target, async () => {
      // Simulasikan edit mitra lalu jalankan ulang seluruh migrasi di dalam transaksi yang dibatalkan.
      await target.query("update public.articles set title = 'Judul Diedit Mitra' where slug = 'artikel-1'");
      await target.query("update public.site_settings set business_name = 'Nama Diedit Mitra'");
      const before = await schemaFingerprint(target);
      for (const file of migrationFiles()) await target.exec(readMigration(file));
      expect(await schemaFingerprint(target)).toEqual(before);
      const article = await target.query("select title from public.articles where slug = 'artikel-1'");
      expect(article.rows).toEqual([{ title: "Judul Diedit Mitra" }]);
      const settings = await target.query("select business_name from public.site_settings");
      expect(settings.rows).toEqual([{ business_name: "Nama Diedit Mitra" }]);
      const counts = await target.query(
        "select (select count(*)::int from public.articles) as a, (select count(*)::int from public.products) as p",
      );
      expect(counts.rows).toEqual([{ a: 2, p: 1 }]);
    });
  });

  it("migrasi #4 menolak policy tak terduga (mis. dibuat manual di dashboard)", async () => {
    const target = await createLocalDb("fresh");
    try {
      await target.exec(
        `create policy "izinkan semua" on public.articles for all to anon using (true) with check (true);`,
      );
      await expect(
        applyMigrations(target, ["20261118000004_policies_and_grants.sql"]),
      ).rejects.toThrow(/policy tak terduga/);
    } finally {
      await target.close();
    }
  });
});
