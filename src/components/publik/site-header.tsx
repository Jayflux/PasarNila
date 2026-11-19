import Link from "next/link";

import { MobileNav } from "@/components/publik/mobile-nav";
import { WhatsAppButton } from "@/components/publik/whatsapp-button";
import { PUBLIC_NAV } from "@/config/navigation";
import { getBusinessName } from "@/lib/data/site-settings";
import { getGeneralWhatsAppHref } from "@/lib/whatsapp-links";

/**
 * Header publik. Nama usaha dari `site_settings` (ARCHITECTURE.md §12.5), ditampilkan sebagai teks
 * biasa; tidak ada logo karena logo resmi belum diberikan klien (PRD K2). Logo program pemerintah tidak
 * ditampilkan sampai dukungannya terkonfirmasi tertulis (PRD K16).
 */
export async function SiteHeader() {
  const businessName = await getBusinessName();
  const whatsappHref = getGeneralWhatsAppHref(businessName);

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-cream">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6">
        <Link
          href="/"
          prefetch={false}
          className="min-w-0 flex-1 rounded-md md:flex-none"
          title={businessName.name}
        >
          <span className="block truncate text-lg font-bold tracking-tight text-deep">
            {businessName.name}
          </span>
        </Link>

        <nav aria-label="Menu utama" className="hidden md:flex md:flex-1 md:justify-center">
          <ul className="flex items-center gap-1">
            {PUBLIC_NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  prefetch={false}
                  className="inline-flex min-h-11 items-center rounded-full px-4 text-[0.95rem] font-medium text-ink-muted transition hover:bg-accent-soft hover:text-deep"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* Keadaan nonaktif berlabel panjang: di HP tampil di dalam menu, di layar sedang tetap
            tersedia di hero dan bagian kontak, agar header tidak meluap. */}
        <div className={whatsappHref === null ? "hidden lg:block" : "shrink-0"}>
          <WhatsAppButton href={whatsappHref} label="WhatsApp" size="sm" />
        </div>

        <MobileNav
          items={PUBLIC_NAV}
          whatsappSlot={<WhatsAppButton href={whatsappHref} label="Tanya via WhatsApp" />}
        />
      </div>
    </header>
  );
}
