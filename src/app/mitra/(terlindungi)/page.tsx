import type { Metadata } from "next";

import { PanelLoadError } from "@/components/panel/panel-load-error";
import { StockPriceForm } from "@/components/panel/stock-price-form";
import { SectionHeading } from "@/components/publik/section-heading";
import {
  loadProductForPartner,
  PRIMARY_PRODUCT_FALLBACK_NAME,
  PRIMARY_PRODUCT_SLUG,
} from "@/lib/data/products";
import { formatWib } from "@/lib/format/datetime";

export const metadata: Metadata = {
  title: "Stok & Harga – Panel Mitra",
  robots: { index: false, follow: false },
};

/** Panel stok & harga (PRD FR-17–FR-21, AC-25). */
export default async function PanelDashboardPage() {
  const result = await loadProductForPartner(PRIMARY_PRODUCT_SLUG);

  const heading = (
    <SectionHeading
      id="panel-stok-judul"
      level="h1"
      eyebrow="Panel pengelolaan"
      title="Stok & harga satuan"
      description="Stok total (kg) dan harga per kg dipakai bersama oleh semua pilihan paket. Setelah disimpan, angka baru tampil di website saat halaman dibuka atau dimuat ulang."
    />
  );

  if (result.status === "error") {
    return (
      <div className="space-y-6">
        {heading}
        <PanelLoadError what="data produk" />
      </div>
    );
  }

  if (result.status === "not_found") {
    return (
      <div className="space-y-6">
        {heading}
        <PanelLoadError
          title="Produk belum terdaftar"
          what="produk"
          detail={`Produk dengan alamat “${PRIMARY_PRODUCT_SLUG}” tidak ditemukan di database. Hubungi pengembang untuk memeriksa data awal.`}
        />
      </div>
    );
  }

  const { product } = result;
  const confirmedAt =
    product.stockPrice.confirmedAt instanceof Date
      ? product.stockPrice.confirmedAt.toISOString()
      : product.stockPrice.confirmedAt;

  return (
    <div className="space-y-8">
      {heading}
      <StockPriceForm
        productId={product.id}
        productName={product.name ?? PRIMARY_PRODUCT_FALLBACK_NAME}
        initialStockKg={product.stockPrice.stockKg}
        initialPriceIdr={product.stockPrice.pricePerKgIdr}
        initialConfirmedAt={confirmedAt}
        initialConfirmedAtLabel={confirmedAt ? formatWib(confirmedAt) : "Belum pernah dikonfirmasi"}
      />
    </div>
  );
}
