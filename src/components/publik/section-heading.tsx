type Props = {
  id: string;
  eyebrow: string;
  title: string;
  description?: string;
  /** Untuk bagian berlatar gelap. */
  tone?: "light" | "deep";
};

export function SectionHeading({ id, eyebrow, title, description, tone = "light" }: Props) {
  const deep = tone === "deep";
  return (
    <div className="max-w-2xl">
      <p
        className={`text-sm font-semibold tracking-wide uppercase ${deep ? "text-accent-bright" : "text-accent-strong"}`}
      >
        {eyebrow}
      </p>
      <h2
        id={id}
        className={`mt-2 text-3xl font-bold tracking-tight text-balance sm:text-4xl ${deep ? "text-on-deep" : "text-ink"}`}
      >
        {title}
      </h2>
      {description ? (
        <p className={`mt-3 text-base leading-7 ${deep ? "text-on-deep-muted" : "text-ink-muted"}`}>
          {description}
        </p>
      ) : null}
    </div>
  );
}
