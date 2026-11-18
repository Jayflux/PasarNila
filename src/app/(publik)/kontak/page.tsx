import type { Metadata } from "next";

import { MapEmbed } from "@/components/publik/map-embed";
import { Placeholder } from "@/components/publik/placeholder";
import { SectionHeading } from "@/components/publik/section-heading";
import { WhatsAppButton } from "@/components/publik/whatsapp-button";
import { buttonClass } from "@/components/ui/button-styles";
import { ChatIcon, ExternalIcon, PinIcon } from "@/components/ui/icons";
import { site } from "@/config/site";
import { getBusinessName } from "@/lib/data/site-settings";
import { getGeneralWhatsAppHref, getWhatsAppDisplayNumber } from "@/lib/whatsapp-links";

export async function generateMetadata(): Promise<Metadata> {
  const businessName = await getBusinessName();
  return {
    title: `Kontak – ${businessName.name}`,
    description: `Kontak ${businessName.name}: chat WhatsApp untuk pertanyaan dan pemesanan ikan nila, serta alamat usaha.`,
  };
}

/**
 * Kontak (PRD §7, §1.1): WhatsApp (nomor hanya dari env, §13.2), alamat + tautan Google Maps, dan jam
 * operasional (placeholder sampai klien memberikan, K9). Tanpa janji layanan yang belum dikonfirmasi.
 */
export default async function KontakPage() {
  const businessName = await getBusinessName();
  const whatsappHref = getGeneralWhatsAppHref(businessName);
  const whatsappNumber = getWhatsAppDisplayNumber();

  return (
    <div className="py-16 md:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading
          id="kontak-page-judul"
          eyebrow="Kontak"
          title={`Hubungi ${businessName.name}`}
          description="Pertanyaan dan pemesanan dilayani lewat chat WhatsApp. Transaksi disepakati di sana; website ini tidak mencatat pesanan."
        />

        <div className="mt-12 grid gap-8 md:grid-cols-2">
          <div className="flex flex-col justify-between rounded-[1.75rem] border border-line bg-surface p-8 shadow-sm">
            <div>
              <div className="inline-flex size-12 items-center justify-center rounded-2xl bg-wa/10 text-wa">
                <ChatIcon className="size-6" />
              </div>
              <h2 className="mt-6 text-2xl font-bold text-ink">Chat WhatsApp</h2>
              <div className="mt-6 rounded-2xl border border-line bg-cream/70 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-accent-strong">Nomor WhatsApp</p>
                <p className="mt-1 text-2xl font-extrabold text-ink">{whatsappNumber ?? "Belum tersedia"}</p>
              </div>
              <div className="mt-6">
                <p className="text-xs font-semibold uppercase tracking-wide text-accent-strong">Jam operasional</p>
                {site.operatingHours && site.operatingHours.length > 0 ? (
                  <ul className="mt-1 space-y-1 text-sm text-ink">
                    {site.operatingHours.map((row) => (
                      <li key={row.day}>
                        <span className="font-medium">{row.day}:</span> {row.hours}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <Placeholder label="Jam operasional" className="mt-2" />
                )}
              </div>
            </div>
            <div className="mt-8 border-t border-line pt-4">
              <WhatsAppButton href={whatsappHref} label="Mulai chat WhatsApp" className="w-full" />
            </div>
          </div>

          <div className="flex flex-col justify-between rounded-[1.75rem] border border-line bg-surface p-8 shadow-sm">
            <div>
              <div className="inline-flex size-12 items-center justify-center rounded-2xl bg-accent-strong/10 text-accent-strong">
                <PinIcon className="size-6" />
              </div>
              <h2 className="mt-6 text-2xl font-bold text-ink">Alamat usaha</h2>
              {site.address ? (
                <address className="mt-4 rounded-2xl border border-line bg-cream/70 p-4 text-sm leading-6 text-ink not-italic">
                  {site.address}
                </address>
              ) : (
                <Placeholder label="Alamat" className="mt-6" />
              )}
            </div>
            {site.mapsUrl ? (
              <div className="mt-8 border-t border-line pt-4">
                <a
                  href={site.mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`w-full ${buttonClass("secondary")}`}
                >
                  Buka di Google Maps
                  <ExternalIcon className="size-4" />
                  <span className="sr-only"> (tab baru)</span>
                </a>
              </div>
            ) : null}
          </div>
        </div>

        {site.address ? (
          <section aria-labelledby="kontak-peta-judul" className="mt-12 rounded-[1.75rem] border border-line bg-surface p-6 shadow-sm">
            <h2 id="kontak-peta-judul" className="mb-4 text-lg font-bold text-ink">
              Peta
            </h2>
            <MapEmbed address={site.address} className="aspect-[16/9] md:aspect-[21/9]" />
          </section>
        ) : null}
      </div>
    </div>
  );
}
