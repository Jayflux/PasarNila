"use server";

import { revalidatePath } from "next/cache";

import { requirePartner } from "@/lib/auth/require-partner";
import { formatWib } from "@/lib/format/datetime";
import { formatKg, formatPricePerKg } from "@/lib/format/number";
import { createServerSupabaseClient } from "@/lib/supabase/server-client";
import {
  parsePriceInput,
  parseStockInput,
} from "@/lib/validation/stock-price-input";

export type StockPriceActionResult = {
  ok: boolean;
  message?: string;
  fieldErrors?: {
    stock?: string;
    price?: string;
  };
  savedData?: {
    stockKg: number;
    pricePerKgIdr: number;
    confirmedAtLabel: string;
    stockLabel: string;
    priceLabel: string;
  };
};

/**
 * Server Action untuk menyimpan & konfirmasi stok dan harga (PRD FR-18, FR-19, AC-26–AC-34).
 */
export async function saveStockPriceAction(
  _prevState: StockPriceActionResult | null,
  formData: FormData,
): Promise<StockPriceActionResult> {
  // 1. Verifikasi mitra (PRD FR-16, AC-19–AC-21)
  await requirePartner();

  const productId = (formData.get("productId") as string | null)?.trim() ?? "";
  const stockRaw = (formData.get("stockKg") as string | null) ?? "";
  const priceRaw = (formData.get("pricePerKgIdr") as string | null) ?? "";
  const baselineConfirmedAt = (formData.get("baselineConfirmedAt") as string | null) ?? "";

  if (!productId) {
    return {
      ok: false,
      message: "ID produk tidak valid.",
    };
  }

  // 2. Validasi format input stok dan harga (PRD AC-27, AC-28; ARCHITECTURE §10.2)
  const stockResult = parseStockInput(stockRaw);
  const priceResult = parsePriceInput(priceRaw);

  if (!stockResult.ok || !priceResult.ok) {
    return {
      ok: false,
      fieldErrors: {
        stock: !stockResult.ok ? stockResult.message : undefined,
        price: !priceResult.ok ? priceResult.message : undefined,
      },
    };
  }

  // 3. Panggil RPC confirm_product_stock_price di database
  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.rpc("confirm_product_stock_price", {
      p_product_id: productId,
      p_stock_kg: stockResult.canonical,
      p_price_per_kg_idr: priceResult.idr,
    });

    if (error) {
      // Pemetaan error Postgres / PostgREST (ARCHITECTURE §10.3)
      if (error.code === "42501") {
        return { ok: false, message: "Akun ini tidak memiliki akses untuk menyimpan data." };
      }
      if (error.code === "P0002") {
        return { ok: false, message: "Produk tidak ditemukan di database." };
      }
      if (error.code === "22023") {
        if (error.message.includes("stock_out_of_range")) {
          return { ok: false, fieldErrors: { stock: "Stok di luar batas wajar (0 - 100.000 kg)." } };
        }
        if (error.message.includes("stock_too_many_decimals")) {
          return { ok: false, fieldErrors: { stock: "Stok maksimal 2 angka di belakang koma." } };
        }
        if (error.message.includes("price_out_of_range")) {
          return { ok: false, fieldErrors: { price: "Harga di luar batas wajar (Rp0 - Rp10.000.000)." } };
        }
        if (error.message.includes("price_not_whole")) {
          return { ok: false, fieldErrors: { price: "Harga harus dalam rupiah bulat." } };
        }
      }

      return {
        ok: false,
        message: "Gagal menyimpan. Data sebelumnya tidak berubah. Silakan coba lagi.",
      };
    }

    if (!data) {
      return {
        ok: false,
        message: "Gagal menyimpan. Tidak ada data yang diperbarui.",
      };
    }

    // 4. Format hasil simpan
    const confirmedAtStr = data.stock_price_confirmed_at as string;
    const confirmedAtLabel = formatWib(confirmedAtStr);
    const stockLabel = formatKg(Number(data.stock_kg));
    const priceLabel = formatPricePerKg(Number(data.price_per_kg_idr));

    // Menentukan apakah ini konfirmasi ulang atau update nilai baru (AC-31)
    const isReconfirmation =
      baselineConfirmedAt !== "" &&
      Number(data.stock_kg) === stockResult.kg &&
      Number(data.price_per_kg_idr) === priceResult.idr;

    const message = isReconfirmation
      ? `Data stok dan harga berhasil dikonfirmasi ulang pada ${confirmedAtLabel}.`
      : `Stok (${stockLabel}) dan harga (${priceLabel}) berhasil disimpan dan dikonfirmasi pada ${confirmedAtLabel}.`;

    // 5. Revalidasi path publik dan panel
    revalidatePath("/");
    revalidatePath("/produk");
    revalidatePath("/produk/ikan-nila");
    revalidatePath("/mitra");

    return {
      ok: true,
      message,
      savedData: {
        stockKg: Number(data.stock_kg),
        pricePerKgIdr: Number(data.price_per_kg_idr),
        confirmedAtLabel,
        stockLabel,
        priceLabel,
      },
    };
  } catch (err) {
    return {
      ok: false,
      message:
        err instanceof Error
          ? `Terjadi kesalahan koneksi: ${err.message}`
          : "Gagal menyimpan data. Silakan coba lagi.",
    };
  }
}
