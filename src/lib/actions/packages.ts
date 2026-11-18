"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  createPackage,
  deletePackage,
  recheckPackage,
  updatePackage,
  type PackageDb,
  type PackageDeps,
  type PackageResult,
} from "@/lib/actions/core/packages";
import { supabaseGate, verifyReadSignal, wait, writeSignal } from "@/lib/actions/core/supabase-gate";
import { PRIMARY_PRODUCT_SLUG } from "@/lib/data/products";
import { settle } from "@/lib/write/outcome";

/** Server Action paket katalog (PRD §12.8; ARCHITECTURE.md §5.7). Setiap action memeriksa mitra sendiri. */

const COLUMNS = "id, name, weight_kg, price_total_idr, updated_at";

function packageDb(supabase: SupabaseClient): PackageDb {
  return {
    create: ({ id, productId, name, weightCanonical, priceIdr }) =>
      settle(() =>
        supabase
          .rpc("create_product_package", {
            p_id: id,
            p_product_id: productId,
            p_name: name,
            p_weight_kg: weightCanonical,
            p_price_total_idr: priceIdr,
          })
          .abortSignal(writeSignal()),
      ),
    update: ({ id, name, weightCanonical, priceIdr }) =>
      settle(() =>
        supabase
          .rpc("update_product_package", {
            p_id: id,
            p_name: name,
            p_weight_kg: weightCanonical,
            p_price_total_idr: priceIdr,
          })
          .abortSignal(writeSignal()),
      ),
    remove: (id) => settle(() => supabase.rpc("delete_product_package", { p_id: id }).abortSignal(writeSignal())),
    read: (id) =>
      settle(() =>
        supabase.from("product_packages").select(COLUMNS).eq("id", id).abortSignal(verifyReadSignal()).maybeSingle(),
      ),
  };
}

function deps(): PackageDeps {
  return {
    gate: supabaseGate(packageDb),
    wait,
    afterSave: () => {
      // Halaman publik membaca paket tanpa cache; revalidasi ini menyegarkan router cache.
      revalidatePath("/");
      revalidatePath("/produk");
      revalidatePath(`/produk/${PRIMARY_PRODUCT_SLUG}`);
      revalidatePath("/mitra/paket");
    },
  };
}

export async function createPackageAction(formData: FormData): Promise<PackageResult> {
  return createPackage(formData, deps());
}

export async function updatePackageAction(formData: FormData): Promise<PackageResult> {
  return updatePackage(formData, deps());
}

export async function deletePackageAction(formData: FormData): Promise<PackageResult> {
  return deletePackage(formData, deps());
}

export async function recheckPackageAction(formData: FormData): Promise<PackageResult> {
  return recheckPackage(formData, deps());
}
