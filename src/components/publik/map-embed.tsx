import { ViewportMap } from "@/components/publik/viewport-map";
import { buildMapEmbedUrl } from "@/lib/maps";

/**
 * Peta Google tertanam dari ALAMAT TERTULIS (ARCHITECTURE.md §13.1).
 *
 * Peta mencari alamat, bukan pin usaha yang terverifikasi, jadi keterangannya selalu mengarahkan ke
 * tombol "Buka di Google Maps" (tautan yang dikonfirmasi klien). Iframe memuat konten pihak ketiga
 * Google (`loading="lazy"`, `sandbox`, `title` deskriptif, rasio responsif).
 */
export function MapEmbed({ address, className = "aspect-[4/3] md:aspect-[16/11]", waitForViewport = false }: {
  address: string; className?: string; waitForViewport?: boolean;
}) {
  const frame = (
    <iframe
      src={buildMapEmbedUrl(address)}
      title={`Peta Google Maps untuk alamat: ${address}`}
      loading="lazy"
      referrerPolicy="strict-origin-when-cross-origin"
      sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
      className={`block w-full border-0 ${className}`}
    />
  );
  return (
    <figure>
      <div className="overflow-hidden rounded-[1.75rem] border border-line bg-neutral-soft shadow-sm">
        {waitForViewport ? <ViewportMap className={className}>{frame}</ViewportMap> : frame}
      </div>
      <figcaption className="mt-3 text-sm leading-6 text-ink-muted">
        Peta mencari alamat tertulis dan bisa kurang tepat. Untuk titik lokasi yang sudah dikonfirmasi,
        gunakan tombol &ldquo;Buka di Google Maps&rdquo;.
      </figcaption>
    </figure>
  );
}
