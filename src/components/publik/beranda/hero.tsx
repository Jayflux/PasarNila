import { HeroVisual } from "@/components/publik/beranda/hero-visual";
import { WhatsAppButton } from "@/components/publik/whatsapp-button";
import { buttonClass } from "@/components/ui/button-styles";
import { ArrowRightIcon, PinIcon } from "@/components/ui/icons";
import { HOME_SECTIONS } from "@/config/navigation";
import { site } from "@/config/site";
import type { BusinessName } from "@/lib/data/site-settings";

/**
 * Hero beranda. Semua kalimat faktual dari PRD §1, §1.1: produk tunggal ikan nila, lokasi, informasi
 * stok/harga/waktu pembaruan, dan pemesanan lewat WhatsApp. Tanpa klaim kualitas, promo, atau layanan
 * yang belum dikonfirmasi.
 */
type Props = {
  businessName: BusinessName;
  whatsappHref: string | null;
};

export function Hero({ businessName, whatsappHref }: Props) {
  // Nama cadangan ("Ikan Nila") tidak dipakai sebagai subjek kalimat agar tidak terbaca janggal.
  const seller = businessName.source === "settings" ? businessName.name : null;

  return (
    <section
      aria-labelledby="hero-judul"
      className="relative overflow-hidden bg-linear-to-b from-accent-soft/70 via-cream to-cream"
    >
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 pt-10 pb-16 sm:px-6 md:grid-cols-[1.1fr_0.9fr] md:gap-12 md:pt-16 md:pb-24">
        <div className="motion-safe:animate-rise">
          {site.shortLocation ? (
            <p className="inline-flex items-center gap-1.5 rounded-full border border-deep/15 bg-surface/80 px-3 py-1 text-sm font-medium text-deep">
              <PinIcon className="size-4 shrink-0 text-accent-strong" />
              {site.shortLocation}
            </p>
          ) : null}

          <h1
            id="hero-judul"
            className="mt-5 text-4xl leading-[1.1] font-bold tracking-tight text-balance text-ink sm:text-5xl"
          >
            Cek stok dan harga ikan nila sebelum memesan
          </h1>

          <p className="mt-5 max-w-xl text-lg leading-8 text-ink-muted">
            {seller ? (
              <>
                <strong className="font-semibold text-ink">{seller}</strong> menjual ikan nila.{" "}
              </>
            ) : null}
            Di sini tercantum stok dalam kilogram, harga per kilogram, dan waktu terakhir keduanya
            diperbarui penjual. Pemesanan dan transaksi dilayani lewat chat WhatsApp.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <a href={`#${HOME_SECTIONS.produk}`} className={buttonClass("primary")}>
              Lihat stok &amp; harga
              <ArrowRightIcon className="size-5 shrink-0" />
            </a>
            <WhatsAppButton href={whatsappHref} label="Tanya via WhatsApp" />
          </div>
        </div>

        <HeroVisual />
      </div>
    </section>
  );
}
