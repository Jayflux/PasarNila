import { Placeholder } from "@/components/publik/placeholder";
import { ClockIcon, ScaleIcon, TagIcon } from "@/components/ui/icons";
import { isPlaceholderText } from "@/lib/content/placeholder";
import {
  CONFIRMED_AT_EXPLANATION,
  CONFIRMED_AT_HEADING,
  type PriceStatus,
  type StockStatus,
} from "@/lib/domain/product-status";

/**
 * Potongan tampilan produk bersama untuk beranda, katalog, dan detail produk
 * (PRD §12.1–§12.3, AC-01–AC-12). Semua angka berasal dari database; tidak ada angka di kode.
 */

const factBox = "rounded-2xl border border-line p-4";
const factLabel = "flex items-center gap-2 text-sm font-medium text-ink-muted";

export function StockFact({ stock }: { stock: StockStatus }) {
  const valueClass =
    stock.kind === "available" ? "text-ink" : stock.kind === "out_of_stock" ? "text-warn-ink" : "text-neutral-ink";
  return (
    <div className={`${factBox} ${stock.kind === "out_of_stock" ? "bg-warn-soft/60" : ""}`}>
      <dt className={factLabel}>
        <ScaleIcon className="size-5 shrink-0 text-accent-strong" />
        Stok total
      </dt>
      <dd className={`mt-1 text-2xl font-bold tracking-tight ${valueClass}`}>{stock.label}</dd>
    </div>
  );
}

export function PriceFact({ price }: { price: PriceStatus }) {
  return (
    <div className={factBox}>
      <dt className={factLabel}>
        <TagIcon className="size-5 shrink-0 text-accent-strong" />
        Harga satuan
      </dt>
      <dd className={`mt-1 text-2xl font-bold tracking-tight ${price.kind === "set" ? "text-ink" : "text-neutral-ink"}`}>
        {price.label}
      </dd>
    </div>
  );
}

export function StockPriceFacts({ stock, price }: { stock: StockStatus; price: PriceStatus }) {
  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      <StockFact stock={stock} />
      <PriceFact price={price} />
    </dl>
  );
}

export function ConfirmedAtNote({ label }: { label: string }) {
  return (
    <div className="rounded-2xl bg-neutral-soft/70 p-4 text-sm leading-6 text-ink-muted">
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <ClockIcon className="size-5 shrink-0 text-accent-strong" />
        <span className="font-semibold text-ink">{CONFIRMED_AT_HEADING}</span>
        <span className="font-medium text-ink">{label}</span>
      </p>
      <p className="mt-2">{CONFIRMED_AT_EXPLANATION}</p>
    </div>
  );
}

/** PRD AC-12: pesan gangguan, BUKAN "Belum tersedia"/"Stok habis"/angka. WhatsApp tetap ditampilkan pemanggil. */
export function ProductLoadError({ message }: { message: string }) {
  return (
    <div role="status" className="rounded-2xl border border-error-ink/20 bg-error-soft p-4 text-error-ink">
      <p className="font-semibold">{message}</p>
      <p className="mt-1 text-sm leading-6">
        Silakan muat ulang halaman beberapa saat lagi, atau tanyakan langsung melalui WhatsApp.
      </p>
    </div>
  );
}

/** Deskripsi dari database; selama belum ada (K3), tampil placeholder, bukan kalimat karangan. */
export function ProductDescription({ description, className = "" }: { description: string | null; className?: string }) {
  return description && !isPlaceholderText(description) ? (
    <p className={`leading-7 text-ink-muted ${className}`}>{description}</p>
  ) : (
    <Placeholder label="Deskripsi produk" className={className} />
  );
}

/** Foto produk belum diberikan klien (K3): penanda jelas, bukan gambar yang menyerupai foto asli. */
export function ProductMedia({ className = "min-h-48 md:min-h-72" }: { className?: string }) {
  return (
    <div className="bg-accent-soft/50 p-4 sm:p-6">
      <Placeholder
        label="Foto produk"
        note="Foto asli menyusul dari pemilik usaha."
        className={`flex h-full flex-col items-center justify-center text-center ${className}`}
      />
    </div>
  );
}
