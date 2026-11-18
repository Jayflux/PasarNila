import { Placeholder } from "@/components/publik/placeholder";
import { SectionHeading } from "@/components/publik/section-heading";
import { buttonClass } from "@/components/ui/button-styles";
import { ExternalIcon, PinIcon } from "@/components/ui/icons";
import { HOME_SECTIONS } from "@/config/navigation";
import { site } from "@/config/site";
import { buildMapEmbedUrl } from "@/lib/maps";

/**
 * Lokasi usaha (PRD §1.1: alamat & tautan peta dikonfirmasi klien).
 *
 * - Alamat dan tautan dari `src/config/site.ts`; tidak ada koordinat tebakan.
 * - Peta sematan berada di dalam kartu (bukan latar), dimuat `lazy` di bawah lipatan, tanpa API key.
 *   Peta itu mencari ALAMAT TERTULIS, jadi bisa kurang tepat; tombol "Buka di Google Maps" memakai
 *   tautan berbagi yang dikonfirmasi klien membuka titik yang benar.
 */
export function LocationSection() {
  const { address, mapsUrl } = site;

  return (
    <section
      id={HOME_SECTIONS.lokasi}
      aria-labelledby="lokasi-judul"
      className="border-t border-line bg-surface py-16 md:py-24"
    >
      <div className="reveal mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 md:grid-cols-[0.9fr_1.1fr] md:items-center md:gap-14">
        <div>
          <SectionHeading id="lokasi-judul" eyebrow="Lokasi" title="Alamat usaha" />

          {address ? (
            <div className="mt-6 flex gap-3">
              <PinIcon className="mt-1 size-6 shrink-0 text-accent-strong" />
              <address className="text-base leading-7 text-ink not-italic">{address}</address>
            </div>
          ) : (
            <Placeholder label="Alamat" className="mt-6" />
          )}

          {mapsUrl ? (
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={`mt-7 w-full sm:w-auto ${buttonClass("primary")}`}
            >
              Buka di Google Maps
              <ExternalIcon className="size-5 shrink-0" />
              <span className="sr-only"> (tab baru)</span>
            </a>
          ) : null}
        </div>

        {address ? (
          <figure>
            <div className="overflow-hidden rounded-[1.75rem] border border-line bg-neutral-soft shadow-sm">
              <iframe
                src={buildMapEmbedUrl(address)}
                title={`Peta Google Maps untuk alamat: ${address}`}
                loading="lazy"
                referrerPolicy="strict-origin-when-cross-origin"
                sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
                className="block aspect-[4/3] w-full border-0 md:aspect-[16/11]"
              />
            </div>
            <figcaption className="mt-3 text-sm leading-6 text-ink-muted">
              Peta mencari alamat tertulis dan bisa kurang tepat. Untuk titik lokasi yang sudah
              dikonfirmasi, gunakan tombol &ldquo;Buka di Google Maps&rdquo;.
            </figcaption>
          </figure>
        ) : null}
      </div>
    </section>
  );
}
