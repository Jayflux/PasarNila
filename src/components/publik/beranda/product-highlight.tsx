import { Suspense } from "react";
import Link from "next/link";

import { Placeholder } from "@/components/publik/placeholder";
import { SectionHeading } from "@/components/publik/section-heading";
import { WhatsAppButton } from "@/components/publik/whatsapp-button";
import { buttonClass } from "@/components/ui/button-styles";
import { ArrowRightIcon, ClockIcon, ScaleIcon, TagIcon } from "@/components/ui/icons";
import { HOME_SECTIONS } from "@/config/navigation";
import { isPlaceholderText } from "@/lib/content/placeholder";
import { logReadError } from "@/lib/data/log";
import {
  loadPublishedProduct,
  PRIMARY_PRODUCT_FALLBACK_NAME,
  PRIMARY_PRODUCT_SLUG,
} from "@/lib/data/products";
import { VOLUME_TIERS } from "@/lib/data/volume-pricing";
import {
  CONFIRMED_AT_EXPLANATION,
  CONFIRMED_AT_HEADING,
  getProductDisplay,
  type PriceStatus,
  type StockStatus,
} from "@/lib/domain/product-status";
import { getProductWhatsAppHref } from "@/lib/whatsapp-links";

/**
 * Sorotan produk tunggal Ikan Nila (PRD FR-01, §12.1–§12.3; ARCHITECTURE.md §12.2–§12.3).
 *
 * Judul & kerangka bagian ada di shell statis; angka stok/harga/waktu dibaca saat permintaan di
 * komponen `ProductHighlightCard` (tanpa cache) yang dibungkus <Suspense>. Tidak ada angka di kode.
 */
export function ProductHighlight() {
  return (
    <section
      id={HOME_SECTIONS.produk}
      aria-labelledby="produk-judul"
      className="py-16 md:py-24"
    >
      <div className="reveal mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading
          id="produk-judul"
          eyebrow="Produk"
          title="Stok dan harga ikan nila"
          description="Angka di bawah adalah data terakhir yang disimpan penjual, dibaca setiap kali halaman dibuka atau dimuat ulang."
        />
        <div className="mt-10">
          <Suspense fallback={<ProductHighlightSkeleton />}>
            <ProductHighlightCard />
          </Suspense>
        </div>
      </div>
    </section>
  );
}

const cardShell =
  "grid overflow-hidden rounded-[1.75rem] border border-line bg-surface shadow-sm md:grid-cols-[0.85fr_1.15fr]";

/** Foto produk belum diberikan klien (K3): penanda jelas, bukan gambar yang menyerupai foto asli. */
function ProductMedia() {
  return (
    <div className="bg-accent-soft/50 p-4 sm:p-6">
      <Placeholder
        label="Foto produk"
        note="Foto asli menyusul dari pemilik usaha."
        className="flex h-full min-h-48 flex-col items-center justify-center text-center md:min-h-72"
      />
    </div>
  );
}

async function ProductHighlightCard() {
  const result = await loadPublishedProduct(PRIMARY_PRODUCT_SLUG);

  if (result.status === "not_found") {
    // PRD NFR-13: tidak ada produk terbit.
    return (
      <div className={cardShell}>
        <ProductMedia />
        <div className="flex flex-col justify-center gap-5 p-6 sm:p-8">
          <p className="text-xl font-semibold text-ink">Produk belum tersedia</p>
          <WhatsAppButton
            href={getProductWhatsAppHref("product_unknown", PRIMARY_PRODUCT_FALLBACK_NAME)}
            label="Tanya via WhatsApp"
            className="self-start"
          />
        </div>
      </div>
    );
  }

  const display = getProductDisplay(
    result.status === "ok"
      ? { status: "ok", data: result.product.stockPrice }
      : { status: "error" },
  );
  if (display.status === "error" && display.reason === "invalid_data") {
    logReadError("products", new Error("nilai stok/harga/waktu tersimpan tidak konsisten"));
  }

  const productName = result.status === "ok" ? result.product.name : PRIMARY_PRODUCT_FALLBACK_NAME;
  const description = result.status === "ok" ? result.product.shortDescription : null;
  const whatsappHref = getProductWhatsAppHref(display.whatsAppMessageKind, productName);

  return (
    <article aria-labelledby="produk-nama" className={cardShell}>
      <ProductMedia />

      <div className="flex flex-col gap-6 p-6 sm:p-8">
        <div>
          <h3 id="produk-nama" className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">
            {productName}
          </h3>
          {result.status === "ok" ? (
            description && !isPlaceholderText(description) ? (
              <p className="mt-2 leading-7 text-ink-muted">{description}</p>
            ) : (
              <Placeholder label="Deskripsi produk" className="mt-3" />
            )
          ) : null}
        </div>

        {display.status === "ok" ? (
          <>
            <dl className="grid gap-3 sm:grid-cols-2">
              <StockFact stock={display.stock} />
              <PriceFact price={display.price} />
            </dl>

            <div className="rounded-2xl border border-line bg-cream/50 p-4">
              <p className="text-xs font-bold tracking-wide uppercase text-accent-strong">
                Pilihan Paket Kuantitas:
              </p>
              <div className="mt-2 grid grid-cols-3 gap-2 text-center text-xs sm:text-sm">
                {VOLUME_TIERS.map((tier) => (
                  <div key={tier.kg} className="rounded-xl border border-line/60 bg-surface p-2">
                    <p className="font-bold text-ink">{tier.label}</p>
                    <p className="text-accent-strong font-semibold">{tier.priceFormatted}</p>
                    <p className="text-[11px] text-ink-muted">{tier.pricePerKgFormatted}</p>
                  </div>
                ))}
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
        ) : (
          // PRD AC-12: pesan gangguan, bukan "Belum tersedia"/"Stok habis"/angka.
          <div className="rounded-2xl border border-error-ink/20 bg-error-soft p-4 text-error-ink">
            <p className="font-semibold">{display.message}</p>
            <p className="mt-1 text-sm leading-6">
              Silakan muat ulang halaman beberapa saat lagi, atau tanyakan langsung melalui WhatsApp.
            </p>
          </div>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Link
            href={`/produk/${PRIMARY_PRODUCT_SLUG}`}
            className={buttonClass("primary")}
          >
            Pilih Kuantitas Pesanan
            <ArrowRightIcon className="size-4 shrink-0" />
          </Link>
          <WhatsAppButton
            href={whatsappHref}
            label={`Tanya ${productName} via WhatsApp`}
          />
        </div>
      </div>
    </article>
  );
}

const factBox = "rounded-2xl border border-line p-4";
const factLabel = "flex items-center gap-2 text-sm font-medium text-ink-muted";

function StockFact({ stock }: { stock: StockStatus }) {
  const valueClass =
    stock.kind === "available"
      ? "text-ink"
      : stock.kind === "out_of_stock"
        ? "text-warn-ink"
        : "text-neutral-ink";
  return (
    <div className={`${factBox} ${stock.kind === "out_of_stock" ? "bg-warn-soft/60" : ""}`}>
      <dt className={factLabel}>
        <ScaleIcon className="size-5 shrink-0 text-accent-strong" />
        Stok
      </dt>
      <dd className={`mt-1 text-2xl font-bold tracking-tight ${valueClass}`}>{stock.label}</dd>
    </div>
  );
}

function PriceFact({ price }: { price: PriceStatus }) {
  return (
    <div className={factBox}>
      <dt className={factLabel}>
        <TagIcon className="size-5 shrink-0 text-accent-strong" />
        Harga Satuan
      </dt>
      <dd
        className={`mt-1 text-2xl font-bold tracking-tight ${price.kind === "set" ? "text-ink" : "text-neutral-ink"}`}
      >
        {price.label}
      </dd>
    </div>
  );
}

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
