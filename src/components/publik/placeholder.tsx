/**
 * Penanda konten yang belum tersedia (PRD BR-K1, ARCHITECTURE.md §13.1).
 * Tampil jelas sebagai placeholder (garis putus-putus + label), tidak pernah menyerupai data asli.
 */
type Props = {
  /** Mis. "Sejarah dan gambaran usaha" → "[Sejarah dan gambaran usaha belum tersedia]". */
  label: string;
  note?: string;
  className?: string;
};

export function Placeholder({ label, note, className = "" }: Props) {
  return (
    <div
      className={`rounded-xl border-2 border-dashed border-ink-muted/35 bg-neutral-soft/60 px-4 py-3 text-sm text-neutral-ink ${className}`}
    >
      <p className="font-medium">[{label} belum tersedia]</p>
      {note ? <p className="mt-1">{note}</p> : null}
    </div>
  );
}
