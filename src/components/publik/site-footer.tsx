import Link from "next/link";

import { ChatIcon, ExternalIcon, PinIcon } from "@/components/ui/icons";
import { PUBLIC_NAV } from "@/config/navigation";
import { site } from "@/config/site";
import { getBusinessName } from "@/lib/data/site-settings";
import { getGeneralWhatsAppHref, getWhatsAppDisplayNumber } from "@/lib/whatsapp-links";

/**
 * Footer publik: identitas usaha, menu, alamat, dan kontak yang SUDAH tersedia (PRD §1.1).
 * Jam operasional belum diberikan klien (K9) sehingga tidak ditampilkan di sini. Logo program tidak
 * ditampilkan sampai dukungannya terkonfirmasi tertulis (PRD K16).
 */
export async function SiteFooter() {
  const businessName = await getBusinessName();
  const whatsappHref = getGeneralWhatsAppHref(businessName);
  const whatsappNumber = getWhatsAppDisplayNumber();

  return (
    <footer className="on-deep mt-auto bg-deep text-on-deep">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_1fr_1.4fr]">
        <div>
          <p className="text-lg font-bold tracking-tight">{businessName.name}</p>
          <p className="mt-2 max-w-xs text-sm leading-6 text-on-deep-muted">
            Informasi stok dan harga ikan nila. Pemesanan dilayani melalui chat WhatsApp.
          </p>
        </div>

        <nav aria-label="Menu footer">
          <p className="text-sm font-semibold tracking-wide text-accent-bright uppercase">Menu</p>
          <ul className="mt-3 grid grid-cols-2 gap-x-4 md:grid-cols-1">
            {PUBLIC_NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="inline-flex min-h-11 items-center text-sm text-on-deep-muted transition hover:text-on-deep md:min-h-9"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div>
          <p className="text-sm font-semibold tracking-wide text-accent-bright uppercase">Kontak</p>
          <ul className="mt-3 space-y-4 text-sm leading-6">
            {site.address ? (
              <li className="flex gap-3">
                <PinIcon className="mt-0.5 size-5 shrink-0 text-accent-bright" />
                <div>
                  <address className="text-on-deep-muted not-italic">{site.address}</address>
                  {site.mapsUrl ? (
                    <a
                      href={site.mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-flex min-h-11 items-center gap-1.5 font-medium text-on-deep underline decoration-accent-bright/60 underline-offset-4 hover:decoration-accent-bright md:min-h-0"
                    >
                      Buka di Google Maps
                      <ExternalIcon className="size-4" />
                      <span className="sr-only"> (tab baru)</span>
                    </a>
                  ) : null}
                </div>
              </li>
            ) : null}
            <li className="flex gap-3">
              <ChatIcon className="mt-0.5 size-5 shrink-0 text-accent-bright" />
              {whatsappHref !== null && whatsappNumber !== null ? (
                <a
                  href={whatsappHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center font-medium text-on-deep underline decoration-accent-bright/60 underline-offset-4 hover:decoration-accent-bright md:min-h-0"
                >
                  WhatsApp {whatsappNumber}
                  <span className="sr-only"> (membuka WhatsApp di tab baru)</span>
                </a>
              ) : (
                <span className="text-on-deep-muted">Nomor WhatsApp belum tersedia</span>
              )}
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10">
        <p className="mx-auto max-w-6xl px-4 py-5 text-xs text-on-deep-muted sm:px-6">
          © {businessName.name}. Website informasi; transaksi disepakati melalui WhatsApp.
        </p>
      </div>
    </footer>
  );
}
