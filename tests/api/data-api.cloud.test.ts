/**
 * Uji hak akses lewat Data API Supabase SUNGGUHAN (PostgREST + Auth), dengan sesi pengguna yang sesuai:
 * anon (publishable key), akun login non-mitra, dan akun mitra (PRD AC-17, AC-20–AC-22, AC-39, AC-48).
 *
 * Hanya untuk dev/staging terverifikasi (tests/support/cloud-target.ts). TIDAK memakai service-role key.
 * Pengamanan data:
 * - Uji penolakan menulis nilai yang SAMA dengan yang sudah tersimpan, sehingga isi tidak berubah
 *   walaupun keamanan ternyata bocor (uji tetap gagal karena baris ikut terubah).
 * - Signup tidak dicoba sungguhan; yang diuji adalah pengaturan `disable_signup`.
 * - Uji RPC positif memakai produk uji TERSEMBUNYI yang dibuat lewat saluran fixture (SUPABASE_DB_URL, atau
 *   Management API dengan SUPABASE_ACCESS_TOKEN; lihat tests/support/cloud-fixture.ts) lalu dihapus di
 *   afterAll. Tanpa keduanya, uji itu dilewati.
 * - Login membuat sesi di Auth (metadata login berubah). Karena itu hanya untuk dev/staging.
 */
import { randomUUID } from "node:crypto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { connectFixtureDb, type FixtureDb } from "../support/cloud-fixture";
import { resolveCloudTarget, type CloudTarget } from "../support/cloud-target";

const resolved = resolveCloudTarget();

function client(target: CloudTarget): SupabaseClient {
  return createClient(target.supabaseUrl, target.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

if (!resolved.ok) {
  describe("Data API cloud", () => {
    it.skip(`DILEWATI: ${resolved.reasons.join("; ")}`, () => {});
  });
} else {
  const target = resolved.target;
  const anon = client(target);
  const outsider = client(target);
  const partner = client(target);
  let outsiderReady = false;
  let partnerReady = false;
  let fixtureDb: FixtureDb | null = null;
  let fixtureProductId: string | null = null;

  beforeAll(async () => {
    if (target.outsider) {
      const { error } = await outsider.auth.signInWithPassword(target.outsider);
      outsiderReady = !error;
    }
    if (target.partner) {
      const { error } = await partner.auth.signInWithPassword(target.partner);
      partnerReady = !error;
    }
    fixtureDb = await connectFixtureDb(target);
    if (fixtureDb) {
      const slug = `uji-api-${randomUUID().slice(0, 8)}`;
      const created = await fixtureDb.query<{ id: string }>(
        "insert into public.products (slug, name, is_published) values ($1, 'Produk Uji API', false) returning id",
        [slug],
      );
      fixtureProductId = created.rows[0]?.id ?? null;
    }
  });

  afterAll(async () => {
    try {
      if (fixtureDb && fixtureProductId) {
        await fixtureDb.query("delete from public.products where id = $1 and is_published = false", [fixtureProductId]);
      }
    } finally {
      await fixtureDb?.close();
      await outsider.auth.signOut().catch(() => {});
      await partner.auth.signOut().catch(() => {});
    }
  });

  async function currentArticleTitle(): Promise<string> {
    const { data, error } = await anon.from("articles").select("title").eq("slug", "artikel-1").single();
    if (error) throw new Error(`Gagal membaca artikel-1: ${error.code}`);
    return data.title as string;
  }

  async function currentBusinessName(): Promise<string> {
    const { data, error } = await anon.from("site_settings").select("business_name").single();
    if (error) throw new Error(`Gagal membaca site_settings: ${error.code}`);
    return data.business_name as string;
  }

  describe(`Data API cloud (${target.targetEnv}) — konfigurasi Auth`, () => {
    it("registrasi publik dimatikan (AC-22), diperiksa tanpa mendaftarkan akun", async () => {
      const response = await fetch(`${target.supabaseUrl}/auth/v1/settings`, {
        headers: { apikey: target.publishableKey },
      });
      expect(response.status).toBe(200);
      const settings = (await response.json()) as { disable_signup?: boolean };
      expect(settings.disable_signup, "Matikan 'Allow new users to sign up' di Dashboard → Authentication").toBe(true);
    });
  });

  describe(`Data API cloud (${target.targetEnv}) — anon`, () => {
    it("membaca produk, artikel, dan nama usaha yang terbit", async () => {
      const products = await anon.from("products").select("slug, is_published");
      expect(products.error).toBeNull();
      expect(products.data?.every((p) => p.is_published === true)).toBe(true);
      const settings = await anon.from("site_settings").select("business_name");
      expect(settings.error).toBeNull();
      expect(settings.data).toHaveLength(1);
    });

    it("tidak dapat memanggil RPC atau mengecek status mitra", async () => {
      const status = await anon.rpc("current_user_is_partner");
      expect(status.error?.code).toBe("42501");
      const confirm = await anon.rpc("confirm_product_stock_price", {
        p_product_id: randomUUID(),
        p_stock_kg: 1,
        p_price_per_kg_idr: 1,
      });
      expect(confirm.error?.code).toBe("42501");
    });

    it("tidak dapat menulis (nilai yang sama dikirim agar isi tidak berubah)", async () => {
      const title = await currentArticleTitle();
      const update = await anon.from("articles").update({ title }).eq("slug", "artikel-1").select("id");
      expect(update.error?.code).toBe("42501");
      const name = await currentBusinessName();
      const settings = await anon.from("site_settings").update({ business_name: name }).eq("id", true).select("id");
      expect(settings.error?.code).toBe("42501");
      const remove = await anon.from("articles").delete().eq("slug", "slug-yang-tidak-ada");
      expect(remove.error?.code).toBe("42501");
    });

    it("schema private tidak diekspos Data API", async () => {
      const response = await fetch(`${target.supabaseUrl}/rest/v1/partner_admins?select=user_id`, {
        headers: { apikey: target.publishableKey, Authorization: `Bearer ${target.publishableKey}` },
      });
      expect(response.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe(`Data API cloud (${target.targetEnv}) — akun non-mitra`, () => {
    it("login berhasil (prasyarat)", () => {
      expect(target.outsider, "E2E_OUTSIDER_EMAIL/PASSWORD belum diisi").not.toBeNull();
      expect(outsiderReady, "Akun E2E non-mitra tidak dapat login di proyek ini").toBe(true);
    });

    it("status mitra false; RPC ditolak; UPDATE menghasilkan 0 baris", async () => {
      if (!outsiderReady) return;
      const status = await outsider.rpc("current_user_is_partner");
      expect(status.data).toBe(false);
      const confirm = await outsider.rpc("confirm_product_stock_price", {
        p_product_id: fixtureProductId ?? randomUUID(),
        p_stock_kg: 1,
        p_price_per_kg_idr: 1,
      });
      expect(confirm.error).toMatchObject({ code: "42501", message: "forbidden" });
      const title = await currentArticleTitle();
      const update = await outsider.from("articles").update({ title }).eq("slug", "artikel-1").select("id");
      expect(update.error).toBeNull();
      expect(update.data).toEqual([]);
      const name = await currentBusinessName();
      const settings = await outsider
        .from("site_settings")
        .update({ business_name: name })
        .eq("id", true)
        .select("id");
      expect(settings.data).toEqual([]);
      const insert = await outsider.from("articles").insert({ slug: "uji-tidak-boleh", title: "x", body: "y" });
      expect(insert.error?.code).toBe("42501");
    });
  });

  describe(`Data API cloud (${target.targetEnv}) — akun mitra`, () => {
    it("login berhasil dan akun ada di allowlist (prasyarat)", async () => {
      expect(target.partner, "E2E_PARTNER_EMAIL/PASSWORD belum diisi").not.toBeNull();
      expect(partnerReady, "Akun E2E mitra tidak dapat login di proyek ini").toBe(true);
      const status = await partner.rpc("current_user_is_partner");
      expect(status.data, "Akun E2E mitra tidak terdaftar di private.partner_admins").toBe(true);
    });

    it("dapat UPDATE judul artikel & nama usaha (nilai sama), tidak dapat tambah/hapus", async () => {
      if (!partnerReady) return;
      const title = await currentArticleTitle();
      const update = await partner.from("articles").update({ title }).eq("slug", "artikel-1").select("id");
      expect(update.error).toBeNull();
      expect(update.data).toHaveLength(1);
      const name = await currentBusinessName();
      const settings = await partner.from("site_settings").update({ business_name: name }).eq("id", true).select("id");
      expect(settings.data).toHaveLength(1);
      const slug = await partner.from("articles").update({ slug: "artikel-1" }).eq("slug", "artikel-1");
      expect(slug.error?.code).toBe("42501");
      const insert = await partner.from("articles").insert({ slug: "uji-tidak-boleh", title: "x", body: "y" });
      expect(insert.error?.code).toBe("42501");
      const remove = await partner.from("articles").delete().eq("slug", "slug-yang-tidak-ada");
      expect(remove.error?.code).toBe("42501");
    });

    it("RPC menolak nilai di luar aturan tanpa mengubah data", async () => {
      if (!partnerReady) return;
      const productId = fixtureProductId ?? randomUUID();
      for (const [stock, price, key] of [
        [100000.01, 35000, "stock_out_of_range"],
        [1.255, 35000, "stock_too_many_decimals"],
        [12.5, 35000.5, "price_not_whole"],
        [12.5, 10000001, "price_out_of_range"],
      ] as const) {
        const result = await partner.rpc("confirm_product_stock_price", {
          p_product_id: productId,
          p_stock_kg: stock,
          p_price_per_kg_idr: price,
        });
        expect(result.error, `${stock}/${price}`).toMatchObject({ code: "22023", message: key });
      }
    });

    it("RPC menyimpan & konfirmasi ulang pada produk uji tersembunyi (AC-26, AC-31)", async ({ skip }) => {
      if (!partnerReady) return;
      if (!fixtureProductId) skip("tidak ada saluran fixture (SUPABASE_DB_URL / SUPABASE_ACCESS_TOKEN): produk uji terisolasi tidak dapat dibuat");
      const first = await partner.rpc("confirm_product_stock_price", {
        p_product_id: fixtureProductId,
        p_stock_kg: "12.5",
        p_price_per_kg_idr: 35000,
      });
      expect(first.error).toBeNull();
      expect(first.data).toMatchObject({ stock_kg: 12.5, price_per_kg_idr: 35000 });
      const second = await partner.rpc("confirm_product_stock_price", {
        p_product_id: fixtureProductId,
        p_stock_kg: "12.5",
        p_price_per_kg_idr: 35000,
      });
      expect(second.error).toBeNull();
      const t1 = Date.parse(first.data.stock_price_confirmed_at as string);
      const t2 = Date.parse(second.data.stock_price_confirmed_at as string);
      expect(t2).toBeGreaterThan(t1);
    });
  });
}
