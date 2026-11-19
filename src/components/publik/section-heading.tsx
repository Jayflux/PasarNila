type Props = {
  id: string;
  eyebrow: string;
  title: string;
  description?: string;
  /** Untuk bagian berlatar gelap. */
  tone?: "light" | "deep";
  /** `h1` untuk judul utama halaman (satu per halaman, NFR-15); `h2` untuk bagian di dalam halaman. */
  level?: "h1" | "h2";
};

export function SectionHeading({ id, eyebrow, title, description, tone = "light", level = "h2" }: Props) {
  const deep = tone === "deep";
  const Heading = level;
  return (
    <div className="max-w-2xl">
      <p
        className={`text-sm font-semibold tracking-wide uppercase ${deep ? "text-accent-bright" : "text-accent-strong"}`}
      >
        {eyebrow}
      </p>
      <Heading
        id={id}
        className={`mt-2 text-3xl font-bold tracking-tight text-balance sm:text-4xl ${deep ? "text-on-deep" : "text-ink"}`}
      >
        {title}
      </Heading>
      {description ? (
        <p className={`mt-3 text-base leading-7 ${deep ? "text-on-deep-muted" : "text-ink-muted"}`}>
          {description}
        </p>
      ) : null}
    </div>
  );
}
