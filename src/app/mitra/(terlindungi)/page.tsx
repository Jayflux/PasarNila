import type { Metadata } from "next";

import { StockPriceForm } from "@/components/panel/stock-price-form";
import { SectionHeading } from "@/components/publik/section-heading";
import {
  loadProductForPartner,
  PRIMARY_PRODUCT_FALLBACK_NAME,
  PRIMARY_PRODUCT_SLUG,
} from "@/lib/data/products";
import { formatWib } from "@/lib/format/datetime";

export const metadata: Metadata = {
  title: "Kelola Stok & Harga – Panel Mitra",
  robots: { index: false, follow: false },
};

export default async function PanelDashboardPage() {
  const result = await loadProductForPartner(PRIMARY_PRODUCT_SLUG);

  if (result.status === "error" || result.status === "not_found") {
    return (
      <div className="space-y-6">
        <SectionHeading
          id="panel-stok-error"
          eyebrow="Panel Pengelolaan"
          title="Pembaruan Stok &amp; Harga"
        />
        <div className="rounded-[1.75rem] border border-error-ink/20 bg-error-soft p-6 text-error-ink">
          <p className="font-bold">Gagal memuat data produk mitra</p>
          <p className="mt-1 text-sm">
            Pastikan produk awal sudah terdaftar di database. Muat ulang halaman untuk mencoba lagi.
          </p>
        </div>
      </div>
    );
  }

  const { product } = result;
  const confirmedAtStr =
    product.stockPrice.confirmedAt instanceof Date
      ? product.stockPrice.confirmedAt.toISOString()
      : product.stockPrice.confirmedAt;

  const confirmedAtLabel = confirmedAtStr
    ? formatWib(confirmedAtStr)
    : "Belum pernah dikonfirmasi";

  return (
    <div className="space-y-8">
      <SectionHeading
        id="panel-stok-judul"
        eyebrow="Panel Pengelolaan"
        title="Pembaruan Stok &amp; Harga"
        description="Perubahan stok atau harga ikan nila akan langsung terlihat oleh pengunjung website setelah disimpan."
      />

      <StockPriceForm
        productId={product.id}
        productName={product.name ?? PRIMARY_PRODUCT_FALLBACK_NAME}
        initialStockKg={product.stockPrice.stockKg}
        initialPriceIdr={product.stockPrice.pricePerKgIdr}
        initialConfirmedAt={confirmedAtStr}
        initialConfirmedAtLabel={confirmedAtLabel}
      />
    </div>
  );
}
