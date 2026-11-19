/**
 * Uji hak akses & aturan PAKET KATALOG lewat Data API Supabase SUNGGUHAN (PRD §12.8, AC-53–AC-58).
 *
 * Hanya untuk dev/staging terverifikasi (tests/support/cloud-target.ts). TIDAK memakai service-role key.
 *
 * Pengelolaan data uji (operasi Data API TIDAK ikut rollback):
 * - Sebagian besar kasus memakai produk uji TERSEMBUNYI (slug `uji-paket-…`) yang dibuat lewat saluran
 *   fixture (tests/support/cloud-fixture.ts) dan dihapus di afterAll (paket ikut terhapus oleh FK cascade).
 * - Satu kasus membuat paket sementara pada produk TERBIT untuk membuktikan bacaan publik. Namanya diawali
 *   `UJI-API-`, ID-nya dilacak, dan dihapus di blok `finally` serta disapu lagi di afterAll.
 * - Produk terbit dibandingkan sebelum/sesudah (stok, harga, waktu konfirmasi, updated_at) dan daftar ID
 *   paketnya harus sama seperti semula: tidak ada paket contoh yang tertinggal.
 * - Hanya baris yang dibuat proses ini yang dihapus.
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
  describe("Paket katalog — Data API cloud", () => {
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
  let hiddenProductId: string | null = null;
  let publishedProductId: string | null = null;
  let seedPackageId: string | null = null;
  const publishedBefore: { snapshot: unknown; packageIds: string[] } = { snapshot: null, packageIds: [] };
  const createdOnPublished = new Set<string>();

  const productSnapshot = async (id: string) => {
    const { data, error } = await partner
      .from("products")
      .select("stock_kg, price_per_kg_idr, stock_price_confirmed_at, updated_at")
      .eq("id", id)
      .single();
    if (error) throw new Error(`Gagal membaca produk: ${error.code}`);
    return data;
  };

  const packageIdsOf = async (productId: string): Promise<string[]> => {
    const { data, error } = await partner.from("product_packages").select("id").eq("product_id", productId).order("id");
    if (error) throw new Error(`Gagal membaca paket: ${error.code}`);
    return (data ?? []).map((row) => row.id as string);
  };

  const create = (
    who: SupabaseClient,
    productId: string,
    over: Partial<{ id: string; name: string; weight: unknown; price: unknown }> = {},
  ) =>
    who.rpc("create_product_package", {
      p_id: over.id ?? randomUUID(),
      p_product_id: productId,
      p_name: over.name ?? "UJI-API Paket",
      p_weight_kg: over.weight ?? "10",
      p_price_total_idr: over.price ?? 320000,
    });

  beforeAll(async () => {
    if (target.outsider) outsiderReady = !(await outsider.auth.signInWithPassword(target.outsider)).error;
    if (target.partner) partnerReady = !(await partner.auth.signInWithPassword(target.partner)).error;

    const published = await anon.from("products").select("id").eq("slug", "ikan-nila").single();
    publishedProductId = (published.data?.id as string | undefined) ?? null;
    if (partnerReady && publishedProductId) {
      publishedBefore.snapshot = await productSnapshot(publishedProductId);
      publishedBefore.packageIds = await packageIdsOf(publishedProductId);
    }

    fixtureDb = await connectFixtureDb(target);
    if (fixtureDb) {
      const slug = `uji-paket-${randomUUID().slice(0, 8)}`;
      const created = await fixtureDb.query<{ id: string }>(
        "insert into public.products (slug, name, is_published) values ($1, 'Produk Uji Paket', false) returning id",
        [slug],
      );
      hiddenProductId = created.rows[0]?.id ?? null;
    }
    if (partnerReady && hiddenProductId) {
      seedPackageId = randomUUID();
      const seeded = await create(partner, hiddenProductId, { id: seedPackageId, name: "UJI-API Benih" });
      if (seeded.error) seedPackageId = null;
    }
  });

  afterAll(async () => {
    try {
      // Sapu paket sementara pada produk terbit (hanya ID yang dibuat proses ini).
      for (const id of createdOnPublished) {
        await partner.rpc("delete_product_package", { p_id: id });
      }
      if (fixtureDb && hiddenProductId) {
        // Paket uji ikut terhapus (FK cascade). Hanya produk uji tersembunyi yang dibuat proses ini.
        await fixtureDb.query("delete from public.products where id = $1 and is_published = false", [hiddenProductId]);
      }
    } finally {
      await fixtureDb?.close();
      await outsider.auth.signOut().catch(() => {});
      await partner.auth.signOut().catch(() => {});
    }
  });

  const needsHidden = (skip: (note?: string) => never) => {
    if (!hiddenProductId) skip("tidak ada saluran fixture: produk uji tersembunyi tidak dapat dibuat");
    return hiddenProductId as string;
  };

  describe(`Paket katalog cloud (${target.targetEnv}) — anon`, () => {
    it("tidak dapat memanggil RPC tambah/ubah/hapus paket", async () => {
      const productId = publishedProductId ?? randomUUID();
      expect((await create(anon, productId)).error?.code).toBe("42501");
      const update = await anon.rpc("update_product_package", {
        p_id: randomUUID(),
        p_name: "x",
        p_weight_kg: "1",
        p_price_total_idr: 1,
      });
      expect(update.error?.code).toBe("42501");
      expect((await anon.rpc("delete_product_package", { p_id: randomUUID() })).error?.code).toBe("42501");
    });

    it("tidak dapat menulis tabel paket secara langsung", async () => {
      const productId = publishedProductId ?? randomUUID();
      const insert = await anon
        .from("product_packages")
        .insert({ product_id: productId, name: "UJI-API Langsung", weight_kg: 1, price_total_idr: 1 });
      expect(insert.error?.code).toBe("42501");
      const update = await anon.from("product_packages").update({ price_total_idr: 1 }).eq("id", randomUUID());
      expect(update.error?.code).toBe("42501");
      const remove = await anon.from("product_packages").delete().eq("id", randomUUID());
      expect(remove.error?.code).toBe("42501");
    });

    it("paket milik produk yang TIDAK terbit tidak dapat dibaca publik", async ({ skip }) => {
      needsHidden(skip);
      if (!seedPackageId) skip("paket benih tidak dapat dibuat (mitra belum siap)");
      const byId = await anon.from("product_packages").select("id").eq("id", seedPackageId);
      expect(byId.error).toBeNull();
      expect(byId.data).toEqual([]);
      const all = await anon.from("product_packages").select("id, name");
      expect(all.error).toBeNull();
      expect(all.data?.some((row) => String(row.name).startsWith("UJI-API Benih"))).toBe(false);
    });

    it("paket milik produk TERBIT dapat dibaca publik, lalu dibersihkan", async ({ skip }) => {
      if (!partnerReady || !publishedProductId) skip("mitra/produk terbit tidak tersedia");
      const id = randomUUID();
      createdOnPublished.add(id);
      try {
        const made = await create(partner, publishedProductId as string, { id, name: "UJI-API Terbit", weight: "10", price: 320000 });
        expect(made.error).toBeNull();
        const read = await anon.from("product_packages").select("id, name, weight_kg, price_total_idr").eq("id", id);
        expect(read.error).toBeNull();
        expect(read.data).toHaveLength(1);
        expect(read.data?.[0]).toMatchObject({ name: "UJI-API Terbit", price_total_idr: 320000 });
        expect(Number(read.data?.[0]?.weight_kg)).toBe(10);
      } finally {
        const removed = await partner.rpc("delete_product_package", { p_id: id });
        if (!removed.error) createdOnPublished.delete(id);
      }
    });
  });

  describe(`Paket katalog cloud (${target.targetEnv}) — akun non-mitra`, () => {
    it("login berhasil (prasyarat)", () => {
      expect(outsiderReady, "Akun E2E non-mitra tidak dapat login di proyek ini").toBe(true);
    });

    it("RPC ditolak 'forbidden'; tulis langsung ditolak; paket tersembunyi tidak terbaca; data tetap", async ({ skip }) => {
      if (!outsiderReady) return;
      const productId = needsHidden(skip);
      if (!seedPackageId) skip("paket benih tidak dapat dibuat");
      const before = await packageIdsOf(productId);

      expect((await create(outsider, productId)).error).toMatchObject({ code: "42501", message: "forbidden" });
      const update = await outsider.rpc("update_product_package", {
        p_id: seedPackageId,
        p_name: "Diretas",
        p_weight_kg: "1",
        p_price_total_idr: 1,
      });
      expect(update.error).toMatchObject({ code: "42501", message: "forbidden" });
      expect((await outsider.rpc("delete_product_package", { p_id: seedPackageId })).error).toMatchObject({
        code: "42501",
        message: "forbidden",
      });

      const direct = await outsider.from("product_packages").update({ price_total_idr: 1 }).eq("id", seedPackageId);
      expect(direct.error?.code).toBe("42501");
      expect((await outsider.from("product_packages").delete().eq("id", seedPackageId)).error?.code).toBe("42501");
      expect((await outsider.from("product_packages").select("id").eq("id", seedPackageId)).data).toEqual([]);

      expect(await packageIdsOf(productId)).toEqual(before);
      const seed = await partner.from("product_packages").select("name, price_total_idr").eq("id", seedPackageId).single();
      expect(seed.data).toMatchObject({ name: "UJI-API Benih", price_total_idr: 320000 });
    });
  });

  describe(`Paket katalog cloud (${target.targetEnv}) — akun mitra`, () => {
    it("login berhasil dan terdaftar di allowlist (prasyarat)", async () => {
      expect(partnerReady, "Akun E2E mitra tidak dapat login di proyek ini").toBe(true);
      expect((await partner.rpc("current_user_is_partner")).data).toBe(true);
    });

    it("tambah, ubah, hapus lewat fungsi; nama dirapikan; hapus kedua → package_not_found", async ({ skip }) => {
      if (!partnerReady) return;
      const productId = needsHidden(skip);
      const id = randomUUID();

      const created = await create(partner, productId, { id, name: "  UJI-API   Hemat  ", weight: "100", price: 3100000 });
      expect(created.error).toBeNull();
      expect(created.data).toMatchObject({ id, name: "UJI-API Hemat", price_total_idr: 3100000 });
      expect(Number(created.data.weight_kg)).toBe(100);

      const updated = await partner.rpc("update_product_package", {
        p_id: id,
        p_name: "UJI-API Grosir",
        p_weight_kg: "12.5",
        p_price_total_idr: 400000,
      });
      expect(updated.error).toBeNull();
      expect(updated.data).toMatchObject({ name: "UJI-API Grosir", price_total_idr: 400000 });
      expect(Number(updated.data.weight_kg)).toBe(12.5);

      const removed = await partner.rpc("delete_product_package", { p_id: id });
      expect(removed.error).toBeNull();
      expect(removed.data).toMatchObject({ id });
      const again = await partner.rpc("delete_product_package", { p_id: id });
      expect(again.error).toMatchObject({ code: "P0002", message: "package_not_found" });
    });

    it("tulis langsung ke tabel tetap ditolak walau akun mitra", async ({ skip }) => {
      if (!partnerReady) return;
      const productId = needsHidden(skip);
      if (!seedPackageId) skip("paket benih tidak dapat dibuat");
      const insert = await partner
        .from("product_packages")
        .insert({ product_id: productId, name: "UJI-API Langsung", weight_kg: 1, price_total_idr: 1 });
      expect(insert.error?.code).toBe("42501");
      expect((await partner.from("product_packages").update({ price_total_idr: 1 }).eq("id", seedPackageId)).error?.code).toBe("42501");
      expect((await partner.from("product_packages").delete().eq("id", seedPackageId)).error?.code).toBe("42501");
      const seed = await partner.from("product_packages").select("price_total_idr").eq("id", seedPackageId).single();
      expect(seed.data?.price_total_idr).toBe(320000);
    });

    it("input tidak valid ditolak database tanpa mengubah data (berat/harga di luar aturan, desimal, pecahan)", async ({ skip }) => {
      if (!partnerReady) return;
      const productId = needsHidden(skip);
      const before = await packageIdsOf(productId);
      for (const [weight, price, key] of [
        ["0", 100, "package_weight_out_of_range"],
        ["-1", 100, "package_weight_out_of_range"],
        ["10000.01", 100, "package_weight_out_of_range"],
        ["NaN", 100, "package_weight_out_of_range"],
        ["1.255", 100, "package_weight_too_many_decimals"],
        ["10", -1, "package_price_out_of_range"],
        ["10", 1000000001, "package_price_out_of_range"],
        ["10", 3100000.5, "package_price_not_whole"],
      ] as const) {
        const made = await create(partner, productId, { weight, price });
        expect(made.error, `berat ${weight} / harga ${price}`).toMatchObject({ code: "22023", message: key });
      }
      expect(await packageIdsOf(productId)).toEqual(before);
    });

    it("nama tidak valid ditolak database (kosong, baris baru, > 60 karakter)", async ({ skip }) => {
      if (!partnerReady) return;
      const productId = needsHidden(skip);
      for (const [name, key] of [
        ["   ", "package_name_required"],
        ["Baris\nBaru", "package_name_line_break"],
        ["x".repeat(61), "package_name_too_long"],
      ] as const) {
        expect((await create(partner, productId, { name })).error, JSON.stringify(name)).toMatchObject({ code: "22023", message: key });
      }
    });

    it("kirim ulang 'tambah' dengan ID yang sama TIDAK membuat paket ganda", async ({ skip }) => {
      if (!partnerReady) return;
      const productId = needsHidden(skip);
      const id = randomUUID();
      const args = { id, name: "UJI-API Ulang", weight: "20", price: 600000 };
      const first = await create(partner, productId, args);
      const replay = await create(partner, productId, args);
      expect(first.error).toBeNull();
      expect(replay.error).toBeNull();
      expect(replay.data).toEqual(first.data);
      const rows = await partner.from("product_packages").select("id").eq("id", id);
      expect(rows.data).toHaveLength(1);
      const conflict = await create(partner, productId, { ...args, name: "UJI-API Lain" });
      expect(conflict.error).toMatchObject({ code: "23505", message: "package_id_conflict" });
    });

    it("CRUD paket tidak mengubah stok, harga satuan, atau waktu konfirmasi produk", async ({ skip }) => {
      if (!partnerReady) return;
      const productId = needsHidden(skip);
      const set = await partner.rpc("confirm_product_stock_price", {
        p_product_id: productId,
        p_stock_kg: "40",
        p_price_per_kg_idr: 35000,
      });
      expect(set.error).toBeNull();
      const before = await productSnapshot(productId);

      const id = randomUUID();
      expect((await create(partner, productId, { id, name: "UJI-API Isolasi", weight: "10", price: 320000 })).error).toBeNull();
      expect(
        (await partner.rpc("update_product_package", { p_id: id, p_name: "UJI-API Isolasi 2", p_weight_kg: "15", p_price_total_idr: 450000 })).error,
      ).toBeNull();
      expect((await partner.rpc("delete_product_package", { p_id: id })).error).toBeNull();

      expect(await productSnapshot(productId)).toEqual(before);
    });

    it("mengubah harga satuan produk tidak menimpa harga total paket", async ({ skip }) => {
      if (!partnerReady) return;
      const productId = needsHidden(skip);
      const id = randomUUID();
      expect((await create(partner, productId, { id, name: "UJI-API Harga", weight: "10", price: 320000 })).error).toBeNull();
      const changed = await partner.rpc("confirm_product_stock_price", {
        p_product_id: productId,
        p_stock_kg: "40",
        p_price_per_kg_idr: 40000,
      });
      expect(changed.error).toBeNull();
      const pkg = await partner.from("product_packages").select("price_total_idr").eq("id", id).single();
      expect(pkg.data?.price_total_idr).toBe(320000);
    });
  });

  describe(`Paket katalog cloud (${target.targetEnv}) — tidak ada sisa pada produk terbit`, () => {
    it("stok, harga, waktu konfirmasi produk terbit tidak berubah dan tidak ada paket tertinggal", async ({ skip }) => {
      if (!partnerReady || !publishedProductId) skip("mitra/produk terbit tidak tersedia");
      expect(createdOnPublished.size).toBe(0);
      expect(await productSnapshot(publishedProductId as string)).toEqual(publishedBefore.snapshot);
      expect(await packageIdsOf(publishedProductId as string)).toEqual(publishedBefore.packageIds);
    });
  });
}
