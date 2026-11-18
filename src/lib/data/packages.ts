import "server-only";

import { connection } from "next/server";
import { z } from "zod";

import { numericColumn } from "@/lib/actions/core/shared";
import { logReadError } from "@/lib/data/log";
import { loadPublishedProduct, type PublicProductResult } from "@/lib/data/products";
import { getPublicSupabaseClient, publicReadSignal } from "@/lib/supabase/public-client";
import { createServerSupabaseClient } from "@/lib/supabase/server-client";

/**
 * Pembacaan paket katalog (PRD §12.8; ARCHITECTURE.md §8.10, §12.3).
 *
 * - TANPA cache (`connection()` + tanpa 'use cache'), sama seperti stok & harga: perubahan paket terlihat
 *   saat halaman dibuka/dimuat ulang. Pemanggil wajib membungkus komponennya dengan <Suspense>.
 * - Publik memakai klien tanpa cookie (role anon): RLS hanya mengizinkan paket milik produk terbit.
 * - Urutan konsisten: berat, harga total, waktu dibuat, id. Tidak ada pengurutan manual.
 * - Gagal muat (`error`) dibedakan dari "belum ada paket" (`ok` dengan daftar kosong).
 */

export type CatalogPackage = {
  id: string;
  name: string;
  weightKg: number;
  priceTotalIdr: number;
  createdAt: string;
  /** Waktu terakhir paket diubah (metadata paket, BUKAN waktu konfirmasi stok/harga). */
  updatedAt: string;
};

export type PackagesResult = { status: "ok"; packages: CatalogPackage[] } | { status: "error" };

export const PACKAGE_COLUMNS = "id, name, weight_kg, price_total_idr, created_at, updated_at";

export const packageRowSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  weight_kg: numericColumn.refine((value) => value > 0),
  price_total_idr: z.number().int().nonnegative(),
  created_at: z.string(),
  updated_at: z.string(),
});

export function toCatalogPackage(row: z.infer<typeof packageRowSchema>): CatalogPackage {
  return {
    id: row.id,
    name: row.name,
    weightKg: row.weight_kg,
    priceTotalIdr: row.price_total_idr,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function parsePackages(scope: string, data: unknown): PackagesResult {
  const parsed = z.array(packageRowSchema).safeParse(data ?? []);
  if (!parsed.success) {
    logReadError(scope, new Error("bentuk baris paket tidak sesuai skema"));
    return { status: "error" };
  }
  return { status: "ok", packages: parsed.data.map(toCatalogPackage) };
}

type PackageQuerySource = Pick<ReturnType<typeof getPublicSupabaseClient>, "from">;

async function queryPackages(client: PackageQuerySource, productId: string, scope: string): Promise<PackagesResult> {
  try {
    const { data, error } = await client
      .from("product_packages")
      .select(PACKAGE_COLUMNS)
      .eq("product_id", productId)
      .order("weight_kg", { ascending: true })
      .order("price_total_idr", { ascending: true })
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .abortSignal(publicReadSignal());
    if (error) {
      logReadError(scope, error);
      return { status: "error" };
    }
    return parsePackages(scope, data);
  } catch (error) {
    logReadError(scope, error);
    return { status: "error" };
  }
}

export type CatalogResult = {
  product: PublicProductResult;
  /** `null` bila produk tidak berhasil dimuat: paket tidak ditampilkan tanpa informasi produk. */
  packages: PackagesResult | null;
};

/** Produk + paketnya untuk beranda, katalog, dan detail produk (satu sumber yang sama). */
export async function loadPublishedCatalog(slug: string): Promise<CatalogResult> {
  await connection();
  const product = await loadPublishedProduct(slug);
  if (product.status !== "ok") return { product, packages: null };
  const packages = await queryPackages(getPublicSupabaseClient(), product.product.id, "product_packages");
  return { product, packages };
}

/** Paket untuk panel mitra (sesi mitra; RLS mengizinkan mitra membaca semua paket). */
export async function loadPackagesForPartner(productId: string): Promise<PackagesResult> {
  await connection();
  try {
    const supabase = await createServerSupabaseClient();
    return await queryPackages(supabase, productId, "product_packages_partner");
  } catch (error) {
    logReadError("product_packages_partner", error);
    return { status: "error" };
  }
}
