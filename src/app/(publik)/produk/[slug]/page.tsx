import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Placeholder } from "@/components/publik/placeholder";
import { WhatsAppButton } from "@/components/publik/whatsapp-button";
import { ClockIcon, ScaleIcon, TagIcon } from "@/components/ui/icons";
import {
  loadPublishedProduct,
  PRIMARY_PRODUCT_FALLBACK_NAME,
  PRIMARY_PRODUCT_SLUG,
} from "@/lib/data/products";
import { getBusinessName } from "@/lib/data/site-settings";
import { VOLUME_TIERS } from "@/lib/data/volume-pricing";
import {
  CONFIRMED_AT_EXPLANATION,
  CONFIRMED_AT_HEADING,
  getProductDisplay,
} from "@/lib/domain/product-status";
import { getVolumeOrderWhatsAppHref } from "@/lib/whatsapp-links";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return [{ slug: PRIMARY_PRODUCT_SLUG }];
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const [result, businessName] = await Promise.all([
    loadPublishedProduct(slug),
    getBusinessName(),
  ]);

  const productName = result.status === "ok" ? result.product.name : PRIMARY_PRODUCT_FALLBACK_NAME;
  return {
    title: `${productName} – ${businessName.name}`,
    description: `Pilihan pemesanan ${productName} (1 kg, 10 kg, 20 kg) langsung via WhatsApp. Cek ketersediaan stok terbaru.`,
  };
}

export default function ProductDetailPage(props: PageProps) {
  return (
    <div className="py-12 md:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <nav aria-label="Breadcrumb" className="mb-6 flex items-center gap-2 text-sm text-ink-muted">
          <Link href="/" className="hover:text-ink transition">
            Beranda
          </Link>
          <span>/</span>
          <Link href="/produk" className="hover:text-ink transition">
            Produk
          </Link>
          <span>/</span>
          <span className="font-medium text-ink">Ikan Nila</span>
        </nav>

        <Suspense fallback={<ProductDetailSkeleton />}>
          <ProductDetailContent params={props.params} />
        </Suspense>
      </div>
    </div>
  );
}

async function ProductDetailContent({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const result = await loadPublishedProduct(slug);

  if (result.status === "not_found") {
    notFound();
  }

  const productName = result.status === "ok" ? result.product.name : PRIMARY_PRODUCT_FALLBACK_NAME;
  const description = result.status === "ok" ? result.product.shortDescription : null;
  const display = getProductDisplay(
    result.status === "ok"
      ? { status: "ok", data: result.product.stockPrice }
      : { status: "error" },
  );

  return (
    <div className="space-y-10">
      <div className="overflow-hidden rounded-[1.75rem] border border-line bg-surface shadow-sm">
        <div className="grid md:grid-cols-[0.85fr_1.15fr]">
          <div className="bg-accent-soft/50 p-6 flex flex-col justify-center">
            <Placeholder
              label="Foto produk"
              note="Foto asli menyusul dari pemilik usaha."
              className="flex h-full min-h-64 flex-col items-center justify-center text-center md:min-h-80"
            />
          </div>

          <div className="flex flex-col gap-6 p-6 sm:p-8">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">
                {productName}
              </h1>
              {description ? (
                <p className="mt-3 leading-7 text-ink-muted">{description}</p>
              ) : (
                <p className="mt-3 leading-7 text-ink-muted">
                  Ikan nila segar segar berkualitas, dibudidayakan dengan pakan bernutrisi dan air bersih
                  terawat. Siap dipesan untuk kebutuhan harian rumah tangga, katering, maupun restoran.
                </p>
              )}
            </div>

            {display.status === "ok" ? (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-line p-4">
                    <p className="flex items-center gap-2 text-sm font-medium text-ink-muted">
                      <ScaleIcon className="size-5 text-accent-strong" />
                      Status Stok Saat Ini
                    </p>
                    <p className="mt-1 text-2xl font-bold tracking-tight text-ink">
                      {display.stock.label}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-line p-4">
                    <p className="flex items-center gap-2 text-sm font-medium text-ink-muted">
                      <TagIcon className="size-5 text-accent-strong" />
                      Harga Satuan Dasar
                    </p>
                    <p className="mt-1 text-2xl font-bold tracking-tight text-ink">
                      {display.price.label}
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl bg-neutral-soft/70 p-4 text-sm leading-6 text-ink-muted">
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <ClockIcon className="size-5 shrink-0 text-accent-strong" />
                    <span className="font-semibold text-ink">{CONFIRMED_AT_HEADING}</span>
                    <span className="font-medium text-ink">{display.confirmedAtLabel}</span>
                  </p>
                  <p className="mt-2">{CONFIRMED_AT_EXPLANATION}</p>
                </div>
              </>
            ) : null}
          </div>
        </div>
      </div>

      {/* Pilihan Paket Kuantitas */}
      <div className="rounded-[1.75rem] border border-line bg-surface p-6 sm:p-8 shadow-sm">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold tracking-wide uppercase text-accent-strong">
            Pemesanan Cepat
          </p>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
            Pilih Kuantitas Pesanan Anda
          </h2>
          <p className="mt-2 text-ink-muted">
            Pilih paket kuantitas di bawah untuk langsung menghubungi penjual via WhatsApp dengan
            pesan pesanan yang sudah otomatis disiapkan.
          </p>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {VOLUME_TIERS.map((tier) => {
            const orderWaHref = getVolumeOrderWhatsAppHref(tier.kg, productName, slug);

            return (
              <div
                key={tier.kg}
                className="flex flex-col justify-between rounded-2xl border border-line bg-cream/40 p-6 transition duration-200 hover:border-accent-strong hover:shadow-md"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="rounded-full bg-accent-soft px-3 py-1 text-xs font-bold text-accent-strong">
                      Paket {tier.label}
                    </span>
                    {tier.savingsNote ? (
                      <span className="rounded-full bg-warn-soft px-2.5 py-0.5 text-xs font-semibold text-warn-ink">
                        {tier.savingsNote}
                      </span>
                    ) : null}
                  </div>

                  <p className="mt-5 text-3xl font-extrabold tracking-tight text-ink">
                    {tier.priceFormatted}
                  </p>
                  <p className="mt-1 text-sm text-ink-muted">
                    Setara {tier.pricePerKgFormatted}
                  </p>

                  <ul className="mt-5 space-y-2 text-sm text-ink-muted">
                    <li className="flex items-center gap-2">
                      <span className="text-accent-strong font-bold">✓</span> Ikan nila segar hidup / bersih
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-accent-strong font-bold">✓</span> Ditimbang transparan
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-accent-strong font-bold">✓</span> Pesan via WhatsApp
                    </li>
                  </ul>
                </div>

                <div className="mt-8 pt-4 border-t border-line/60">
                  <WhatsAppButton
                    href={orderWaHref}
                    label={`Pesan ${tier.label}`}
                    className="w-full"
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ProductDetailSkeleton() {
  return (
    <div className="min-h-96 rounded-[1.75rem] border border-line bg-surface p-8" aria-busy="true">
      <div className="h-8 w-64 rounded bg-neutral-soft" />
      <div className="mt-4 h-5 w-full max-w-xl rounded bg-neutral-soft" />
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <div className="h-64 rounded-2xl bg-neutral-soft" />
        <div className="h-64 rounded-2xl bg-neutral-soft" />
        <div className="h-64 rounded-2xl bg-neutral-soft" />
      </div>
    </div>
  );
}
