import type { Metadata } from "next";

import { Placeholder } from "@/components/publik/placeholder";
import { SectionHeading } from "@/components/publik/section-heading";
import { WhatsAppButton } from "@/components/publik/whatsapp-button";
import { buttonClass } from "@/components/ui/button-styles";
import { ChatIcon, ExternalIcon, PinIcon } from "@/components/ui/icons";
import { site } from "@/config/site";
import { getBusinessName } from "@/lib/data/site-settings";
import { buildMapEmbedUrl } from "@/lib/maps";
import { getGeneralWhatsAppHref, getWhatsAppDisplayNumber } from "@/lib/whatsapp-links";

export async function generateMetadata(): Promise<Metadata> {
  const businessName = await getBusinessName();
  return {
    title: `Kontak & Pemesanan – ${businessName.name}`,
    description: `Hubungi ${businessName.name} untuk pemesanan ikan nila segar langsung melalui WhatsApp atau kunjungi lokasi kolam kami.`,
  };
}

export default async function KontakPage() {
  const businessName = await getBusinessName();
  const whatsappHref = getGeneralWhatsAppHref(businessName);
  const whatsappNumber = getWhatsAppDisplayNumber();

  return (
    <div className="py-16 md:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading
          id="kontak-page-judul"
          eyebrow="Kontak &amp; Pemesanan"
          title={`Hubungi ${businessName.name}`}
          description="Pemesanan, tanya ketersediaan stok, harga grosir, atau janji temu pengambilan ikan dapat langsung disampaikan melalui WhatsApp resmi kami."
        />

        <div className="mt-12 grid gap-8 md:grid-cols-2">
          {/* Card WhatsApp */}
          <div className="rounded-[1.75rem] border border-line bg-surface p-8 shadow-sm flex flex-col justify-between">
            <div>
              <div className="inline-flex size-12 items-center justify-center rounded-2xl bg-wa/10 text-wa">
                <ChatIcon className="size-6" />
              </div>
              <h3 className="mt-6 text-2xl font-bold text-ink">Chat WhatsApp</h3>
              <p className="mt-2 text-ink-muted leading-7">
                Saluran komunikasi utama kami. Respons cepat untuk konfirmasi stok, berat timbangan,
                dan estimasi siap ambil/kirim.
              </p>

              <div className="mt-6 rounded-2xl bg-cream/70 p-4 border border-line">
                <p className="text-xs uppercase tracking-wide font-semibold text-accent-strong">
                  Nomor WhatsApp Resmi:
                </p>
                <p className="mt-1 text-2xl font-extrabold text-ink">
                  {whatsappNumber ?? "Belum tersedia"}
                </p>
              </div>
            </div>

            <div className="mt-8 pt-4 border-t border-line">
              <WhatsAppButton
                href={whatsappHref}
                label="Mulai Chat WhatsApp Sekarang"
                className="w-full"
              />
            </div>
          </div>

          {/* Card Lokasi Kolam */}
          <div className="rounded-[1.75rem] border border-line bg-surface p-8 shadow-sm flex flex-col justify-between">
            <div>
              <div className="inline-flex size-12 items-center justify-center rounded-2xl bg-accent-strong/10 text-accent-strong">
                <PinIcon className="size-6" />
              </div>
              <h3 className="mt-6 text-2xl font-bold text-ink">Lokasi Kolam</h3>
              <p className="mt-2 text-ink-muted leading-7">
                Anda bisa datang langsung untuk melihat kondisi ikan atau mengambil pesanan yang sudah
                disepakati di WhatsApp.
              </p>

              {site.address ? (
                <div className="mt-6 rounded-2xl bg-cream/70 p-4 border border-line">
                  <p className="text-xs uppercase tracking-wide font-semibold text-accent-strong">
                    Alamat Lengkap:
                  </p>
                  <address className="mt-1 text-sm leading-6 text-ink not-italic">
                    {site.address}
                  </address>
                </div>
              ) : (
                <Placeholder label="Alamat lokasi" className="mt-6" />
              )}
            </div>

            {site.mapsUrl ? (
              <div className="mt-8 pt-4 border-t border-line">
                <a
                  href={site.mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`w-full ${buttonClass("secondary")}`}
                >
                  Buka Titik di Google Maps
                  <ExternalIcon className="size-4" />
                </a>
              </div>
            ) : null}
          </div>
        </div>

        {/* Peta Sematan Google */}
        {site.address ? (
          <div className="mt-12 overflow-hidden rounded-[1.75rem] border border-line bg-surface p-6 shadow-sm">
            <h3 className="text-lg font-bold text-ink mb-4">Peta Petunjuk Arah</h3>
            <div className="overflow-hidden rounded-2xl border border-line">
              <iframe
                src={buildMapEmbedUrl(site.address)}
                title={`Peta Google Maps alamat: ${site.address}`}
                loading="lazy"
                referrerPolicy="strict-origin-when-cross-origin"
                sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
                className="block aspect-[16/9] w-full border-0 md:aspect-[21/9]"
              />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
