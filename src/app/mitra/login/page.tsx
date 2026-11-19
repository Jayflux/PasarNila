import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { LoginForm } from "@/components/panel/login-form";
import { getPartnerAccess } from "@/lib/auth/require-partner";
import { getBusinessName } from "@/lib/data/site-settings";

export const instant = false;

export async function generateMetadata(): Promise<Metadata> {
  const businessName = await getBusinessName();
  return {
    title: `Login Mitra – ${businessName.name}`,
    robots: { index: false, follow: false },
  };
}

/** Login mitra (PRD FR-15, AC-17). Bila sesi aktif sudah terverifikasi sebagai mitra → /mitra. */
export default async function LoginPage() {
  const access = await getPartnerAccess();
  if (access.status === "partner") redirect("/mitra");

  const businessName = await getBusinessName();

  return (
    <main className="flex min-h-screen flex-col justify-center bg-cream px-4 py-12 sm:px-6 lg:px-8">
      <div className="text-center sm:mx-auto sm:w-full sm:max-w-md">
        <Link href="/" className="inline-block text-2xl font-bold tracking-tight text-deep" title="Kembali ke beranda">
          {businessName.name}
        </Link>
        <h1 className="mt-4 text-xl font-bold tracking-tight text-ink sm:text-2xl">Masuk ke panel mitra</h1>
        <p className="mt-2 text-sm text-ink-muted">Pembaruan stok, harga, paket katalog, dan artikel.</p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="rounded-[1.75rem] border border-line bg-surface p-8 shadow-sm sm:px-10">
          <LoginForm />
        </div>
        <div className="mt-8 text-center">
          <Link href="/" className="text-sm font-medium text-accent-strong hover:underline">
            ← Kembali ke website publik
          </Link>
        </div>
      </div>
    </main>
  );
}
