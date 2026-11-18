import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";

import { ProductDetail } from "@/components/publik/product/product-sections";
import { loadPublishedProduct, PRIMARY_PRODUCT_FALLBACK_NAME, PRIMARY_PRODUCT_SLUG } from "@/lib/data/products";
import { getBusinessName } from "@/lib/data/site-settings";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return [{ slug: PRIMARY_PRODUCT_SLUG }];
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const [result, businessName] = await Promise.all([loadPublishedProduct(slug), getBusinessName()]);
  const productName = result.status === "ok" ? result.product.name : PRIMARY_PRODUCT_FALLBACK_NAME;
  return {
    title: `${productName} – ${businessName.name}`,
    description: `Stok (kg), harga per kg, dan pilihan paket ${productName}. Pemesanan melalui chat WhatsApp.`,
  };
}

/**
 * Detail produk (PRD §7, FR-03, §12.8; ARCHITECTURE §6). Slug tak dikenal ditolak 404 oleh
 * `src/proxy.ts` sebelum streaming; slug dikenal yang tidak terbit → `notFound()` (200 + noindex).
 */
export default function ProductDetailPage(props: PageProps) {
  return (
    <div className="py-12 md:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <nav aria-label="Breadcrumb" className="mb-6 flex items-center gap-2 text-sm text-ink-muted">
          <Link href="/" className="transition hover:text-ink">
            Beranda
          </Link>
          <span aria-hidden="true">/</span>
          <Link href="/produk" className="transition hover:text-ink">
            Produk
          </Link>
        </nav>
        <Suspense fallback={<ProductDetailSkeleton />}>
          <ProductDetail params={props.params} />
        </Suspense>
      </div>
    </div>
  );
}

function ProductDetailSkeleton() {
  return (
    <div className="min-h-96 rounded-[1.75rem] border border-line bg-surface p-8" aria-busy="true">
      <p className="sr-only">Memuat produk dan pilihan paket…</p>
      <div className="h-8 w-64 rounded bg-neutral-soft" />
      <div className="mt-4 h-5 w-full max-w-xl rounded bg-neutral-soft" />
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <div className="h-48 rounded-2xl bg-neutral-soft" />
        <div className="h-48 rounded-2xl bg-neutral-soft" />
        <div className="h-48 rounded-2xl bg-neutral-soft" />
      </div>
    </div>
  );
}
