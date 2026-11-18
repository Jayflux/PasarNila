import { SiteFooter } from "@/components/publik/site-footer";
import { SiteHeader } from "@/components/publik/site-header";

/**
 * Layout halaman publik (ARCHITECTURE.md §6, §7): header, konten, footer.
 * Header & footer membaca nama usaha dari cache bertag `site-settings` (§12.5), sehingga tetap menjadi
 * bagian shell statis. Data stok/harga dibaca di dalam halaman, di balik <Suspense>.
 */
export default function PublicLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      <a
        href="#konten"
        className="sr-only rounded-full bg-deep px-4 py-2 font-semibold text-white focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50"
      >
        Langsung ke konten utama
      </a>
      <SiteHeader />
      <main id="konten" className="flex-1">
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
