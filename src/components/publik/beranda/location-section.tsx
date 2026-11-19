import { MapEmbed } from "@/components/publik/map-embed";
import { Placeholder } from "@/components/publik/placeholder";
import { SectionHeading } from "@/components/publik/section-heading";
import { buttonClass } from "@/components/ui/button-styles";
import { ExternalIcon, PinIcon } from "@/components/ui/icons";
import { HOME_SECTIONS } from "@/config/navigation";
import { site } from "@/config/site";

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

        {address ? <MapEmbed address={address} waitForViewport /> : null}
      </div>
    </section>
  );
}
