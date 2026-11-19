import "server-only";

import { connection } from "next/server";
import { cache } from "react";
import { z } from "zod";

import type { StoredStockPrice } from "@/lib/domain/product-status";
import { logReadError } from "@/lib/data/log";
import { getPublicSupabaseClient, publicReadSignal } from "@/lib/supabase/public-client";
import { createServerSupabaseClient } from "@/lib/supabase/server-client";

/**
 * Pembacaan produk untuk halaman publik (ARCHITECTURE.md §5.1, §12).
 *
 * Data stok/harga/waktu konfirmasi TIDAK di-cache: tanpa 'use cache', dan `connection()` dipanggil
 * lebih dulu sehingga pembacaan selalu terjadi saat permintaan, tidak pernah saat prerender/build.
 * Pemanggil wajib membungkus komponennya dengan <Suspense>.
 *
 * Tidak ada data cadangan/contoh: bila gagal, hasilnya `error` dan UI menampilkan pesan gangguan
 * (PRD AC-12), bukan "Belum tersedia" atau angka.
 */

/** Satu-satunya produk MVP (PRD §1.1, A-01). Slug ditetapkan di migrasi data awal. */
export const PRIMARY_PRODUCT_SLUG = "ikan-nila";
/** Nama untuk teks UI/pesan WhatsApp saat data produk gagal dimuat (produk dikonfirmasi klien). */
export const PRIMARY_PRODUCT_FALLBACK_NAME = "Ikan Nila";

export const PRODUCT_COLUMNS =
  "id, slug, name, short_description, image_path, image_alt, stock_kg, price_per_kg_idr, stock_price_confirmed_at";

/** PostgREST mengirim `numeric` sebagai angka JSON; string angka diterima sebagai cadangan. */
const numericColumn = z.union([
  z.number(),
  z
    .string()
    .regex(/^\d+(\.\d+)?$/)
    .transform(Number),
]);

const productRowSchema = z.object({
  id: z.string().uuid(),
  slug: z.string().min(1),
  name: z.string().min(1),
  short_description: z.string().nullable(),
  image_path: z.string().nullable().optional(),
  image_alt: z.string().nullable().optional(),
  stock_kg: numericColumn.nullable(),
  price_per_kg_idr: z.number().int().nullable(),
  stock_price_confirmed_at: z.string().nullable(),
});

export type PublicProduct = {
  /** ID produk (bukan rahasia), dipakai untuk membaca paket produk ini. */
  id: string;
  slug: string;
  name: string;
  shortDescription: string | null;
  imagePath?: string | null;
  imageAlt?: string | null;
  stockPrice: StoredStockPrice;
};

export type PublicProductResult =
  | { status: "ok"; product: PublicProduct }
  /** Tidak ada produk terbit dengan slug ini → "Produk belum tersedia" (PRD NFR-13). */
  | { status: "not_found" }
  /** DB tidak dapat diakses, timeout, konfigurasi tidak lengkap, atau data tidak sesuai bentuk. */
  | { status: "error" };

/** Reuse metadata/render reads within one request only; no cross-request cache. */
export const loadPublishedProduct = cache(async (slug: string): Promise<PublicProductResult> => {
  // Penanda eksplisit: semua kode sesudah ini hanya berjalan saat permintaan (§12.2).
  await connection();

  try {
    const { data, error } = await getPublicSupabaseClient()
      .from("products")
      .select(PRODUCT_COLUMNS)
      .eq("slug", slug)
      .eq("is_published", true)
      .abortSignal(publicReadSignal())
      .maybeSingle();

    if (error) {
      logReadError("products", error);
      return { status: "error" };
    }
    return parsePublishedProduct(data);
  } catch (error) {
    logReadError("products", error);
    return { status: "error" };
  }
});

export function parsePublishedProduct(data: unknown): PublicProductResult {
  if (data === null) return { status: "not_found" };
  const parsed = productRowSchema.safeParse(data);
  if (!parsed.success) {
    logReadError("products", new Error("bentuk baris produk tidak sesuai skema"));
    return { status: "error" };
  }
  const row = parsed.data;
  return {
    status: "ok",
    product: {
      id: row.id,
      slug: row.slug,
      name: row.name,
      shortDescription: row.short_description,
      imagePath: row.image_path ?? null,
      imageAlt: row.image_alt ?? null,
      stockPrice: { stockKg: row.stock_kg, pricePerKgIdr: row.price_per_kg_idr, confirmedAt: row.stock_price_confirmed_at },
    },
  };
}

export type PartnerProduct = {
  id: string;
  slug: string;
  name: string;
  shortDescription: string | null;
  imagePath: string | null;
  imageAlt: string | null;
  stockPrice: StoredStockPrice;
};

export type PartnerProductResult =
  | { status: "ok"; product: PartnerProduct }
  | { status: "not_found" }
  | { status: "error" };

/**
 * Pembacaan produk dengan ID untuk panel mitra (ARCHITECTURE.md §5.3, §10.4).
 * Memakai kredensial sesi mitra sehingga dapat mengakses baris produk lengkap.
 */
export async function loadProductForPartner(slug: string): Promise<PartnerProductResult> {
  await connection();
  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("products")
      .select(PRODUCT_COLUMNS)
      .eq("slug", slug)
      .abortSignal(publicReadSignal())
      .maybeSingle();

    if (error) {
      logReadError("products_partner", error);
      return { status: "error" };
    }
    if (data === null) return { status: "not_found" };

    const parsed = productRowSchema.safeParse(data);
    if (!parsed.success) {
      logReadError("products_partner", new Error("bentuk baris produk mitra tidak sesuai skema"));
      return { status: "error" };
    }

    const row = parsed.data;
    return {
      status: "ok",
      product: {
        id: row.id,
        slug: row.slug,
        name: row.name,
        shortDescription: row.short_description,
        imagePath: row.image_path ?? null,
        imageAlt: row.image_alt ?? null,
        stockPrice: {
          stockKg: row.stock_kg,
          pricePerKgIdr: row.price_per_kg_idr,
          confirmedAt: row.stock_price_confirmed_at,
        },
      },
    };
  } catch (error) {
    logReadError("products_partner", error);
    return { status: "error" };
  }
}
