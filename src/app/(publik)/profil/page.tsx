import type { Metadata } from "next";
import Link from "next/link";

import { Placeholder } from "@/components/publik/placeholder";
import { SectionHeading } from "@/components/publik/section-heading";
import { WhatsAppButton } from "@/components/publik/whatsapp-button";
import { buttonClass } from "@/components/ui/button-styles";
import { ExternalIcon, PinIcon } from "@/components/ui/icons";
import { site } from "@/config/site";
import { getBusinessName } from "@/lib/data/site-settings";
import { buildMapEmbedUrl } from "@/lib/maps";
import { getGeneralWhatsAppHref } from "@/lib/whatsapp-links";

export async function generateMetadata(): Promise<Metadata> {
  const businessName = await getBusinessName();
  return {
    title: `Profil Usaha – ${businessName.name}`,
    description: `Mengenal ${businessName.name}, pembudidaya dan penjual ikan nila segar di ${site.shortLocation ?? "Depok"}.`,
  };
}

export default async function ProfilPage() {
  const businessName = await getBusinessName();
  const whatsappHref = getGeneralWhatsAppHref(businessName);

  const facts: ReadonlyArray<{ term: string; detail: React.ReactNode }> = [
    { term: "Nama Usaha", detail: businessName.name },
    { term: "Komoditas Utama", detail: "Ikan Nila Segar (Konsumsi & Bibit)" },
    {
      term: "Wilayah Layanan",
      detail: site.shortLocation ?? "Meruyung, Limo, Kota Depok dan sekitarnya",
    },
    { term: "Metode Transaksi", detail: "Pemesanan & konfirmasi via chat WhatsApp, pengambilan di tempat / pengiriman sesuai kesepakatan" },
    {
      term: "Jam Buka / Operasional",
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
          <Placeholder label="Jam operasional menyusul dari pemilik usaha" />
        ),
    },
  ];

  return (
    <div className="py-16 md:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHeading
          id="profil-page-judul"
          eyebrow="Tentang Kami"
          title={`Profil ${businessName.name}`}
          description="Dedikasi kami dalam menghadirkan ikan nila segar berkualitas langsung dari kolam budidaya terawat."
        />

        <div className="mt-12 grid gap-10 md:grid-cols-[1.1fr_0.9fr] md:items-start">
          <div className="rounded-[1.75rem] border border-line bg-surface p-8 sm:p-10 shadow-sm space-y-6">
            <h3 className="text-xl font-bold tracking-tight text-ink">
              Tentang Budidaya Kami
            </h3>

            {site.profile ? (
              <p className="text-base leading-8 text-ink-muted">{site.profile}</p>
            ) : (
              <div className="space-y-4">
                <p className="text-base leading-8 text-ink">
                  <strong>{businessName.name}</strong> bergerak di bidang pembesaran dan penyediaan
                  ikan nila segar untuk kebutuhan konsumsi keluarga, warung makan, restoran, dan katering.
                </p>
                <p className="text-base leading-8 text-ink-muted">
                  Kami mengutamakan kualitas air kolam yang bersih, pakan bergizi teratur, serta penanganan
                  panen yang higienis agar ikan nila tetap hidup atau segar dengan rasa daging yang gurih alami
                  tanpa bau tanah.
                </p>
                <Placeholder
                  label="Cerita Lengkap Usaha"
                  note="Rincian sejarah dan visi usaha akan dilengkapi bersama pemilik."
                />
              </div>
            )}

            <div className="pt-4 flex flex-wrap gap-3">
              <Link href="/produk" className={buttonClass("primary")}>
                Lihat Stok &amp; Harga Ikan
              </Link>
              <WhatsAppButton href={whatsappHref} label="Hubungi Pemilik Usaha" />
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-line bg-cream/70 p-6 sm:p-8">
            <h3 className="text-lg font-bold text-ink">Informasi Singkat</h3>
            <dl className="mt-6 divide-y divide-line">
              {facts.map((fact) => (
                <div key={fact.term} className="py-4">
                  <dt className="text-xs font-semibold uppercase tracking-wider text-accent-strong">
                    {fact.term}
                  </dt>
                  <dd className="mt-1 text-sm leading-6 text-ink">{fact.detail}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>

        {/* Lokasi & Peta */}
        {site.address ? (
          <div className="mt-16 rounded-[1.75rem] border border-line bg-surface p-8 sm:p-10 shadow-sm">
            <div className="grid gap-8 md:grid-cols-[1fr_1fr] md:items-center">
              <div>
                <p className="text-sm font-semibold tracking-wide uppercase text-accent-strong">
                  Kunjungi Kolam Kami
                </p>
                <h3 className="mt-1 text-2xl font-bold text-ink">Alamat Kolam &amp; Penjualan</h3>
                <div className="mt-4 flex gap-3">
                  <PinIcon className="mt-1 size-5 shrink-0 text-accent-strong" />
                  <address className="text-base leading-7 text-ink not-italic">{site.address}</address>
                </div>
                {site.mapsUrl ? (
                  <div className="mt-6">
                    <a
                      href={site.mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={buttonClass("primary", "sm")}
                    >
                      Buka di Google Maps
                      <ExternalIcon className="size-4" />
                    </a>
                  </div>
                ) : null}
              </div>

              <div className="overflow-hidden rounded-2xl border border-line shadow-sm">
                <iframe
                  src={buildMapEmbedUrl(site.address)}
                  title={`Peta lokasi ${businessName.name}`}
                  loading="lazy"
                  referrerPolicy="strict-origin-when-cross-origin"
                  sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
                  className="block aspect-[16/10] w-full border-0"
                />
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
