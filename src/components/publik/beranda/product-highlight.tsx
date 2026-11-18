import { Suspense } from "react";

import { ProductSummaryCard } from "@/components/publik/product/product-sections";
import { SectionHeading } from "@/components/publik/section-heading";
import { HOME_SECTIONS } from "@/config/navigation";

/**
 * Sorotan produk tunggal Ikan Nila di beranda (PRD FR-01, §12.1–§12.3, §12.8; ARCHITECTURE.md §12.2–§12.3).
 *
 * Judul & kerangka bagian ada di shell statis; angka stok/harga/waktu dan paket dibaca saat permintaan
 * (tanpa cache) di `ProductSummaryCard`, dibungkus <Suspense>. Tidak ada angka di kode.
 */
export function ProductHighlight() {
  return (
    <section id={HOME_SECTIONS.produk} aria-labelledby="produk-judul" className="py-16 md:py-24">
      <div className="reveal mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading
          id="produk-judul"
          eyebrow="Produk"
          title="Stok dan harga ikan nila"
          description="Angka di bawah adalah data terakhir yang disimpan penjual, dibaca setiap kali halaman dibuka atau dimuat ulang."
        />
        <div className="mt-10">
          <Suspense fallback={<ProductHighlightSkeleton />}>
            <ProductSummaryCard />
          </Suspense>
        </div>
      </div>
    </section>
  );
}

const cardShell =
  "grid overflow-hidden rounded-[1.75rem] border border-line bg-surface shadow-sm md:grid-cols-[0.85fr_1.15fr]";

/** PRD NFR-12: kerangka saat data dimuat. Statis (tanpa animasi berulang). */
function ProductHighlightSkeleton() {
  return (
    <div className={cardShell} aria-busy="true">
      <div className="bg-accent-soft/50 p-4 sm:p-6">
        <div className="h-full min-h-48 rounded-xl bg-neutral-soft md:min-h-72" />
      </div>
      <div className="flex flex-col gap-6 p-6 sm:p-8">
        <p className="sr-only">Memuat stok dan harga…</p>
        <div className="h-8 w-40 rounded-lg bg-neutral-soft" />
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="h-24 rounded-2xl bg-neutral-soft" />
          <div className="h-24 rounded-2xl bg-neutral-soft" />
        </div>
        <div className="h-20 rounded-2xl bg-neutral-soft" />
        <div className="h-11 w-56 rounded-full bg-neutral-soft" />
      </div>
    </div>
  );
}
