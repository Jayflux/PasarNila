import Link from "next/link";

import { WhatsAppButton } from "@/components/publik/whatsapp-button";
import { buttonClass } from "@/components/ui/button-styles";
import { ArrowRightIcon } from "@/components/ui/icons";
import type { CatalogPackage, PackagesResult } from "@/lib/data/packages";
import { logReadError } from "@/lib/data/log";
import {
  comparisonLabel,
  computePackagePricing,
  effectivePerKgLabel,
  packageAvailability,
  savingsBadgeLabel,
  type PackageAvailability,
  type PackagePricing,
} from "@/lib/domain/package-pricing";
import { formatKg, formatPricePerKg, formatRupiah } from "@/lib/format/number";
import { getPackageWhatsAppHref, getProductWhatsAppHref } from "@/lib/whatsapp-links";

/**
 * Pilihan paket katalog (PRD §12.8, AC-53–AC-60). Dipakai beranda & katalog (`compact`) serta detail
 * produk (`full`). Semua angka dari database; penghematan & harga efektif dihitung saat render dari harga
 * satuan per kg SAAT INI.
 *
 * Komponen ini hanya dirender bila data produk berhasil dimuat; bila produk gagal dimuat, pemanggil
 * menampilkan pesan gangguan dan tidak menampilkan harga paket sama sekali.
 */
type Props = {
  variant: "compact" | "full";
  productName: string;
  slug: string;
  /** Stok total bersama (kg); `null` = belum pernah diisi. */
  stockKg: number | null;
  /** Harga satuan per kg saat ini; `null` = belum tersedia. */
  unitPricePerKgIdr: number | null;
  packages: PackagesResult;
};

type Offer = { pkg: CatalogPackage; pricing: PackagePricing; availability: PackageAvailability };

function buildOffers(packages: CatalogPackage[], stockKg: number | null, unitPrice: number | null): Offer[] | null {
  try {
    return packages.map((pkg) => ({
      pkg,
      pricing: computePackagePricing({
        weightKg: pkg.weightKg,
        priceTotalIdr: pkg.priceTotalIdr,
        unitPricePerKgIdr: unitPrice,
      }),
      availability: packageAvailability(stockKg, pkg.weightKg),
    }));
  } catch (error) {
    logReadError("product_packages", error);
    return null;
  }
}

const AVAILABILITY_NOTE: Readonly<Record<PackageAvailability, string | null>> = {
  within_recorded_stock: null,
  exceeds_recorded_stock: "Melebihi stok tercatat. Ketersediaan perlu dikonfirmasi lewat WhatsApp.",
  out_of_stock: "Stok tercatat sedang habis.",
  unknown: "Stok belum tercatat di website. Ketersediaan perlu dikonfirmasi lewat WhatsApp.",
};

const WHATSAPP: Readonly<
  Record<PackageAvailability, { kind: "package_order" | "package_check" | "package_out_of_stock"; label: string }>
> = {
  within_recorded_stock: { kind: "package_order", label: "Pesan paket ini" },
  exceeds_recorded_stock: { kind: "package_check", label: "Tanya ketersediaan paket" },
  unknown: { kind: "package_check", label: "Tanya ketersediaan paket" },
  out_of_stock: { kind: "package_out_of_stock", label: "Tanya kapan tersedia" },
};

export function PackageOffers({ variant, productName, slug, stockKg, unitPricePerKgIdr, packages }: Props) {
  const inquiryHref = getProductWhatsAppHref(
    stockKg === null ? "product_unknown" : stockKg === 0 ? "product_out_of_stock" : "product_available",
    productName,
    slug,
  );

  if (packages.status === "error") {
    return (
      <div role="status" className="rounded-2xl border border-error-ink/20 bg-error-soft p-4 text-error-ink">
        <p className="font-semibold">Pilihan paket sedang tidak dapat dimuat</p>
        <p className="mt-1 text-sm leading-6">Muat ulang halaman beberapa saat lagi, atau tanyakan langsung melalui WhatsApp.</p>
      </div>
    );
  }

  const offers = buildOffers(packages.packages, stockKg, unitPricePerKgIdr);
  if (offers === null) {
    return (
      <div role="status" className="rounded-2xl border border-error-ink/20 bg-error-soft p-4 text-error-ink">
        <p className="font-semibold">Pilihan paket sedang tidak dapat ditampilkan</p>
      </div>
    );
  }

  if (offers.length === 0) {
    return (
      <div className="rounded-2xl border border-line bg-cream/50 p-4 text-sm leading-6 text-ink-muted">
        <p>Belum ada pilihan paket. Silakan tanyakan jumlah dan harga melalui WhatsApp.</p>
        {variant === "full" ? (
          <WhatsAppButton href={inquiryHref} label="Tanya via WhatsApp" className="mt-4" />
        ) : null}
      </div>
    );
  }

  const comparisonNote =
    unitPricePerKgIdr === null
      ? "Harga satuan per kg belum tersedia, jadi pembanding dan penghematan tidak ditampilkan."
      : `Penghematan dihitung dari harga satuan saat ini (${formatPricePerKg(unitPricePerKgIdr)}).`;

  if (variant === "compact") {
    return (
      <div>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {offers.map(({ pkg, pricing }) => (
            <li key={pkg.id} className="rounded-2xl border border-line bg-cream/50 p-4">
              <p className="font-semibold text-ink">{pkg.name}</p>
              <p className="text-sm text-ink-muted">{formatKg(pkg.weightKg)}</p>
              <p className="mt-1 text-xl font-bold text-ink">{formatRupiah(pkg.priceTotalIdr)}</p>
              <p className="text-xs text-ink-muted">{effectivePerKgLabel(pricing.effectivePerKg)}</p>
              <SavingsBadge pricing={pricing} className="mt-2" />
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs leading-5 text-ink-muted">{comparisonNote}</p>
      </div>
    );
  }

  return (
    <div>
      <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {offers.map(({ pkg, pricing, availability }) => {
          const note = AVAILABILITY_NOTE[availability];
          const whatsapp = WHATSAPP[availability];
          const href = getPackageWhatsAppHref({
            kind: whatsapp.kind,
            productName,
            packageName: pkg.name,
            packageWeightLabel: formatKg(pkg.weightKg),
            packagePriceLabel: formatRupiah(pkg.priceTotalIdr),
            slug,
          });
          const comparison = comparisonLabel(pricing);
          return (
            <li
              key={pkg.id}
              className="flex flex-col justify-between rounded-2xl border border-line bg-cream/40 p-6 transition duration-200 hover:border-accent-strong/50 hover:shadow-md motion-safe:hover:-translate-y-0.5"
            >
              <article aria-labelledby={`paket-${pkg.id}`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <h3 id={`paket-${pkg.id}`} className="text-lg font-bold text-ink">
                    {pkg.name}
                  </h3>
                  <span className="rounded-full bg-accent-soft px-3 py-1 text-xs font-bold text-accent-strong">
                    {formatKg(pkg.weightKg)}
                  </span>
                </div>
                <p className="mt-4 text-3xl font-extrabold tracking-tight text-ink">{formatRupiah(pkg.priceTotalIdr)}</p>
                <p className="mt-1 text-sm text-ink-muted">{effectivePerKgLabel(pricing.effectivePerKg)}</p>
                <SavingsBadge pricing={pricing} className="mt-3" />
                {comparison ? <p className="mt-3 text-xs leading-5 text-ink-muted">{comparison}</p> : null}
                {note ? (
                  <p className="mt-3 rounded-xl bg-warn-soft px-3 py-2 text-xs font-medium leading-5 text-warn-ink">{note}</p>
                ) : null}
              </article>
              <div className="mt-6 border-t border-line/60 pt-4">
                <WhatsAppButton href={href} label={whatsapp.label} className="w-full" />
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-4 text-xs leading-5 text-ink-muted">
        {comparisonNote} Semua paket memakai stok total yang sama; menekan tombol WhatsApp tidak memesan atau
        mengurangi stok.
      </p>
    </div>
  );
}

/** Badge kuning di dalam kartu (bukan modal): hanya bila penghematan > 0 dan pembanding valid. */
function SavingsBadge({ pricing, className = "" }: { pricing: PackagePricing; className?: string }) {
  const label = savingsBadgeLabel(pricing);
  if (!label) return null;
  return (
    <span className={`inline-block rounded-full bg-warn-soft px-2.5 py-0.5 text-xs font-bold text-warn-ink ${className}`}>
      {label}
    </span>
  );
}

/** Tautan dari ringkasan (beranda/katalog) ke detail produk. */
export function PackageDetailLink({ slug }: { slug: string }) {
  return (
    <Link href={`/produk/${slug}`} className={buttonClass("primary")}>
      Lihat detail &amp; pilihan paket
      <ArrowRightIcon className="size-5 shrink-0" />
    </Link>
  );
}
