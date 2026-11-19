"use server";

import { revalidatePath } from "next/cache";
import type { AppSupabaseClient } from "@/lib/supabase/public-client";

import {
  deleteProductPhoto,
  updateProductPhoto,
  type ProductPhotoDb,
  type ProductPhotoResult,
} from "@/lib/actions/core/product-photo";
import { supabaseGate, verifyReadSignal, writeSignal } from "@/lib/actions/core/supabase-gate";
import { PRIMARY_PRODUCT_SLUG } from "@/lib/data/products";
import { settle } from "@/lib/write/outcome";

function productPhotoDb(supabase: AppSupabaseClient): ProductPhotoDb {
  return {
    updatePhoto: ({ productId, imagePath, imageAlt }) =>
      settle(() =>
        supabase
          .rpc("update_product_photo", {
            p_product_id: productId,
            p_image_path: imagePath,
            p_image_alt: imageAlt,
          })
          .abortSignal(writeSignal()),
      ),
    read: (productId: string) =>
      settle(() =>
        supabase
          .from("products")
          .select("id, image_path, image_alt, updated_at")
          .eq("id", productId)
          .abortSignal(verifyReadSignal())
          .maybeSingle(),
      ),
  };
}

function onSuccess() {
  revalidatePath("/", "page");
  revalidatePath("/produk", "page");
  revalidatePath(`/produk/${PRIMARY_PRODUCT_SLUG}`, "page");
  revalidatePath("/mitra", "page");
}

export async function updateProductPhotoAction(formData: FormData): Promise<ProductPhotoResult> {
  return updateProductPhoto(formData, {
    gate: supabaseGate(productPhotoDb),
    onSuccess,
  });
}

export async function deleteProductPhotoAction(formData: FormData): Promise<ProductPhotoResult> {
  return deleteProductPhoto(formData, {
    gate: supabaseGate(productPhotoDb),
    onSuccess,
  });
}
