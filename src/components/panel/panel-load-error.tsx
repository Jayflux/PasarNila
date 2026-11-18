/**
 * Keadaan "gagal dimuat" di panel. Dibedakan dari data kosong: formulir TIDAK ditampilkan agar tidak
 * ada penyimpanan berdasarkan data yang belum terbaca.
 */
export function PanelLoadError({
  what,
  title,
  detail,
}: {
  what: string;
  title?: string;
  detail?: string;
}) {
  return (
    <div role="alert" className="rounded-[1.75rem] border border-error-ink/20 bg-error-soft p-6 text-error-ink">
      <p className="font-bold">{title ?? `Gagal memuat ${what}`}</p>
      <p className="mt-1 text-sm leading-6">
        {detail ??
          `Data tidak dapat dibaca saat ini, jadi formulir tidak ditampilkan. Ini bukan berarti datanya kosong. Muat ulang halaman beberapa saat lagi.`}
      </p>
    </div>
  );
}
