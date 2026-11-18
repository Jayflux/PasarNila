import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ArticleForm } from "@/components/panel/article-form";
import { SectionHeading } from "@/components/publik/section-heading";
import { loadArticleForPartner } from "@/lib/data/article-detail";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = await loadArticleForPartner(slug);

  return {
    title: article ? `Sunting: ${article.title} – Panel Mitra` : "Sunting Artikel – Panel Mitra",
    robots: { index: false, follow: false },
  };
}

export default async function EditArticlePage({ params }: PageProps) {
  const { slug } = await params;
  const article = await loadArticleForPartner(slug);

  if (!article) {
    notFound();
  }

  return (
    <div className="space-y-8">
      <div>
        <nav aria-label="Breadcrumb" className="mb-4 flex items-center gap-2 text-xs text-ink-muted">
          <Link href="/mitra" className="hover:text-ink transition">
            Panel Mitra
          </Link>
          <span>/</span>
          <Link href="/mitra/artikel" className="hover:text-ink transition">
            Kelola Artikel
          </Link>
          <span>/</span>
          <span className="text-ink font-semibold truncate max-w-xs">{article.title}</span>
        </nav>

        <SectionHeading
          id="sunting-artikel-judul"
          eyebrow="Editor Artikel"
          title={`Sunting: ${article.title}`}
          description={`Perbarui judul dan isi artikel (${article.slug}). Anda dapat beralih ke tab Pratinjau Tampilan sebelum menyimpan.`}
        />
      </div>

      <ArticleForm
        slug={article.slug}
        initialTitle={article.title}
        initialBody={article.body}
      />
    </div>
  );
}
