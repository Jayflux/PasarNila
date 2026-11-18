import { Suspense } from "react";

import { Placeholder } from "@/components/publik/placeholder";
import { SectionHeading } from "@/components/publik/section-heading";
import { HOME_SECTIONS } from "@/config/navigation";
import { loadPublishedArticles, MAX_PUBLIC_ARTICLES } from "@/lib/data/articles";

/**
 * Bagian artikel beranda (PRD FR-01, BR-A1, BR-A4; ARCHITECTURE.md §12.3: dinamis di MVP).
 * Paling banyak dua kartu. Artikel bertanda [PLACEHOLDER] tampil sebagai placeholder yang jelas,
 * bukan menampilkan teks penanda mentahnya.
 *
 * TAHAP BERIKUTNYA: setelah route /artikel/[slug] dibuat, jadikan kartu artikel asli sebagai tautan
 * ke `/artikel/${slug}`. Sekarang kartu belum bertaut agar tidak ada tautan ke halaman 404.
 */
export function ArticlesSection() {
  return (
    <section id={HOME_SECTIONS.artikel} aria-labelledby="artikel-judul" className="py-16 md:py-24">
      <div className="reveal mx-auto max-w-6xl px-4 sm:px-6">
        {/* Topik artikel belum diketahui (isi menyusul), jadi judul bagian tidak menjanjikan topik. */}
        <SectionHeading id="artikel-judul" eyebrow="Bacaan" title="Artikel" />
        <div className="mt-10">
          <Suspense fallback={<ArticleCardsSkeleton />}>
            <ArticleCards />
          </Suspense>
        </div>
      </div>
    </section>
  );
}

const listClass = "grid gap-5 md:grid-cols-2";

async function ArticleCards() {
  const result = await loadPublishedArticles(MAX_PUBLIC_ARTICLES);

  if (result.status === "error") {
    return (
      <div className="rounded-2xl border border-error-ink/20 bg-error-soft p-4 text-error-ink">
        <p className="font-semibold">Artikel sedang tidak dapat dimuat</p>
        <p className="mt-1 text-sm leading-6">Silakan muat ulang halaman beberapa saat lagi.</p>
      </div>
    );
  }

  if (result.articles.length === 0) {
    // PRD NFR-13.
    return <p className="text-base text-ink-muted">Artikel belum tersedia</p>;
  }

  return (
    <ul className={listClass}>
      {result.articles.slice(0, MAX_PUBLIC_ARTICLES).map((article, index) => (
        <li key={article.slug}>
          {article.isPlaceholder ? (
            <Placeholder
              label={`Artikel ${index + 1}`}
              note="Judul dan isi menunggu bahan dari pemilik usaha."
              className="flex h-full min-h-40 flex-col justify-center"
            />
          ) : (
            <article className="flex h-full flex-col rounded-2xl border border-line bg-surface p-6 shadow-sm">
              <h3 className="text-xl font-semibold tracking-tight text-balance text-ink">
                {article.title}
              </h3>
              {article.excerpt ? (
                <p className="mt-3 leading-7 text-ink-muted">{article.excerpt}</p>
              ) : null}
            </article>
          )}
        </li>
      ))}
    </ul>
  );
}

function ArticleCardsSkeleton() {
  return (
    <div className={listClass} aria-busy="true">
      <p className="sr-only">Memuat artikel…</p>
      {Array.from({ length: MAX_PUBLIC_ARTICLES }, (_, index) => (
        <div key={index} className="min-h-40 rounded-2xl border border-line bg-surface p-6">
          <div className="h-6 w-3/4 rounded-lg bg-neutral-soft" />
          <div className="mt-4 h-4 w-full rounded bg-neutral-soft" />
          <div className="mt-2 h-4 w-2/3 rounded bg-neutral-soft" />
        </div>
      ))}
    </div>
  );
}
