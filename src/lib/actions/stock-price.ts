"use server";

import { revalidatePath } from "next/cache";
import type { AppSupabaseClient } from "@/lib/supabase/public-client";

import {
  recheckStockPrice,
  saveStockPrice,
  type StockPriceDb,
  type StockPriceDeps,
  type StockPriceResult,
} from "@/lib/actions/core/stock-price";
import { supabaseGate, verifyReadSignal, wait, writeSignal } from "@/lib/actions/core/supabase-gate";
import { PRIMARY_PRODUCT_SLUG } from "@/lib/data/products";
import { settle } from "@/lib/write/outcome";

/**
 * Server Action stok & harga (PRD FR-18, FR-19, AC-24–AC-34, AC-51; ARCHITECTURE.md §5.3, §10.4).
 * Logika ada di `core/stock-price.ts`; file ini hanya menghubungkan Supabase dan revalidasi.
 */

function stockPriceDb(supabase: AppSupabaseClient): StockPriceDb {
  return {
    confirm: ({ productId, stockCanonical, priceIdr }) =>
      settle(() =>
        supabase
          .rpc("confirm_product_stock_price", {
            p_product_id: productId,
            p_stock_kg: Number(stockCanonical),
            p_price_per_kg_idr: priceIdr,
          })
          .abortSignal(writeSignal()),
      ),
    read: (productId) =>
      settle(() =>
        supabase
          .from("products")
          .select("stock_kg, price_per_kg_idr, stock_price_confirmed_at")
          .eq("id", productId)
          .abortSignal(verifyReadSignal())
          .maybeSingle(),
      ),
  };
}

function deps(): StockPriceDeps {
  return {
    gate: supabaseGate(stockPriceDb),
    wait,
    afterSave: () => {
      // Halaman produk publik dinamis (tanpa cache); revalidasi ini menyegarkan router cache panel.
      revalidatePath("/");
      revalidatePath("/produk");
      revalidatePath(`/produk/${PRIMARY_PRODUCT_SLUG}`);
      revalidatePath("/mitra");
      revalidatePath("/mitra/paket");
    },
  };
}

export async function saveStockPriceAction(formData: FormData): Promise<StockPriceResult> {
  return saveStockPrice(formData, deps());
}

export async function recheckStockPriceAction(formData: FormData): Promise<StockPriceResult> {
  return recheckStockPrice(formData, deps());
}
