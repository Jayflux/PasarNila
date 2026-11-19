import { Suspense } from "react";
import type { Metadata } from "next";

import { ProductSummaryCard } from "@/components/publik/product/product-sections";
import { SectionHeading } from "@/components/publik/section-heading";
import { getBusinessName } from "@/lib/data/site-settings";

export async function generateMetadata(): Promise<Metadata> {
  const businessName = await getBusinessName();
  return {
    title: `Produk – ${businessName.name}`,
    description: "Stok (kg), harga per kg, pilihan paket, dan waktu pembaruan ikan nila. Pemesanan melalui chat WhatsApp.",
  };
}

/** Katalog produk (PRD §7, FR-02; ARCHITECTURE §6, §12.3): shell statis + data produk & paket dinamis. */
export default function ProdukPage() {
  return (
    <section aria-labelledby="katalog-judul" className="py-16 md:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading
          id="katalog-judul"
          level="h1"
          eyebrow="Katalog"
          title="Produk"
          description="Stok, harga, dan pilihan paket adalah data terakhir yang disimpan penjual, dibaca setiap kali halaman dibuka atau dimuat ulang."
        />
        <div className="mt-10">
          <Suspense fallback={<ProductCardSkeleton />}>
            <ProductSummaryCard headingLevel="h2" />
          </Suspense>
        </div>
      </div>
    </section>
  );
}

function ProductCardSkeleton() {
  return (
    <div className="min-h-72 rounded-[1.75rem] border border-line bg-surface p-8" aria-busy="true">
      <p className="sr-only">Memuat produk…</p>
      <div className="h-8 w-48 rounded bg-neutral-soft" />
      <div className="mt-4 h-5 w-3/4 rounded bg-neutral-soft" />
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="h-24 rounded-2xl bg-neutral-soft" />
        <div className="h-24 rounded-2xl bg-neutral-soft" />
      </div>
    </div>
  );
}
