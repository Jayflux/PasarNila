import { WhatsAppButton } from "@/components/publik/whatsapp-button";
import { HOME_SECTIONS } from "@/config/navigation";

/**
 * Ajakan kontak (PRD FR-01, §5.3). Sampai route /kontak dibuat, menu "Kontak" mengarah ke sini.
 * Nomor yang ditampilkan berasal dari konfigurasi (`WHATSAPP_NUMBER`); bila belum ada, tombol nonaktif
 * dan tidak ada nomor yang tampil (AC-14).
 */
type Props = {
  whatsappHref: string | null;
  whatsappNumber: string | null;
};

export function ContactCta({ whatsappHref, whatsappNumber }: Props) {
  return (
    <section
      id={HOME_SECTIONS.kontak}
      aria-labelledby="kontak-judul"
      className="px-4 py-16 sm:px-6 md:py-24"
    >
      <div className="reveal on-deep mx-auto max-w-6xl rounded-[2rem] bg-deep px-6 py-12 text-center sm:px-10 md:py-16">
        <p className="text-sm font-semibold tracking-wide text-accent-bright uppercase">Kontak</p>
        <h2
          id="kontak-judul"
          className="mx-auto mt-2 max-w-2xl text-3xl font-bold tracking-tight text-balance text-on-deep sm:text-4xl"
        >
          Tanya stok atau pesan lewat WhatsApp
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-on-deep-muted">
          Pemesanan dan kesepakatan transaksi dilakukan di chat WhatsApp. Pesan sudah terisi, Anda tinggal
          menekan kirim.
        </p>
        <div className="mt-8 flex justify-center">
          <WhatsAppButton href={whatsappHref} label="Chat via WhatsApp" />
        </div>
        {whatsappHref !== null && whatsappNumber !== null ? (
          <p className="mt-4 text-sm text-on-deep-muted">
            Nomor WhatsApp: <span className="font-semibold text-on-deep">{whatsappNumber}</span>
          </p>
        ) : null}
      </div>
    </section>
  );
}
