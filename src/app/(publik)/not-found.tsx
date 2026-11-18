import Link from "next/link";

import { buttonClass } from "@/components/ui/button-styles";

/** Halaman 404 di dalam layout publik (PRD §7: pesan ramah + tautan kembali). */
export default function PublicNotFound() {
  return (
    <section className="py-20 md:py-28">
      <div className="mx-auto max-w-xl px-4 text-center sm:px-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-accent-strong">404</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-ink">Halaman tidak ditemukan</h1>
        <p className="mt-4 leading-7 text-ink-muted">
          Alamat yang Anda buka tidak tersedia atau belum diterbitkan.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link href="/" className={buttonClass("primary")}>
            Kembali ke beranda
          </Link>
          <Link href="/produk" className={buttonClass("secondary")}>
            Lihat produk
          </Link>
        </div>
      </div>
    </section>
  );
}
