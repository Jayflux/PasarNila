import type { Metadata } from "next";
import Link from "next/link";

import { buttonClass } from "@/components/ui/button-styles";
import { SectionHeading } from "@/components/publik/section-heading";
import { loadArticlesForPartner } from "@/lib/data/articles";
import { formatWib } from "@/lib/format/datetime";

export const metadata: Metadata = {
  title: "Kelola Artikel – Panel Mitra",
  robots: { index: false, follow: false },
};

export default async function PanelArtikelPage() {
  const articles = await loadArticlesForPartner();

  return (
    <div className="space-y-8">
      <SectionHeading
        id="panel-artikel-judul"
        eyebrow="Panel Pengelolaan"
        title="Kelola Artikel Edukasi"
        description="Sunting judul dan isi artikel panduan yang tampil di website publik. Perubahan akan langsung tayang ke pengunjung."
      />

      <div className="rounded-[1.75rem] border border-line bg-surface p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-ink">Daftar Artikel Tersedia</h2>
            <p className="text-xs text-ink-muted">
              Sesuai spesifikasi sistem, terdapat 2 slot artikel edukasi terbit yang dapat Anda perbarui isinya.
            </p>
          </div>
          <span className="inline-flex items-center rounded-full bg-accent-soft px-3 py-1 text-xs font-bold text-accent-strong self-start sm:self-auto">
            {articles.length} Artikel
          </span>
        </div>

        {articles.length > 0 ? (
          <div className="mt-6 space-y-4">
            {articles.map((article, idx) => (
              <div
                key={article.slug}
                className="rounded-2xl border border-line bg-cream/30 p-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between transition hover:border-accent-strong/40"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="rounded-md bg-deep text-white px-2 py-0.5 text-[11px] font-bold">
                      Slot #{idx + 1}
                    </span>
                    <span className="text-xs text-ink-muted">Slug: {article.slug}</span>
                  </div>
                  <h3 className="text-base font-bold text-ink">{article.title}</h3>
                  <p className="text-xs text-ink-muted">
                    {article.updatedAt
                      ? `Terakhir diperbarui: ${formatWib(article.updatedAt)}`
                      : "Belum pernah diperbarui"}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Link
                    href={`/artikel/${article.slug}`}
                    target="_blank"
                    className={`${buttonClass("secondary")} !text-xs !py-2 !px-3`}
                  >
                    Lihat Publik ↗
                  </Link>
                  <Link
                    href={`/mitra/artikel/${article.slug}`}
                    className={`${buttonClass("primary")} !text-xs !py-2 !px-4`}
                  >
                    Sunting Naskah
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-ink-muted">Belum ada artikel ditemukan di sistem.</p>
        )}
      </div>

      <div className="rounded-2xl border border-line bg-cream/40 p-5 text-xs text-ink-muted space-y-2">
        <p className="font-semibold text-ink">Catatan Kebijakan Konten:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Panjang judul dibatasi antara 1 hingga 150 karakter.</li>
          <li>Panjang isi artikel dibatasi hingga 20.000 karakter dalam format Markdown.</li>
          <li>Penghapusan atau penambahan slot artikel baru dinonaktifkan demi menjaga konsistensi tata letak publik (PRD FR-24).</li>
        </ul>
      </div>
    </div>
  );
}
