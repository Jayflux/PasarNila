import Link from "next/link";

import { signOutAction } from "@/lib/actions/auth";
import { requirePartner } from "@/lib/auth/require-partner";
import { getBusinessName } from "@/lib/data/site-settings";
import { buttonClass } from "@/components/ui/button-styles";

export const instant = false;

const PANEL_NAV = [
  { label: "Stok & Harga", href: "/mitra" },
  { label: "Artikel", href: "/mitra/artikel" },
  { label: "Pengaturan", href: "/mitra/pengaturan" },
] as const;

export default async function ProtectedPanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requirePartner();
  const businessName = await getBusinessName();

  return (
    <div className="min-h-screen bg-cream flex flex-col">
      {/* Header Panel Mitra */}
      <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Link href="/mitra" className="flex items-center gap-2">
              <span className="font-bold text-deep text-lg">{businessName.name}</span>
            </Link>
            <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-bold text-accent-strong uppercase">
              Panel Mitra
            </span>
          </div>

          <nav aria-label="Menu panel" className="hidden sm:flex items-center gap-1">
            {PANEL_NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="inline-flex min-h-9 items-center rounded-lg px-3 text-sm font-semibold text-ink-muted transition hover:bg-neutral-soft hover:text-ink"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden md:inline-flex text-xs font-semibold text-ink-muted hover:text-ink transition"
            >
              Lihat Website ↗
            </Link>

            <span className="hidden lg:inline text-xs font-medium text-ink-muted truncate max-w-36">
              {session.email}
            </span>

            <form action={signOutAction}>
              <button
                type="submit"
                className={`text-xs ${buttonClass("secondary", "sm")}`}
              >
                Keluar
              </button>
            </form>
          </div>
        </div>

        {/* Navigasi Mobile Panel */}
        <div className="sm:hidden border-t border-line/60 px-4 py-2 flex items-center justify-around bg-cream/40">
          {PANEL_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-xs font-semibold text-ink-muted py-1 px-2 rounded hover:text-ink"
            >
              {item.label}
            </Link>
          ))}
        </div>
      </header>

      {/* Main Panel Content */}
      <main className="flex-1 py-8 sm:py-12">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">{children}</div>
      </main>

      <footer className="border-t border-line bg-surface py-4 text-center text-xs text-ink-muted">
        © {businessName.name} • Panel Pengelolaan Mitra Terproteksi RLS
      </footer>
    </div>
  );
}
