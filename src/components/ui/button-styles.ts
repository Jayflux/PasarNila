/**
 * Kelas tombol bersama. Tinggi minimum 44 px (PRD NFR-02, AC-42); gerakan hover hanya bila
 * pengguna tidak meminta reduced motion (`motion-safe:`).
 *
 * Ukuran dan varian dipisah agar tidak ada dua utilitas Tailwind untuk properti yang sama.
 */
const base =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full font-semibold " +
  "transition duration-200 ease-out";

const motion = "motion-safe:hover:-translate-y-0.5";

const variants = {
  primary: `${motion} bg-deep text-white shadow-sm hover:bg-deep-strong hover:shadow-md`,
  secondary: `${motion} border border-deep/25 bg-surface text-deep hover:border-deep/50 hover:bg-accent-soft`,
  whatsapp: `${motion} bg-wa text-white shadow-sm hover:bg-wa-hover hover:shadow-md`,
  /** Nomor WhatsApp belum dikonfigurasi (PRD BR-WA3): tampak nonaktif, tetap terbaca. */
  disabled: "cursor-not-allowed border border-dashed border-neutral-ink/40 bg-neutral-soft text-neutral-ink",
} as const;

const sizes = {
  md: "px-5 py-2.5 text-base",
  sm: "px-4 py-2 text-sm",
} as const;

export type ButtonVariant = keyof typeof variants;
export type ButtonSize = keyof typeof sizes;

export function buttonClass(variant: ButtonVariant, size: ButtonSize = "md"): string {
  return `${base} ${sizes[size]} ${variants[variant]}`;
}
