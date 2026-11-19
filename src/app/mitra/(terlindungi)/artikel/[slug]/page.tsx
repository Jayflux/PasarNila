import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ArticleForm } from "@/components/panel/article-form";
import { PanelLoadError } from "@/components/panel/panel-load-error";
import { SectionHeading } from "@/components/publik/section-heading";
import { loadArticleForPartner } from "@/lib/data/article-detail";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export const metadata: Metadata = {
  title: "Sunting Artikel – Panel Mitra",
  robots: { index: false, follow: false },
};

export const instant = false;

/** Editor artikel (PRD FR-23, FR-27, AC-37–AC-41). */
export default async function EditArticlePage({ params }: PageProps) {
  const { slug } = await params;
  const result = await loadArticleForPartner(slug);

  if (result.status === "not_found") notFound();

  const breadcrumb = (
    <nav aria-label="Breadcrumb" className="mb-4 flex flex-wrap items-center gap-2 text-xs text-ink-muted">
      <Link href="/mitra" className="transition hover:text-ink">
        Panel mitra
      </Link>
      <span aria-hidden="true">/</span>
      <Link href="/mitra/artikel" className="transition hover:text-ink">
        Artikel
      </Link>
    </nav>
  );

  if (result.status === "error") {
    return (
      <div className="space-y-6">
        {breadcrumb}
        <PanelLoadError what="artikel" />
      </div>
    );
  }

  const { article } = result;
  return (
    <div className="space-y-8">
      <div>
        {breadcrumb}
        <SectionHeading
          id="sunting-artikel-judul"
          level="h1"
          eyebrow="Editor artikel"
          title={article.title}
          description="Perbarui judul dan isi. Gunakan tab Pratinjau untuk melihat tampilan sebelum menyimpan."
        />
      </div>
      <ArticleForm
        slug={article.slug}
        initialTitle={article.title}
        initialBody={article.body}
        initialUpdatedAt={article.updatedAt}
      />
    </div>
  );
}
