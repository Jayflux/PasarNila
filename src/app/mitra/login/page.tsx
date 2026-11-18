import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { LoginForm } from "@/components/panel/login-form";
import { ProgramLogos } from "@/components/publik/program-logos";
import { getPartnerOrNull } from "@/lib/auth/require-partner";
import { getBusinessName } from "@/lib/data/site-settings";

export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  const businessName = await getBusinessName();
  return {
    title: `Login Mitra – ${businessName.name}`,
    robots: { index: false, follow: false },
  };
}

export default async function LoginPage() {
  const partner = await getPartnerOrNull();
  if (partner) {
    redirect("/mitra");
  }

  const businessName = await getBusinessName();

  return (
    <div className="flex min-h-screen flex-col justify-center bg-cream px-4 py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <Link href="/" className="inline-block" title="Kembali ke Beranda">
          <span className="text-2xl font-bold tracking-tight text-deep">
            {businessName.name}
          </span>
        </Link>
        <h1 className="mt-4 text-xl font-bold tracking-tight text-ink sm:text-2xl">
          Masuk ke Panel Pengelolaan
        </h1>
        <p className="mt-2 text-sm text-ink-muted">
          Pembaruan stok, harga per kg, dan konten informasi.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="rounded-[1.75rem] border border-line bg-surface p-8 shadow-sm sm:px-10">
          <LoginForm />
        </div>

        <div className="mt-8 flex flex-col items-center gap-3">
          <Link
            href="/"
            className="text-sm font-medium text-accent-strong hover:underline"
          >
            ← Kembali ke Website Publik
          </Link>

          <div className="pt-4 border-t border-line/60 flex flex-col items-center gap-2">
            <span className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider">
              Didukung Oleh Program:
            </span>
            <ProgramLogos size="sm" />
          </div>
        </div>
      </div>
    </div>
  );
}
