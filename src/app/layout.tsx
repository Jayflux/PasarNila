import type { Metadata } from "next";

import { site } from "@/config/site";
import { isIndexingAllowed } from "@/lib/env";

import "./globals.css";

export const metadata: Metadata = {
  // Sementara memakai nama netral. Nama usaha dari tabel site_settings (getBusinessName, §12.5)
  // dipasang pada tahap halaman publik; nama usaha tidak ditulis langsung di komponen.
  title: site.fallbackDisplayName,
  // Seluruh situs noindex sampai peluncuran (PRD A-17, FR-30). Dibaca saat build.
  robots: isIndexingAllowed() ? undefined : { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className="h-full antialiased">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
