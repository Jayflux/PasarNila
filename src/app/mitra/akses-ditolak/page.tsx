import type { Metadata } from "next";
import Link from "next/link";

import { signOutAction } from "@/lib/actions/auth";
import { buttonClass } from "@/components/ui/button-styles";

export const metadata: Metadata = {
  title: "Akses Ditolak – Panel Mitra",
  robots: { index: false, follow: false },
};

export default function AksesDitolakPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-cream px-4 py-12 sm:px-6">
      <div className="max-w-md w-full text-center rounded-[1.75rem] border border-line bg-surface p-8 sm:p-10 shadow-sm">
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-warn-soft text-warn-ink">
          <span className="text-2xl font-bold">!</span>
        </div>

        <h1 className="mt-5 text-2xl font-bold text-ink">Akses Ditolak</h1>
        <p className="mt-3 text-sm text-ink-muted leading-6">
          Akun ini berhasil login, tetapi <strong>tidak terdaftar sebagai mitra</strong> pengelola website ini,
          sehingga tidak dapat membuka panel atau mengubah data.
        </p>

        <div className="mt-8 space-y-3">
          <form action={signOutAction}>
            <button type="submit" className={`w-full ${buttonClass("secondary")}`}>
              Keluar &amp; Masuk dengan Akun Lain
            </button>
          </form>

          <Link
            href="/"
            className="block text-sm font-semibold text-accent-strong hover:underline pt-2"
          >
            ← Kembali ke Website Publik
          </Link>
        </div>
      </div>
    </div>
  );
}
