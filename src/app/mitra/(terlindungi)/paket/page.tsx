import type { Metadata } from "next";

import { PackageManager } from "@/components/panel/package-manager";
import { PanelLoadError } from "@/components/panel/panel-load-error";
import { SectionHeading } from "@/components/publik/section-heading";
import { loadPackagesForPartner } from "@/lib/data/packages";
import { loadProductForPartner, PRIMARY_PRODUCT_SLUG } from "@/lib/data/products";

export const metadata: Metadata = {
  title: "Paket Katalog – Panel Mitra",
  robots: { index: false, follow: false },
};

/**
 * Pengelolaan paket katalog (PRD §12.8, AC-53–AC-60). Bila produk atau paket gagal dimuat, formulir
 * tidak ditampilkan (bukan dianggap kosong), agar mitra tidak menambah paket ganda tanpa melihat daftar.
 */
export default async function PanelPaketPage() {
  const heading = (
    <SectionHeading
      id="panel-paket-judul"
      eyebrow="Panel pengelolaan"
      title="Paket katalog"
      description="Atur pilihan paket Ikan Nila: nama, berat, dan harga total. Stok total dan harga satuan per kg tetap diatur di menu Stok & Harga."
    />
  );

  const product = await loadProductForPartner(PRIMARY_PRODUCT_SLUG);
  if (product.status !== "ok") {
    return (
      <div className="space-y-6">
        {heading}
        <PanelLoadError
          what="data produk"
          title={product.status === "not_found" ? "Produk belum terdaftar" : undefined}
          detail={
            product.status === "not_found"
              ? "Produk utama tidak ditemukan di database, jadi paket belum dapat diatur. Hubungi pengembang."
              : undefined
          }
        />
      </div>
    );
  }

  const packages = await loadPackagesForPartner(product.product.id);
  if (packages.status === "error") {
    return (
      <div className="space-y-6">
        {heading}
        <PanelLoadError what="daftar paket" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {heading}
      <PackageManager
        productId={product.product.id}
        productName={product.product.name}
        unitPricePerKgIdr={product.product.stockPrice.pricePerKgIdr}
        packages={packages.packages.map((pkg) => ({
          id: pkg.id,
          name: pkg.name,
          weightKg: pkg.weightKg,
          priceTotalIdr: pkg.priceTotalIdr,
          updatedAt: pkg.updatedAt,
        }))}
      />
    </div>
  );
}
