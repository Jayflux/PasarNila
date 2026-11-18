import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";

import { Placeholder } from "@/components/publik/placeholder";
import { SectionHeading } from "@/components/publik/section-heading";
import { WhatsAppButton } from "@/components/publik/whatsapp-button";
import { buttonClass } from "@/components/ui/button-styles";
import { ArrowRightIcon, ScaleIcon } from "@/components/ui/icons";
import { getBusinessName } from "@/lib/data/site-settings";
import { loadPublishedProduct, PRIMARY_PRODUCT_SLUG } from "@/lib/data/products";
import { VOLUME_TIERS } from "@/lib/data/volume-pricing";
import { getProductDisplay } from "@/lib/domain/product-status";
import { getProductWhatsAppHref } from "@/lib/whatsapp-links";

export async function generateMetadata(): Promise<Metadata> {
  const businessName = await getBusinessName();
  return {
    title: `Produk – ${businessName.name}`,
    description: "Katalog produk dan pilihan harga bertingkat ikan nila segar PasarNila.",
  };
}

export default async function ProdukPage() {
  const businessName = await getBusinessName();

  return (
    <section aria-labelledby="katalog-judul" className="py-16 md:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading
          id="katalog-judul"
          eyebrow="Katalog"
          title="Pilihan Produk & Harga"
          description={`Daftar produk ikan nila segar dari ${businessName.name}. Pembelian dalam jumlah lebih besar mendapatkan harga per kg yang lebih hemat.`}
        />

        <div className="mt-10">
          <Suspense fallback={<ProductCardSkeleton />}>
            <ProductCatalogCard />
          </Suspense>
        </div>
      </div>
    </section>
  );
}

async function ProductCatalogCard() {
  const result = await loadPublishedProduct(PRIMARY_PRODUCT_SLUG);

  if (result.status === "not_found") {
    return (
      <div className="rounded-[1.75rem] border border-line bg-surface p-8 text-center">
        <p className="text-xl font-semibold text-ink">Produk belum tersedia</p>
      </div>
    );
  }

  const productName = result.status === "ok" ? result.product.name : "Ikan Nila";
  const display = getProductDisplay(
    result.status === "ok"
      ? { status: "ok", data: result.product.stockPrice }
      : { status: "error" },
  );

  const defaultWaHref = getProductWhatsAppHref(
    display.status === "ok" ? display.whatsAppMessageKind : "product_unknown",
    productName,
    PRIMARY_PRODUCT_SLUG,
  );

  return (
    <div className="overflow-hidden rounded-[1.75rem] border border-line bg-surface shadow-sm">
      <div className="grid md:grid-cols-[0.85fr_1.15fr]">
        <div className="bg-accent-soft/50 p-6 flex flex-col justify-center">
          <Placeholder
            label="Foto produk"
            note="Foto asli menyusul dari pemilik usaha."
            className="flex h-full min-h-56 flex-col items-center justify-center text-center"
          />
        </div>

        <div className="flex flex-col gap-6 p-6 sm:p-8">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">
                {productName}
              </h2>
              {display.status === "ok" ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold text-accent-strong">
                  <ScaleIcon className="size-3.5" />
                  Stok: {display.stock.label}
                </span>
              ) : null}
            </div>
            <p className="mt-2 text-ink-muted leading-7">
              {result.status === "ok" && result.product.shortDescription
                ? result.product.shortDescription
                : "Ikan nila segar kualitas pilihan langsung dari kolam budidaya terawat."}
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold tracking-wide text-ink-muted uppercase">
              Pilihan Paket Kuantitas &amp; Harga:
            </h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {VOLUME_TIERS.map((tier) => (
                <div
                  key={tier.kg}
                  className="rounded-2xl border border-line bg-cream/50 p-4 transition hover:border-accent-strong/40"
                >
                  <p className="text-sm font-semibold text-accent-strong">{tier.label}</p>
                  <p className="mt-1 text-xl font-bold text-ink">{tier.priceFormatted}</p>
                  <p className="text-xs text-ink-muted">{tier.pricePerKgFormatted}</p>
                  {tier.savingsNote ? (
                    <span className="mt-2 inline-block rounded-md bg-warn-soft px-2 py-0.5 text-[11px] font-semibold text-warn-ink">
                      {tier.savingsNote}
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center pt-2">
            <Link
              href={`/produk/${PRIMARY_PRODUCT_SLUG}`}
              className={buttonClass("primary")}
            >
              Lihat Pilihan Pemesanan
              <ArrowRightIcon className="size-5 shrink-0" />
            </Link>
            <WhatsAppButton
              href={defaultWaHref}
              label="Tanya via WhatsApp"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function ProductCardSkeleton() {
  return (
    <div className="min-h-72 rounded-[1.75rem] border border-line bg-surface p-8" aria-busy="true">
      <div className="h-8 w-48 rounded bg-neutral-soft" />
      <div className="mt-4 h-5 w-3/4 rounded bg-neutral-soft" />
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <div className="h-24 rounded-2xl bg-neutral-soft" />
        <div className="h-24 rounded-2xl bg-neutral-soft" />
        <div className="h-24 rounded-2xl bg-neutral-soft" />
      </div>
    </div>
  );
}
