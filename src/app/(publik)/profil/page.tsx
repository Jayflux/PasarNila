import type { Metadata } from "next";
import Link from "next/link";

import { MapEmbed } from "@/components/publik/map-embed";
import { Placeholder } from "@/components/publik/placeholder";
import { SectionHeading } from "@/components/publik/section-heading";
import { WhatsAppButton } from "@/components/publik/whatsapp-button";
import { buttonClass } from "@/components/ui/button-styles";
import { ExternalIcon, PinIcon } from "@/components/ui/icons";
import { site } from "@/config/site";
import { getBusinessName } from "@/lib/data/site-settings";
import { getGeneralWhatsAppHref } from "@/lib/whatsapp-links";

export async function generateMetadata(): Promise<Metadata> {
  const businessName = await getBusinessName();
  const location = site.shortLocation ? ` di ${site.shortLocation}` : "";
  return {
    title: `Profil Usaha – ${businessName.name}`,
    description: `Profil ${businessName.name}, penjual ikan nila${location}. Pemesanan melalui chat WhatsApp.`,
  };
}

/**
 * Profil usaha (PRD §7, §1.1). Hanya fakta yang dikonfirmasi klien: nama (dari pengaturan), produk,
 * lokasi, dan cara pemesanan. Sejarah/gambaran usaha (K5), jam operasional (K9), dan foto (K4) tampil
 * sebagai placeholder sampai bahan klien tersedia; tidak ada klaim kualitas atau layanan karangan.
 */
export default async function ProfilPage() {
  const businessName = await getBusinessName();
  const whatsappHref = getGeneralWhatsAppHref(businessName);

  const facts: ReadonlyArray<{ term: string; detail: React.ReactNode }> = [
    { term: "Nama usaha", detail: businessName.name },
    { term: "Produk", detail: "Ikan nila merah" },
    { term: "Lokasi", detail: site.shortLocation ?? site.address ?? <Placeholder label="Lokasi" /> },
    { term: "Pemesanan", detail: "Lewat chat WhatsApp; transaksi disepakati di sana" },
    {
      term: "Jam operasional",
      detail:
        site.operatingHours && site.operatingHours.length > 0 ? (
          <ul className="space-y-1">
            {site.operatingHours.map((row) => (
              <li key={row.day}>
                <span className="font-medium">{row.day}:</span> {row.hours}
              </li>
            ))}
          </ul>
        ) : (
          <Placeholder label="Jam operasional" />
        ),
    },
  ];

  return (
    <div className="py-16 md:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading id="profil-page-judul" level="h1" eyebrow="Profil usaha" title={businessName.name} />

        <div className="mt-12 grid gap-10 md:grid-cols-[1.1fr_0.9fr] md:items-start">
          <div className="space-y-6 rounded-[1.75rem] border border-line bg-surface p-8 shadow-sm sm:p-10">
            <h2 className="text-xl font-bold tracking-tight text-ink">Tentang usaha</h2>
            {site.profile ? (
              <p className="text-base leading-8 text-ink-muted">{site.profile}</p>
            ) : (
              <Placeholder
                label="Sejarah dan gambaran usaha"
                note="Profil lengkap akan diisi dengan bahan dari pemilik usaha."
              />
            )}
            <Placeholder label="Foto usaha" note="Foto asli menyusul dari pemilik usaha." />
            <div className="flex flex-wrap gap-3 pt-2">
              <Link href="/produk" className={buttonClass("primary")}>
                Lihat stok &amp; harga
              </Link>
              <WhatsAppButton href={whatsappHref} label="Tanya via WhatsApp" />
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-line bg-cream/70 p-6 sm:p-8">
            <h2 className="text-lg font-bold text-ink">Informasi singkat</h2>
            <dl className="mt-6 divide-y divide-line">
              {facts.map((fact) => (
                <div key={fact.term} className="py-4">
                  <dt className="text-xs font-semibold uppercase tracking-wider text-accent-strong">{fact.term}</dt>
                  <dd className="mt-1 text-sm leading-6 text-ink">{fact.detail}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>

        {site.address ? (
          <section
            aria-labelledby="profil-lokasi-judul"
            className="mt-16 rounded-[1.75rem] border border-line bg-surface p-8 shadow-sm sm:p-10"
          >
            <div className="grid gap-8 md:grid-cols-2 md:items-start">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-accent-strong">Lokasi</p>
                <h2 id="profil-lokasi-judul" className="mt-1 text-2xl font-bold text-ink">
                  Alamat usaha
                </h2>
                <div className="mt-4 flex gap-3">
                  <PinIcon className="mt-1 size-5 shrink-0 text-accent-strong" />
                  <address className="text-base leading-7 text-ink not-italic">{site.address}</address>
                </div>
                {site.mapsUrl ? (
                  <a
                    href={site.mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`mt-6 ${buttonClass("primary", "sm")}`}
                  >
                    Buka di Google Maps
                    <ExternalIcon className="size-4" />
                    <span className="sr-only"> (tab baru)</span>
                  </a>
                ) : null}
              </div>
              <MapEmbed address={site.address} className="aspect-[16/10]" />
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
