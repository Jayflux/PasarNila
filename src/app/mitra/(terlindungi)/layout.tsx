import Link from "next/link";

import { buttonClass } from "@/components/ui/button-styles";
import { signOutAction } from "@/lib/actions/auth";
import { requirePartnerPage } from "@/lib/auth/require-partner";
import { getBusinessName } from "@/lib/data/site-settings";

export const instant = false;

const PANEL_NAV = [
  { label: "Stok & Harga", href: "/mitra" },
  { label: "Paket Katalog", href: "/mitra/paket" },
  { label: "Artikel", href: "/mitra/artikel" },
  { label: "Pengaturan", href: "/mitra/pengaturan" },
] as const;

/**
 * Layout panel mitra (ARCHITECTURE.md §5.2, §6, §9.8).
 *
 * - Tanpa sesi → /mitra/login; akun bukan mitra → /mitra/akses-ditolak (`requirePartnerPage`).
 * - Pemeriksaan akses gagal sementara → pesan gangguan; data panel TIDAK dirender.
 * - Setiap Server Action tetap memeriksa mitra sendiri; layout ini hanya untuk tampilan.
 */
export default async function ProtectedPanelLayout({ children }: { children: React.ReactNode }) {
  const access = await requirePartnerPage();
  const businessName = await getBusinessName();

  return (
    <div className="flex min-h-screen flex-col bg-cream">
      <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/mitra" className="truncate text-lg font-bold text-deep">
              {businessName.name}
            </Link>
            <span className="shrink-0 rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-bold uppercase text-accent-strong">
              Panel Mitra
            </span>
          </div>

          {access.status === "partner" ? (
            <nav aria-label="Menu panel" className="hidden items-center gap-1 md:flex">
              {PANEL_NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold text-ink-muted transition hover:bg-neutral-soft hover:text-ink"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          ) : null}

          <div className="flex shrink-0 items-center gap-3">
            <Link
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden text-xs font-semibold text-ink-muted transition hover:text-ink lg:inline-flex"
            >
              Lihat website ↗
            </Link>
            {access.status === "partner" && access.email ? (
              <span className="hidden max-w-36 truncate text-xs font-medium text-ink-muted xl:inline">
                {access.email}
              </span>
            ) : null}
            <form action={signOutAction}>
              <button type="submit" className={buttonClass("secondary", "sm")}>
                Keluar
              </button>
            </form>
          </div>
        </div>

        {access.status === "partner" ? (
          <nav aria-label="Menu panel (HP)" className="border-t border-line/60 bg-cream/40 md:hidden">
            <ul className="mx-auto grid max-w-6xl grid-cols-2 gap-1 px-2 py-2 sm:grid-cols-4">
              {PANEL_NAV.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="flex min-h-11 items-center justify-center rounded-lg px-2 text-center text-sm font-semibold text-ink-muted hover:bg-neutral-soft hover:text-ink"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}
      </header>

      <main className="flex-1 py-8 sm:py-12">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          {access.status === "partner" ? (
            children
          ) : (
            <div role="alert" className="rounded-[1.75rem] border border-warn-ink/25 bg-warn-soft p-6 text-warn-ink sm:p-8">
              <h1 className="text-xl font-bold">Pemeriksaan akses sedang terganggu</h1>
              <p className="mt-2 text-sm leading-6">
                Panel belum dapat memastikan hak akses akun Anda karena gangguan koneksi atau layanan. Ini
                bukan berarti akun Anda ditolak. Data panel tidak ditampilkan sampai pemeriksaan berhasil.
              </p>
              <a href="/mitra" className={`mt-4 ${buttonClass("secondary", "sm")}`}>
                Coba lagi
              </a>
            </div>
          )}
        </div>
      </main>

      <footer className="border-t border-line bg-surface py-4 text-center text-xs text-ink-muted">
        © {businessName.name} · Panel pengelolaan mitra
      </footer>
    </div>
  );
}
