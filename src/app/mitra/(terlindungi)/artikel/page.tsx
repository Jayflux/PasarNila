import type { Metadata } from "next";
import Link from "next/link";

import { PanelLoadError } from "@/components/panel/panel-load-error";
import { SectionHeading } from "@/components/publik/section-heading";
import { buttonClass } from "@/components/ui/button-styles";
import { loadArticlesForPartner } from "@/lib/data/articles";
import { formatWib } from "@/lib/format/datetime";

export const metadata: Metadata = {
  title: "Artikel – Panel Mitra",
  robots: { index: false, follow: false },
};

export const instant = false;

/** Daftar dua artikel yang dapat diedit (PRD FR-22, AC-39: tanpa tombol tambah/hapus). */
export default async function PanelArtikelPage() {
  const result = await loadArticlesForPartner();

  return (
    <div className="space-y-8">
      <SectionHeading
        id="panel-artikel-judul"
        level="h1"
        eyebrow="Panel pengelolaan"
        title="Artikel"
        description="Ubah judul dan isi artikel yang sudah tersedia. Alamat artikel tidak berubah."
      />

      {result.status === "error" ? (
        <PanelLoadError what="daftar artikel" />
      ) : result.articles.length === 0 ? (
        <p className="rounded-[1.75rem] border border-line bg-surface p-6 text-sm text-ink-muted">
          Belum ada artikel di database. Artikel awal disiapkan pengembang; mitra tidak menambah artikel baru.
        </p>
      ) : (
        <ul className="space-y-4">
          {result.articles.map((article) => (
            <li
              key={article.slug}
              className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0 space-y-1">
                <p className="text-xs text-ink-muted">/artikel/{article.slug}</p>
                <h2 className="text-base font-bold text-ink">{article.title}</h2>
                <p className="text-xs text-ink-muted">
                  {article.updatedAt ? `Terakhir diubah: ${formatWib(article.updatedAt)}` : "Belum pernah diubah"}
                  {article.isPublished ? "" : " · tidak tampil di website"}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  href={`/artikel/${article.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={buttonClass("secondary", "sm")}
                >
                  Lihat publik ↗
                </Link>
                <Link href={`/mitra/artikel/${article.slug}`} className={buttonClass("primary", "sm")}>
                  Sunting
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs leading-5 text-ink-muted">
        Menambah atau menghapus artikel tidak tersedia di panel (PRD §6). Isi memakai format Markdown dasar;
        HTML tidak dijalankan.
      </p>
    </div>
  );
}
