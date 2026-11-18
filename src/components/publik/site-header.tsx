import Link from "next/link";

import { MobileNav } from "@/components/publik/mobile-nav";
import { ProgramLogos } from "@/components/publik/program-logos";
import { WhatsAppButton } from "@/components/publik/whatsapp-button";
import { PUBLIC_NAV } from "@/config/navigation";
import { getBusinessName } from "@/lib/data/site-settings";
import { getGeneralWhatsAppHref } from "@/lib/whatsapp-links";

/**
 * Header publik. Menampilkan nama usaha (Juki Fish Farm) bersanding dengan logo mitra/program
 * pendamping (Diktisaintek, Ditjen Risbang, Mahasiswa Berdampak).
 */
export async function SiteHeader() {
  const businessName = await getBusinessName();
  const whatsappHref = getGeneralWhatsAppHref(businessName);

  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-cream/95 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/"
            className="min-w-0 rounded-md flex items-center gap-2"
            title={businessName.name}
          >
            <span className="block truncate text-lg font-bold tracking-tight text-deep">
              {businessName.name}
            </span>
          </Link>

          {/* Tiga logo program di sebelah nama usaha */}
          <div className="h-5 w-px bg-line/80 hidden sm:block" aria-hidden="true" />
          <ProgramLogos size="sm" className="hidden sm:flex shrink-0" />
        </div>

        <nav aria-label="Menu utama" className="hidden md:flex md:flex-1 md:justify-center">
          <ul className="flex items-center gap-1">
            {PUBLIC_NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="inline-flex min-h-11 items-center rounded-full px-4 text-[0.95rem] font-medium text-ink-muted transition hover:bg-accent-soft hover:text-deep"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-2">
          <div className={whatsappHref === null ? "hidden lg:block" : "shrink-0"}>
            <WhatsAppButton href={whatsappHref} label="WhatsApp" size="sm" />
          </div>

          <MobileNav
            items={PUBLIC_NAV}
            whatsappSlot={<WhatsAppButton href={whatsappHref} label="Tanya via WhatsApp" />}
          />
        </div>
      </div>
    </header>
  );
}
