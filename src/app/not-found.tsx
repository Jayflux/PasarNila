import Link from "next/link";

import { buttonClass } from "@/components/ui/button-styles";

/** 404 untuk alamat yang tidak cocok dengan route mana pun (PRD §7). */
export default function NotFound() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-20">
      <div className="max-w-xl text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-accent-strong">404</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-ink">Halaman tidak ditemukan</h1>
        <p className="mt-4 leading-7 text-ink-muted">Alamat yang Anda buka tidak tersedia.</p>
        <Link href="/" className={`mt-8 ${buttonClass("primary")}`}>
          Kembali ke beranda
        </Link>
      </div>
    </main>
  );
}
