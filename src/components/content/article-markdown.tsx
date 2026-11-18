import Markdown, { defaultUrlTransform, type Components } from "react-markdown";

/**
 * Render isi artikel berformat Markdown dasar (PRD BR-A7, AC-40; ARCHITECTURE.md §10.2).
 *
 * Keamanan:
 * - `react-markdown` TANPA `rehype-raw` dan tanpa `dangerouslySetInnerHTML`. HTML mentah di dalam isi
 *   (mis. `<script>alert(1)</script>`) diubah menjadi teks biasa, tidak pernah menjadi elemen.
 * - Hanya elemen format dasar yang diizinkan: paragraf, subjudul, tebal/miring, daftar, kutipan, tautan.
 *   Elemen lain (gambar, tabel, kode) dibuka menjadi teks isinya (`unwrapDisallowed`).
 * - URL tautan disaring `defaultUrlTransform` (hanya http, https, mailto, tel, dan tautan relatif;
 *   `javascript:` dibuang).
 *
 * Komponen ini tidak memakai hook, sehingga dapat dirender di server (halaman publik) maupun di klien
 * (pratinjau panel).
 */
const ALLOWED_ELEMENTS = [
  "p",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "strong",
  "em",
  "ul",
  "ol",
  "li",
  "a",
  "br",
  "blockquote",
] as const;

const components: Components = {
  // Halaman artikel sudah memiliki <h1> (judul), jadi subjudul isi dimulai dari <h2>.
  h1: ({ children }) => <h2 className="mt-8 text-2xl font-bold tracking-tight text-ink">{children}</h2>,
  h2: ({ children }) => <h3 className="mt-6 text-xl font-bold tracking-tight text-ink">{children}</h3>,
  h3: ({ children }) => <h4 className="mt-5 text-lg font-semibold text-ink">{children}</h4>,
  h4: ({ children }) => <h4 className="mt-5 text-lg font-semibold text-ink">{children}</h4>,
  h5: ({ children }) => <h4 className="mt-5 text-lg font-semibold text-ink">{children}</h4>,
  h6: ({ children }) => <h4 className="mt-5 text-lg font-semibold text-ink">{children}</h4>,
  p: ({ children }) => <p className="mt-4 leading-8">{children}</p>,
  ul: ({ children }) => <ul className="mt-4 list-disc space-y-1 pl-6">{children}</ul>,
  ol: ({ children }) => <ol className="mt-4 list-decimal space-y-1 pl-6">{children}</ol>,
  blockquote: ({ children }) => (
    <blockquote className="mt-4 border-l-4 border-accent-soft pl-4 text-ink-muted">{children}</blockquote>
  ),
  a: ({ href, children }) => {
    const external = typeof href === "string" && /^https?:\/\//i.test(href);
    return (
      <a
        href={href}
        className="font-medium text-accent-strong underline underline-offset-4"
        {...(external ? { target: "_blank", rel: "nofollow noopener noreferrer" } : { rel: "nofollow" })}
      >
        {children}
        {external ? <span className="sr-only"> (tab baru)</span> : null}
      </a>
    );
  },
};

export function ArticleMarkdown({ source }: { source: string }) {
  return (
    <div className="text-base text-ink [&>*:first-child]:mt-0">
      <Markdown
        allowedElements={ALLOWED_ELEMENTS}
        unwrapDisallowed
        urlTransform={defaultUrlTransform}
        components={components}
      >
        {source}
      </Markdown>
    </div>
  );
}
