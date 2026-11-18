import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ArticleMarkdown } from "@/components/content/article-markdown";
import { Placeholder } from "@/components/publik/placeholder";
import { ArrowRightIcon } from "@/components/ui/icons";
import { loadPublishedArticle } from "@/lib/data/article-detail";
import { getBusinessName } from "@/lib/data/site-settings";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const [result, businessName] = await Promise.all([
    loadPublishedArticle(slug),
    getBusinessName(),
  ]);

  if (result.status !== "ok") {
    return { title: `Artikel – ${businessName.name}` };
  }

  return {
    title: `${result.article.title} – ${businessName.name}`,
  };
}

/**
 * Detail artikel (PRD §7, AC-35, AC-40). Isi dirender sebagai Markdown dasar tanpa HTML mentah.
 * Slug tak dikenal ditolak 404 oleh `src/proxy.ts` sebelum streaming dimulai.
 */
export default function ArticleDetailPage(props: PageProps) {
  return (
    <div className="py-12 md:py-20">
      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        <nav aria-label="Breadcrumb" className="mb-8 flex items-center gap-2 text-sm text-ink-muted">
          <Link href="/" className="hover:text-ink transition">
            Beranda
          </Link>
          <span>/</span>
          <Link href="/artikel" className="hover:text-ink transition">
            Artikel
          </Link>
        </nav>

        <Suspense fallback={<ArticleDetailSkeleton />}>
          <ArticleDetailContent params={props.params} />
        </Suspense>
      </div>
    </div>
  );
}

async function ArticleDetailContent({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const result = await loadPublishedArticle(slug);

  if (result.status === "not_found") {
    notFound();
  }

  if (result.status === "error") {
    return (
      <div className="rounded-2xl border border-error-ink/20 bg-error-soft p-6 text-error-ink">
        <h1 className="text-xl font-bold">Artikel tidak dapat dimuat</h1>
        <p className="mt-2 text-sm">Silakan muat ulang halaman atau coba beberapa saat lagi.</p>
      </div>
    );
  }

  const { article } = result;

  if (article.isPlaceholder) {
    return (
      <div className="rounded-[1.75rem] border border-line bg-surface p-8 sm:p-12">
        <Placeholder
          label="Isi artikel"
          note="Judul dan isi menunggu bahan dari pemilik usaha."
          className="flex min-h-64 flex-col items-center justify-center text-center"
        />
        <div className="mt-8 text-center">
          <Link href="/artikel" className="text-sm font-semibold text-accent-strong hover:underline">
            ← Kembali ke daftar artikel
          </Link>
        </div>
      </div>
    );
  }

  return (
    <article className="rounded-[1.75rem] border border-line bg-surface p-8 sm:p-12 shadow-sm">
      <header className="border-b border-line pb-6">
        <span className="rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold text-accent-strong uppercase tracking-wide">
          Artikel
        </span>
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-ink sm:text-4xl text-balance">
          {article.title}
        </h1>
      </header>

      <div className="mt-8">
        <ArticleMarkdown source={article.body} />
      </div>

      <footer className="mt-12 pt-6 border-t border-line flex items-center justify-between">
        <Link
          href="/artikel"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent-strong hover:underline"
        >
          ← Kembali ke semua artikel
        </Link>
        <Link
          href="/produk"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-deep hover:underline"
        >
          Lihat stok &amp; harga
          <ArrowRightIcon className="size-4" />
        </Link>
      </footer>
    </article>
  );
}

function ArticleDetailSkeleton() {
  return (
    <div className="rounded-[1.75rem] border border-line bg-surface p-8 sm:p-12" aria-busy="true">
      <div className="h-6 w-24 rounded bg-neutral-soft" />
      <div className="mt-4 h-10 w-3/4 rounded bg-neutral-soft" />
      <div className="mt-8 space-y-3">
        <div className="h-4 w-full rounded bg-neutral-soft" />
        <div className="h-4 w-full rounded bg-neutral-soft" />
        <div className="h-4 w-2/3 rounded bg-neutral-soft" />
      </div>
    </div>
  );
}
