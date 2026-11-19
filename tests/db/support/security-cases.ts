/**
 * Kasus uji keamanan & aturan database (ARCHITECTURE.md §17.2: T-07, T-09, T-11, T-12; PRD AC-21,
 * AC-28, AC-31, AC-32, AC-39, AC-48). Dipakai oleh PGlite lokal dan cloud dev/staging.
 *
 * Setiap kasus berjalan di transaksi yang selalu di-ROLLBACK. Fixture (produk/artikel tersembunyi)
 * dibuat di dalam transaksi itu sebagai pemilik koneksi, lalu ikut dibatalkan. Allowlist mitra tidak
 * pernah diubah; identitas mitra di cloud memakai user_id yang SUDAH ada di allowlist.
 */
import { describe, expect, it } from "vitest";

import {
  actAs,
  ANON,
  captureError,
  inRollbackTx,
  resetActor,
  userActor,
  type Db,
} from "./db";

export type SuiteContext = {
  db: Db;
  /** user_id di allowlist; null bila allowlist kosong (kasus mitra dilewati). */
  partnerSub: string | null;
  /** UUID yang dipastikan TIDAK ada di allowlist. */
  outsiderSub: string;
};

type Row = Record<string, unknown>;

async function one<T = Row>(db: Db, sql: string, params?: unknown[]): Promise<T> {
  const result = await db.query<T>(sql, params);
  const row = result.rows[0];
  if (row === undefined) throw new Error(`Kueri tidak mengembalikan baris: ${sql}`);
  return row;
}

async function makeFixtures(db: Db) {
  const product = await one<{ id: string }>(
    db,
    `insert into public.products (slug, name, is_published)
     values ('uji-produk-tersembunyi', 'Produk Uji', false) returning id`,
  );
  const article = await one<{ id: string }>(
    db,
    `insert into public.articles (slug, title, body, is_published, updated_at)
     values ('uji-artikel-tersembunyi', 'Judul Uji', 'Isi uji', false, '2000-01-01T00:00:00Z')
     returning id`,
  );
  // Waktu konfirmasi lama yang diketahui, agar perubahan (atau ketiadaannya) dapat dibuktikan.
  await db.query(
    `update public.products
        set stock_kg = 10, price_per_kg_idr = 32000,
            stock_price_confirmed_at = '2000-01-01T00:00:00Z'
      where id = $1`,
    [product.id],
  );
  return { productId: product.id, articleId: article.id };
}

async function confirmedAt(db: Db, productId: string): Promise<string> {
  const row = await one<{ t: string }>(
    db,
    "select stock_price_confirmed_at::text as t from public.products where id = $1",
    [productId],
  );
  return row.t;
}

export function defineDbSecuritySuite(label: string, getContext: () => SuiteContext): void {
  const ctx = () => getContext();

  describe(`${label} — struktur hak akses (T-07)`, () => {
    it("RLS aktif pada kelima tabel", async () => {
      const { rows } = await ctx().db.query<{ t: string; rls: boolean }>(
        `select n.nspname || '.' || c.relname as t, c.relrowsecurity as rls
           from pg_class c join pg_namespace n on n.oid = c.relnamespace
          where (n.nspname, c.relname) in (('public','products'),('public','articles'),
                ('public','site_settings'),('public','product_packages'),('private','partner_admins'))
          order by 1`,
      );
      expect(rows).toEqual([
        { t: "private.partner_admins", rls: true },
        { t: "public.articles", rls: true },
        { t: "public.product_packages", rls: true },
        { t: "public.products", rls: true },
        { t: "public.site_settings", rls: true },
      ]);
    });

    it("hak EXECUTE fungsi: anon tidak ada; authenticated hanya 5 fungsi publik", async () => {
      const { rows } = await ctx().db.query<{ fn: string; anon: boolean; auth: boolean }>(
        `select n.nspname || '.' || p.oid::regprocedure::text as fn,
                has_function_privilege('anon', p.oid, 'EXECUTE') as anon,
                has_function_privilege('authenticated', p.oid, 'EXECUTE') as auth
           from pg_proc p join pg_namespace n on n.oid = p.pronamespace
          where n.nspname in ('public', 'private')`,
      );
      // regprocedure menampilkan schema hanya bila tidak ada di search_path; normalkan dulu.
      const normalized = rows
        .map((r) => ({ ...r, fn: r.fn.replace(/^(public|private)\.(private\.)?/, "$1.") }))
        .sort((a, b) => a.fn.localeCompare(b.fn, "en"));
      expect(normalized).toEqual([
        { fn: "private.assert_package_numbers(numeric,numeric)", anon: false, auth: false },
        { fn: "private.is_partner_admin()", anon: false, auth: false },
        { fn: "private.normalize_package_name(text)", anon: false, auth: false },
        { fn: "private.set_updated_at()", anon: false, auth: false },
        { fn: "public.confirm_product_stock_price(uuid,numeric,numeric)", anon: false, auth: true },
        { fn: "public.create_product_package(uuid,uuid,text,numeric,numeric)", anon: false, auth: true },
        { fn: "public.current_user_is_partner()", anon: false, auth: true },
        { fn: "public.delete_product_package(uuid)", anon: false, auth: true },
        { fn: "public.update_product_package(uuid,text,numeric,numeric)", anon: false, auth: true },
        { fn: "public.update_product_photo(uuid,text,text)", anon: false, auth: true },
      ]);
    });

    it("role API tidak punya USAGE pada schema private", async () => {
      const row = await one<{ anon: boolean; auth: boolean }>(
        ctx().db,
        `select has_schema_privilege('anon', 'private', 'USAGE') as anon,
                has_schema_privilege('authenticated', 'private', 'USAGE') as auth`,
      );
      expect(row).toEqual({ anon: false, auth: false });
    });

    it("hak tabel: hanya SELECT; UPDATE hanya kolom title/body dan business_name", async () => {
      const { rows } = await ctx().db.query<Row>(
        `select r.role, t.tbl,
                has_table_privilege(r.role, t.tbl, 'SELECT') as sel,
                has_table_privilege(r.role, t.tbl, 'INSERT') as ins,
                has_table_privilege(r.role, t.tbl, 'UPDATE') as upd,
                has_table_privilege(r.role, t.tbl, 'DELETE') as del,
                has_table_privilege(r.role, t.tbl, 'TRUNCATE') as trunc
           from (values ('anon'), ('authenticated')) r(role),
                (values ('public.products'), ('public.articles'), ('public.site_settings'),
                        ('public.product_packages'), ('private.partner_admins')) t(tbl)
          order by 1, 2`,
      );
      for (const row of rows) {
        expect(row, JSON.stringify(row)).toMatchObject({ ins: false, upd: false, del: false, trunc: false });
        expect(row.sel).toBe(row.tbl !== "private.partner_admins");
      }
      const { rows: cols } = await ctx().db.query<{ role: string; col: string }>(
        `select r.role, c.table_name || '.' || c.column_name as col
           from information_schema.columns c, (values ('anon'), ('authenticated')) r(role)
          where c.table_schema = 'public' and c.table_name in ('products','articles','site_settings','product_packages')
            and has_column_privilege(r.role, format('public.%I', c.table_name), c.column_name, 'UPDATE')`,
      );
      cols.sort((a, b) => `${a.role} ${a.col}`.localeCompare(`${b.role} ${b.col}`, "en"));
      expect(cols).toEqual([
        { role: "authenticated", col: "articles.body" },
        { role: "authenticated", col: "articles.title" },
        { role: "authenticated", col: "site_settings.business_name" },
      ]);
    });

    it("hanya sembilan policy yang diharapkan, tidak ada yang memanggil schema private", async () => {
      const { rows } = await ctx().db.query<{ p: string; leaks_private: boolean }>(
        `select tablename || ': ' || policyname || ' [' || cmd || ']' as p,
                coalesce(qual, '') || coalesce(with_check, '') like '%private.%' as leaks_private
           from pg_policies where schemaname in ('public', 'private')`,
      );
      expect(rows.map((r) => r.p).sort()).toEqual([
        "articles: mitra baca semua artikel [SELECT]",
        "articles: mitra ubah artikel [UPDATE]",
        "articles: publik baca artikel terbit [SELECT]",
        "product_packages: mitra baca semua paket [SELECT]",
        "product_packages: publik baca paket produk terbit [SELECT]",
        "products: mitra baca semua produk [SELECT]",
        "products: publik baca produk terbit [SELECT]",
        "site_settings: mitra ubah nama usaha [UPDATE]",
        "site_settings: publik baca pengaturan [SELECT]",
      ]);
      expect(rows.every((r) => !r.leaks_private)).toBe(true);
    });

    it("hanya ada satu fungsi confirm_product_stock_price (versi integer lama terhapus)", async () => {
      const row = await one<{ n: number }>(
        ctx().db,
        "select count(*)::int as n from pg_proc where proname = 'confirm_product_stock_price'",
      );
      expect(row.n).toBe(1);
    });
  });

  describe(`${label} — pengunjung anon (AC-21)`, () => {
    it("hanya melihat produk & artikel terbit", async () => {
      const { db } = ctx();
      await inRollbackTx(db, async () => {
        await makeFixtures(db);
        await actAs(db, ANON);
        const products = await db.query<{ slug: string }>("select slug from public.products");
        const articles = await db.query<{ slug: string }>("select slug from public.articles");
        expect(products.rows.map((r) => r.slug)).not.toContain("uji-produk-tersembunyi");
        expect(articles.rows.map((r) => r.slug)).not.toContain("uji-artikel-tersembunyi");
        const settings = await db.query("select business_name from public.site_settings");
        expect(settings.rows).toHaveLength(1);
      });
    });

    it("tidak dapat membaca allowlist, memanggil RPC, atau mengecek status mitra", async () => {
      const { db } = ctx();
      await inRollbackTx(db, async () => {
        const { productId } = await makeFixtures(db);
        await actAs(db, ANON);
        expect((await captureError(db, () => db.query("select * from private.partner_admins")))?.code).toBe("42501");
        expect((await captureError(db, () => db.query("select public.current_user_is_partner()")))?.code).toBe("42501");
        const rpc = await captureError(db, () =>
          db.query("select * from public.confirm_product_stock_price($1, $2, $3)", [productId, "1", "1"]),
        );
        expect(rpc?.code).toBe("42501");
        await resetActor(db);
        expect(await confirmedAt(db, productId)).toBe("2000-01-01 00:00:00+00");
      });
    });

    it("tidak dapat menulis tabel apa pun", async () => {
      const { db } = ctx();
      await inRollbackTx(db, async () => {
        const { productId, articleId } = await makeFixtures(db);
        await actAs(db, ANON);
        const attempts = [
          () => db.query("update public.products set stock_kg = 1 where id = $1", [productId]),
          () => db.query("update public.articles set title = 'x' where id = $1", [articleId]),
          () => db.query("update public.site_settings set business_name = 'Diretas'"),
          () => db.query("insert into public.articles (slug, title, body) values ('a-b', 'x', 'y')"),
          () => db.query("delete from public.articles where id = $1", [articleId]),
          () => db.query("delete from public.site_settings where false"),
          // Cloud verifies TRUNCATE via has_table_privilege above; never issue TRUNCATE there.
          ...(db.kind === "pglite" ? [() => db.query("truncate public.articles")] : []),
        ];
        for (const attempt of attempts) {
          expect((await captureError(db, attempt))?.code).toBe("42501");
        }
      });
    });
  });

  describe(`${label} — akun login non-mitra (AC-20, AC-21, AC-48)`, () => {
    it("status mitra false, tidak melihat data tersembunyi, RPC ditolak 'forbidden'", async () => {
      const { db, outsiderSub } = ctx();
      await inRollbackTx(db, async () => {
        const { productId } = await makeFixtures(db);
        await actAs(db, userActor(outsiderSub));
        expect((await one<{ p: boolean }>(db, "select public.current_user_is_partner() as p")).p).toBe(false);
        const hidden = await db.query("select 1 from public.products where slug = 'uji-produk-tersembunyi'");
        expect(hidden.rows).toHaveLength(0);
        const rpc = await captureError(db, () =>
          db.query("select * from public.confirm_product_stock_price($1, $2, $3)", [productId, "5", "1000"]),
        );
        expect(rpc).toMatchObject({ code: "42501", message: "forbidden" });
        await resetActor(db);
        const row = await one<Row>(
          db,
          "select stock_kg::text as s, price_per_kg_idr as p, stock_price_confirmed_at::text as t from public.products where id = $1",
          [productId],
        );
        expect(row).toEqual({ s: "10.00", p: 32000, t: "2000-01-01 00:00:00+00" });
      });
    });

    it("UPDATE kolom yang diizinkan menghasilkan 0 baris (RLS); kolom/aksi lain ditolak", async () => {
      const { db, outsiderSub } = ctx();
      await inRollbackTx(db, async () => {
        const { articleId } = await makeFixtures(db);
        const before = await one<{ title: string }>(db, "select title from public.articles where slug = 'artikel-1'");
        const nameBefore = await one<{ n: string }>(db, "select business_name as n from public.site_settings");
        await actAs(db, userActor(outsiderSub));
        const art = await db.query("update public.articles set title = 'Diretas' where slug = 'artikel-1'");
        expect(art.rowCount).toBe(0);
        const name = await db.query("update public.site_settings set business_name = 'Diretas'");
        expect(name.rowCount).toBe(0);
        const denied = [
          () => db.query("update public.articles set slug = 'baru' where slug = 'artikel-1'"),
          () => db.query("update public.products set stock_kg = 1"),
          () => db.query("insert into public.articles (slug, title, body) values ('a-b', 'x', 'y')"),
          () => db.query("delete from public.articles where id = $1", [articleId]),
          () => db.query("insert into public.site_settings (id, business_name) values (false, 'Lain')"),
          () => db.query("select * from private.partner_admins"),
        ];
        for (const attempt of denied) {
          expect((await captureError(db, attempt))?.code).toBe("42501");
        }
        await resetActor(db);
        expect((await one<{ title: string }>(db, "select title from public.articles where slug = 'artikel-1'")).title).toBe(before.title);
        expect((await one<{ n: string }>(db, "select business_name as n from public.site_settings")).n).toBe(nameBefore.n);
      });
    });
  });

  describe(`${label} — mitra di allowlist`, () => {
    const partner = () => {
      const sub = ctx().partnerSub;
      if (!sub) throw new Error("Allowlist mitra kosong; kasus mitra tidak dapat dijalankan");
      return sub;
    };

    it("status mitra true dan dapat melihat data tersembunyi", async () => {
      const { db } = ctx();
      await inRollbackTx(db, async () => {
        await makeFixtures(db);
        await actAs(db, userActor(partner()));
        expect((await one<{ p: boolean }>(db, "select public.current_user_is_partner() as p")).p).toBe(true);
        const hidden = await db.query("select 1 from public.products where slug = 'uji-produk-tersembunyi'");
        expect(hidden.rows).toHaveLength(1);
      });
    });

    it("mengedit judul/isi artikel & nama usaha tidak mengubah waktu konfirmasi (AC-32, T-12)", async () => {
      const { db } = ctx();
      await inRollbackTx(db, async () => {
        const { productId, articleId } = await makeFixtures(db);
        await actAs(db, userActor(partner()));
        const art = await db.query(
          "update public.articles set title = 'Judul Baru', body = 'Isi baru' where id = $1",
          [articleId],
        );
        expect(art.rowCount).toBe(1);
        const name = await db.query("update public.site_settings set business_name = 'Nama Uji Baru'");
        expect(name.rowCount).toBe(1);
        await resetActor(db);
        const row = await one<{ title: string; touched: boolean }>(
          db,
          "select title, updated_at > '2000-01-01T00:00:00Z' as touched from public.articles where id = $1",
          [articleId],
        );
        expect(row).toEqual({ title: "Judul Baru", touched: true }); // trigger updated_at tetap jalan
        expect(await confirmedAt(db, productId)).toBe("2000-01-01 00:00:00+00");
      });
    });

    it("tidak dapat menambah/menghapus artikel atau mengubah kolom lain (AC-39, AC-48)", async () => {
      const { db } = ctx();
      await inRollbackTx(db, async () => {
        const { articleId } = await makeFixtures(db);
        const countBefore = await one<{ n: number }>(db, "select count(*)::int as n from public.articles");
        await actAs(db, userActor(partner()));
        const denied = [
          () => db.query("insert into public.articles (slug, title, body) values ('a-b', 'x', 'y')"),
          () => db.query("delete from public.articles where id = $1", [articleId]),
          () => db.query("update public.articles set slug = 'baru' where id = $1", [articleId]),
          () => db.query("update public.articles set is_published = true where id = $1", [articleId]),
          () => db.query("insert into public.site_settings (id, business_name) values (false, 'Lain')"),
          () => db.query("delete from public.site_settings where false"),
          () => db.query("update public.site_settings set updated_at = now()"),
          () => db.query("update public.products set stock_kg = 1, stock_price_confirmed_at = now()"),
          () => db.query("select * from private.partner_admins"),
          () => db.query("insert into private.partner_admins (user_id) values ($1)", [partner()]),
        ];
        for (const attempt of denied) {
          expect((await captureError(db, attempt))?.code).toBe("42501");
        }
        await resetActor(db);
        expect((await one<{ n: number }>(db, "select count(*)::int as n from public.articles")).n).toBe(countBefore.n);
      });
    });

    it("nama usaha tidak valid ditolak constraint (AC-47)", async () => {
      const { db } = ctx();
      await inRollbackTx(db, async () => {
        await actAs(db, userActor(partner()));
        for (const bad of ["A", " ", "Baris\nBaru", "x".repeat(81)]) {
          const error = await captureError(db, () =>
            db.query("update public.site_settings set business_name = $1", [bad]),
          );
          expect(error?.code, JSON.stringify(bad)).toBe("23514");
        }
      });
    });
  });

  describe(`${label} — RPC confirm_product_stock_price (AC-26, AC-28, AC-31, T-09, T-11)`, () => {
    const partner = () => {
      const sub = ctx().partnerSub;
      if (!sub) throw new Error("Allowlist mitra kosong; kasus mitra tidak dapat dijalankan");
      return sub;
    };

    async function confirm(db: Db, productId: string, stock: unknown, price: unknown) {
      return one<Row>(
        db,
        `select stock_kg::text as s, price_per_kg_idr as p,
                stock_price_confirmed_at = now() as at_now
           from public.confirm_product_stock_price($1, $2, $3)`,
        [productId, stock, price],
      );
    }

    it("menyimpan stok desimal & harga dengan waktu database", async () => {
      const { db } = ctx();
      await inRollbackTx(db, async () => {
        const { productId } = await makeFixtures(db);
        await actAs(db, userActor(partner()));
        expect(await confirm(db, productId, "12.5", "35000")).toEqual({ s: "12.50", p: 35000, at_now: true });
      });
    });

    it("konfirmasi ulang angka yang sama tetap memperbarui waktu (AC-31)", async () => {
      const { db } = ctx();
      await inRollbackTx(db, async () => {
        const { productId } = await makeFixtures(db); // stok 10, harga 32000, waktu 2000-01-01
        await actAs(db, userActor(partner()));
        expect(await confirm(db, productId, "10", "32000")).toEqual({ s: "10.00", p: 32000, at_now: true });
        await resetActor(db);
        expect(await confirmedAt(db, productId)).not.toBe("2000-01-01 00:00:00+00");
      });
    });

    it("nilai batas diterima: 0, 100000, Rp0, Rp10.000.000", async () => {
      const { db } = ctx();
      await inRollbackTx(db, async () => {
        const { productId } = await makeFixtures(db);
        await actAs(db, userActor(partner()));
        expect(await confirm(db, productId, "0", "0")).toMatchObject({ s: "0.00", p: 0 });
        expect(await confirm(db, productId, "100000", "10000000")).toMatchObject({ s: "100000.00", p: 10000000 });
      });
    });

    it.each([
      ["100000.01", "35000", "stock_out_of_range"],
      ["-0.01", "35000", "stock_out_of_range"],
      ["NaN", "35000", "stock_out_of_range"],
      ["Infinity", "35000", "stock_out_of_range"],
      ["-Infinity", "35000", "stock_out_of_range"],
      ["1.255", "35000", "stock_too_many_decimals"],
      ["12.5", "10000001", "price_out_of_range"],
      ["12.5", "-1", "price_out_of_range"],
      ["12.5", "NaN", "price_out_of_range"],
      ["12.5", "Infinity", "price_out_of_range"],
      ["12.5", "35000.5", "price_not_whole"],
      ["12.5", "35.50", "price_not_whole"],
      [null, "35000", "stock_price_required"],
      ["12.5", null, "stock_price_required"],
    ])("stok %s / harga %s ditolak (%s) tanpa perubahan data", async (stock, price, key) => {
      const { db } = ctx();
      await inRollbackTx(db, async () => {
        const { productId } = await makeFixtures(db);
        await actAs(db, userActor(partner()));
        const error = await captureError(db, () => confirm(db, productId, stock, price));
        expect(error).toMatchObject({ code: "22023", message: key });
        await resetActor(db);
        const row = await one<Row>(
          db,
          "select stock_kg::text as s, price_per_kg_idr as p, stock_price_confirmed_at::text as t from public.products where id = $1",
          [productId],
        );
        expect(row).toEqual({ s: "10.00", p: 32000, t: "2000-01-01 00:00:00+00" });
      });
    });

    it("produk tidak ada → P0002; product_id NULL → product_required", async () => {
      const { db } = ctx();
      await inRollbackTx(db, async () => {
        await actAs(db, userActor(partner()));
        const missing = await captureError(db, () =>
          confirm(db, "00000000-0000-4000-8000-000000000000", "1", "1"),
        );
        expect(missing).toMatchObject({ code: "P0002", message: "product_not_found" });
        const nul = await captureError(db, () => confirm(db, null as unknown as string, "1", "1"));
        expect(nul).toMatchObject({ code: "22023", message: "product_required" });
      });
    });
  });

  describe(`${label} — constraint sebagai jaring kedua (§10.5)`, () => {
    it.each([
      ["stock_kg = 100000.01", "products_stock_kg_range"],
      ["stock_kg = -1", "products_stock_kg_range"],
      ["stock_kg = 'NaN'", "products_stock_kg_range"],
      ["price_per_kg_idr = 10000001", "products_price_per_kg_idr_range"],
      ["price_per_kg_idr = -1", "products_price_per_kg_idr_range"],
    ])("UPDATE langsung oleh pemilik: %s ditolak %s", async (assignment, constraint) => {
      const { db } = ctx();
      await inRollbackTx(db, async () => {
        const { productId } = await makeFixtures(db);
        const error = await captureError(db, () =>
          db.query(`update public.products set ${assignment} where id = $1`, [productId]),
        );
        expect(error?.code).toBe("23514");
        expect(error?.message).toContain(constraint);
      });
    });

    it("angka tanpa waktu konfirmasi ditolak", async () => {
      const { db } = ctx();
      await inRollbackTx(db, async () => {
        const error = await captureError(db, () =>
          db.query(
            "insert into public.products (slug, name, stock_kg) values ('uji-tanpa-waktu', 'Uji', 1)",
          ),
        );
        expect(error?.code).toBe("23514");
        expect(error?.message).toContain("products_confirmed_at_integrity");
      });
    });
  });

  describe(`${label} — paket katalog (PRD §12.8, AC-53–AC-60)`, () => {
    const partner = () => {
      const sub = ctx().partnerSub;
      if (!sub) throw new Error("Allowlist mitra kosong; kasus mitra tidak dapat dijalankan");
      return sub;
    };
    const PKG_ID = "22222222-2222-4222-8222-222222222222";
    const PKG_HIDDEN = "33333333-3333-4333-8333-333333333333";

    /** Produk terbit (ikan-nila dari data awal) + produk tersembunyi, masing-masing satu paket. */
    async function packageFixtures(db: Db) {
      const { productId: hiddenProductId } = await makeFixtures(db);
      const published = await one<{ id: string }>(db, "select id from public.products where slug = 'ikan-nila'");
      await db.query(
        `update public.products set stock_kg = 50, price_per_kg_idr = 35000,
                stock_price_confirmed_at = '2000-01-01T00:00:00Z' where id = $1`,
        [published.id],
      );
      await db.query(
        `insert into public.product_packages (id, product_id, name, weight_kg, price_total_idr)
         values ($1, $2, 'Paket Uji Terbit', 10, 320000), ($3, $4, 'Paket Uji Tersembunyi', 5, 150000)`,
        [PKG_ID, published.id, PKG_HIDDEN, hiddenProductId],
      );
      return { publishedId: published.id, hiddenProductId };
    }

    async function productSnapshot(db: Db, productId: string) {
      return one<Row>(
        db,
        `select stock_kg::text as s, price_per_kg_idr as p, stock_price_confirmed_at::text as t
           from public.products where id = $1`,
        [productId],
      );
    }

    const CREATE = "select * from public.create_product_package(gen_random_uuid(), $1, 'x', 1, 1)";

    it("anon hanya melihat paket milik produk terbit", async () => {
      const { db } = ctx();
      await inRollbackTx(db, async () => {
        await packageFixtures(db);
        await actAs(db, ANON);
        const rows = await db.query<{ name: string }>("select name from public.product_packages order by name");
        expect(rows.rows.map((r) => r.name)).toEqual(["Paket Uji Terbit"]);
      });
    });

    it("anon tidak dapat menulis tabel paket atau memanggil RPC paket", async () => {
      const { db } = ctx();
      await inRollbackTx(db, async () => {
        const { publishedId } = await packageFixtures(db);
        await actAs(db, ANON);
        const attempts = [
          () =>
            db.query(
              "insert into public.product_packages (product_id, name, weight_kg, price_total_idr) values ($1, 'x', 1, 1)",
              [publishedId],
            ),
          () => db.query("update public.product_packages set price_total_idr = 1 where id = $1", [PKG_ID]),
          () => db.query("delete from public.product_packages where id = $1", [PKG_ID]),
          ...(db.kind === "pglite" ? [() => db.query("truncate public.product_packages")] : []),
          () => db.query(CREATE, [publishedId]),
          () => db.query("select * from public.update_product_package($1, 'x', 1, 1)", [PKG_ID]),
          () => db.query("select * from public.delete_product_package($1)", [PKG_ID]),
        ];
        for (const attempt of attempts) {
          expect((await captureError(db, attempt))?.code).toBe("42501");
        }
      });
    });

    it("akun non-mitra: baca hanya paket terbit; RPC paket ditolak 'forbidden'; data tetap", async () => {
      const { db, outsiderSub } = ctx();
      await inRollbackTx(db, async () => {
        const { publishedId } = await packageFixtures(db);
        await actAs(db, userActor(outsiderSub));
        const rows = await db.query<{ name: string }>("select name from public.product_packages");
        expect(rows.rows.map((r) => r.name)).toEqual(["Paket Uji Terbit"]);
        for (const attempt of [
          () => db.query(CREATE, [publishedId]),
          () => db.query("select * from public.update_product_package($1, 'Diretas', 1, 1)", [PKG_ID]),
          () => db.query("select * from public.delete_product_package($1)", [PKG_ID]),
        ]) {
          expect(await captureError(db, attempt)).toMatchObject({ code: "42501", message: "forbidden" });
        }
        for (const attempt of [
          () => db.query("update public.product_packages set name = 'Diretas'"),
          () => db.query("delete from public.product_packages where id = $1", [PKG_ID]),
        ]) {
          expect((await captureError(db, attempt))?.code).toBe("42501");
        }
        await resetActor(db);
        const count = await one<{ n: number }>(
          db,
          "select count(*)::int as n from public.product_packages where name like 'Paket Uji%'",
        );
        expect(count.n).toBe(2);
      });
    });

    it("mitra: tambah, ubah, hapus lewat RPC; nama dirapikan; tulis langsung ke tabel tetap ditolak", async () => {
      const { db } = ctx();
      await inRollbackTx(db, async () => {
        const { publishedId } = await packageFixtures(db);
        await actAs(db, userActor(partner()));
        const id = "44444444-4444-4444-8444-444444444444";
        const created = await one<Row>(
          db,
          "select name, weight_kg::text as w, price_total_idr as p from public.create_product_package($1, $2, $3, $4, $5)",
          [id, publishedId, "  Paket   Hemat  100 kg ", "100", "3100000"],
        );
        expect(created).toEqual({ name: "Paket Hemat 100 kg", w: "100.00", p: 3100000 });

        const updated = await one<Row>(
          db,
          "select name, weight_kg::text as w, price_total_idr as p from public.update_product_package($1, $2, $3, $4)",
          [id, "Paket Grosir", "12.5", "400000"],
        );
        expect(updated).toEqual({ name: "Paket Grosir", w: "12.50", p: 400000 });

        const removed = await one<{ id: string }>(db, "select id from public.delete_product_package($1)", [id]);
        expect(removed.id).toBe(id);
        const again = await captureError(db, () => db.query("select * from public.delete_product_package($1)", [id]));
        expect(again).toMatchObject({ code: "P0002", message: "package_not_found" });

        for (const attempt of [
          () =>
            db.query(
              "insert into public.product_packages (product_id, name, weight_kg, price_total_idr) values ($1, 'x', 1, 1)",
              [publishedId],
            ),
          () => db.query("update public.product_packages set price_total_idr = 1 where id = $1", [PKG_ID]),
          () => db.query("delete from public.product_packages where id = $1", [PKG_ID]),
        ]) {
          expect((await captureError(db, attempt))?.code).toBe("42501");
        }
      });
    });

    it("mitra: kirim ulang 'tambah' dengan id yang sama TIDAK membuat paket ganda", async () => {
      const { db } = ctx();
      await inRollbackTx(db, async () => {
        const { publishedId } = await packageFixtures(db);
        await actAs(db, userActor(partner()));
        const id = "55555555-5555-4555-8555-555555555555";
        const sql = "select id, updated_at::text as u from public.create_product_package($1, $2, $3, $4, $5)";
        const args = [id, publishedId, "Paket 20 kg", "20", "600000"];
        const first = await one<{ id: string; u: string }>(db, sql, args);
        const replay = await one<{ id: string; u: string }>(db, sql, args);
        expect(replay).toEqual(first);
        const count = await one<{ n: number }>(
          db,
          "select count(*)::int as n from public.product_packages where id = $1",
          [id],
        );
        expect(count.n).toBe(1);
        const conflict = await captureError(db, () => db.query(sql, [id, publishedId, "Paket Lain", "20", "600000"]));
        expect(conflict).toMatchObject({ code: "23505", message: "package_id_conflict" });
      });
    });

    it("CRUD paket tidak mengubah stok, harga satuan, atau waktu konfirmasi produk", async () => {
      const { db } = ctx();
      await inRollbackTx(db, async () => {
        const { publishedId } = await packageFixtures(db);
        const before = await productSnapshot(db, publishedId);
        await actAs(db, userActor(partner()));
        const id = "66666666-6666-4666-8666-666666666666";
        await db.query("select * from public.create_product_package($1, $2, 'Paket A', 10, 300000)", [id, publishedId]);
        await db.query("select * from public.update_product_package($1, 'Paket B', 15, 450000)", [id]);
        await db.query("select * from public.delete_product_package($1)", [id]);
        await resetActor(db);
        expect(await productSnapshot(db, publishedId)).toEqual(before);
        expect(before).toEqual({ s: "50.00", p: 35000, t: "2000-01-01 00:00:00+00" });
      });
    });

    it("mengubah harga satuan produk tidak menimpa harga total paket", async () => {
      const { db } = ctx();
      await inRollbackTx(db, async () => {
        const { publishedId } = await packageFixtures(db);
        await actAs(db, userActor(partner()));
        await db.query("select * from public.confirm_product_stock_price($1, '50', '40000')", [publishedId]);
        const pkg = await one<{ p: number }>(
          db,
          "select price_total_idr as p from public.product_packages where id = $1",
          [PKG_ID],
        );
        expect(pkg.p).toBe(320000);
      });
    });

    it.each([
      ["0", "100", "package_weight_out_of_range"],
      ["-1", "100", "package_weight_out_of_range"],
      ["10000.01", "100", "package_weight_out_of_range"],
      ["NaN", "100", "package_weight_out_of_range"],
      ["Infinity", "100", "package_weight_out_of_range"],
      ["1.255", "100", "package_weight_too_many_decimals"],
      [null, "100", "package_weight_required"],
      ["10", "-1", "package_price_out_of_range"],
      ["10", "1000000001", "package_price_out_of_range"],
      ["10", "NaN", "package_price_out_of_range"],
      ["10", "3100000.5", "package_price_not_whole"],
      ["10", null, "package_price_required"],
    ])("berat %s / harga %s ditolak (%s), tidak dibulatkan", async (weight, price, key) => {
      const { db } = ctx();
      await inRollbackTx(db, async () => {
        const { publishedId } = await packageFixtures(db);
        await actAs(db, userActor(partner()));
        const createError = await captureError(db, () =>
          db.query("select * from public.create_product_package(gen_random_uuid(), $1, 'Paket', $2, $3)", [
            publishedId,
            weight,
            price,
          ]),
        );
        expect(createError).toMatchObject({ code: "22023", message: key });
        const updateError = await captureError(db, () =>
          db.query("select * from public.update_product_package($1, 'Paket', $2, $3)", [PKG_ID, weight, price]),
        );
        expect(updateError).toMatchObject({ code: "22023", message: key });
      });
    });

    it.each([
      ["", "package_name_required"],
      ["   ", "package_name_required"],
      ["Baris\nBaru", "package_name_line_break"],
      ["x".repeat(61), "package_name_too_long"],
    ])("nama %j ditolak (%s)", async (name, key) => {
      const { db } = ctx();
      await inRollbackTx(db, async () => {
        const { publishedId } = await packageFixtures(db);
        await actAs(db, userActor(partner()));
        const error = await captureError(db, () =>
          db.query("select * from public.create_product_package(gen_random_uuid(), $1, $2, 10, 100)", [
            publishedId,
            name,
          ]),
        );
        expect(error).toMatchObject({ code: "22023", message: key });
      });
    });

    it("batas diterima: berat 0,01 & 10000 kg, harga Rp0 & Rp1.000.000.000", async () => {
      const { db } = ctx();
      await inRollbackTx(db, async () => {
        const { publishedId } = await packageFixtures(db);
        await actAs(db, userActor(partner()));
        const sql =
          "select weight_kg::text as w, price_total_idr as p from public.create_product_package(gen_random_uuid(), $1, 'Batas', $2, $3)";
        expect(await one<Row>(db, sql, [publishedId, "0.01", "0"])).toEqual({ w: "0.01", p: 0 });
        expect(await one<Row>(db, sql, [publishedId, "10000", "1000000000"])).toEqual({ w: "10000.00", p: 1000000000 });
      });
    });

    it("produk/paket tidak ada → P0002", async () => {
      const { db } = ctx();
      await inRollbackTx(db, async () => {
        await actAs(db, userActor(partner()));
        const missingProduct = await captureError(db, () =>
          db.query(
            "select * from public.create_product_package(gen_random_uuid(), '00000000-0000-4000-8000-000000000000', 'x', 1, 1)",
          ),
        );
        expect(missingProduct).toMatchObject({ code: "P0002", message: "product_not_found" });
        const missingPackage = await captureError(db, () =>
          db.query("select * from public.update_product_package('00000000-0000-4000-8000-000000000000', 'x', 1, 1)"),
        );
        expect(missingPackage).toMatchObject({ code: "P0002", message: "package_not_found" });
      });
    });

    it.each([
      ["'x', 0, 1", "product_packages_weight_range"],
      ["'x', 'NaN', 1", "product_packages_weight_range"],
      ["'x', 1, -1", "product_packages_price_range"],
      ["'   ', 1, 1", "product_packages_name_check"],
    ])("tulis langsung oleh pemilik (%s) ditolak constraint %s", async (values, constraint) => {
      const { db } = ctx();
      await inRollbackTx(db, async () => {
        const { publishedId } = await packageFixtures(db);
        const error = await captureError(db, () =>
          db.query(
            `insert into public.product_packages (product_id, name, weight_kg, price_total_idr) values ($1, ${values})`,
            [publishedId],
          ),
        );
        expect(error?.code).toBe("23514");
        expect(error?.message).toContain(constraint);
      });
    });
  });

  describe(`${label} — RPC update_product_photo`, () => {
    const partner = () => {
      const sub = ctx().partnerSub;
      if (!sub) throw new Error("Allowlist mitra kosong; kasus mitra tidak dapat dijalankan");
      return sub;
    };

    it("anon tidak dapat memanggil update_product_photo", async () => {
      const { db } = ctx();
      await inRollbackTx(db, async () => {
        const { productId } = await makeFixtures(db);
        await actAs(db, ANON);
        const err = await captureError(db, () =>
          db.query("select * from public.update_product_photo($1, 'data:image/png;base64,test', 'Alt')", [productId]),
        );
        expect(err?.code).toBe("42501");
      });
    });

    it("akun non-mitra ditolak forbidden", async () => {
      const { db, outsiderSub } = ctx();
      await inRollbackTx(db, async () => {
        const { productId } = await makeFixtures(db);
        await actAs(db, userActor(outsiderSub));
        const err = await captureError(db, () =>
          db.query("select * from public.update_product_photo($1, 'data:image/png;base64,test', 'Alt')", [productId]),
        );
        expect(err).toMatchObject({ code: "42501", message: "forbidden" });
      });
    });

    it("mitra dapat memperbarui foto produk dan menghapus foto tanpa mengubah stock_price_confirmed_at", async () => {
      const { db } = ctx();
      await inRollbackTx(db, async () => {
        const { productId } = await makeFixtures(db);
        const prevConfirmedAt = await confirmedAt(db, productId);
        await actAs(db, userActor(partner()));

        const res = await one<{ image_path: string; image_alt: string }>(
          db,
          "select image_path, image_alt from public.update_product_photo($1, 'data:image/png;base64,abc', 'Foto Nila')",
          [productId],
        );
        expect(res).toEqual({ image_path: "data:image/png;base64,abc", image_alt: "Foto Nila" });
        expect(await confirmedAt(db, productId)).toBe(prevConfirmedAt);

        const removed = await one<{ image_path: string | null; image_alt: string | null }>(
          db,
          "select image_path, image_alt from public.update_product_photo($1, null, null)",
          [productId],
        );
        expect(removed).toEqual({ image_path: null, image_alt: null });
        expect(await confirmedAt(db, productId)).toBe(prevConfirmedAt);
      });
    });
  });
}
