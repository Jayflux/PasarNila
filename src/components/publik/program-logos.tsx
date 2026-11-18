import Image from "next/image";

type ProgramLogosProps = {
  size?: "sm" | "md" | "lg";
  className?: string;
  showLabels?: boolean;
};

export const PROGRAM_LOGOS = [
  {
    src: "/images/logos/diktisaintek-berdampak.jpg",
    alt: "Diktisaintek Berdampak",
    width: 64,
    height: 64,
    aspect: "aspect-square",
    className: "rounded-full",
  },
  {
    src: "/images/logos/ditjen-risbang.jpg",
    alt: "Ditjen Risbang",
    width: 144,
    height: 64,
    aspect: "aspect-[336/149]",
    className: "rounded-sm",
  },
  {
    src: "/images/logos/mahasiswa-berdampak.jpg",
    alt: "Mahasiswa Berdampak",
    width: 172,
    height: 64,
    aspect: "aspect-[1024/382]",
    className: "rounded-sm",
  },
] as const;

export function ProgramLogos({
  size = "sm",
  className = "",
  showLabels = false,
}: ProgramLogosProps) {
  const heightClass =
    size === "sm" ? "h-7" : size === "md" ? "h-9" : "h-12";

  return (
    <div className={`flex items-center gap-2 sm:gap-3 ${className}`}>
      {PROGRAM_LOGOS.map((logo) => (
        <div
          key={logo.src}
          className={`flex items-center justify-center overflow-hidden bg-white/90 p-0.5 shadow-2xs border border-line/60 rounded-md ${heightClass}`}
          title={logo.alt}
        >
          <Image
            src={logo.src}
            alt={logo.alt}
            width={logo.width}
            height={logo.height}
            className={`h-full w-auto object-contain ${logo.className}`}
          />
        </div>
      ))}
      {showLabels ? (
        <span className="text-xs font-medium text-ink-muted hidden sm:inline">
          Program Mahasiswa Berdampak
        </span>
      ) : null}
    </div>
  );
}
