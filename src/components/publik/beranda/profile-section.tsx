import { Placeholder } from "@/components/publik/placeholder";
import { SectionHeading } from "@/components/publik/section-heading";
import { HOME_SECTIONS } from "@/config/navigation";
import { site } from "@/config/site";
import type { BusinessName } from "@/lib/data/site-settings";

/**
 * Cuplikan profil (PRD §1.1, §7). Hanya fakta yang sudah dikonfirmasi klien: produk, lokasi, dan
 * cara pemesanan. Sejarah/gambaran usaha (K5) dan jam operasional (K9) tampil sebagai placeholder.
 */
type Props = { businessName: BusinessName };

export function ProfileSection({ businessName }: Props) {
  const facts: ReadonlyArray<{ term: string; detail: React.ReactNode }> = [
    { term: "Produk", detail: "Ikan nila merah" },
    {
      // Alamat lengkap ada di bagian Lokasi; di sini cukup ringkasannya.
      term: "Lokasi",
      detail: site.shortLocation ?? site.address ?? <Placeholder label="Alamat" />,
    },
    { term: "Pemesanan", detail: "Lewat chat WhatsApp; transaksi disepakati di sana" },
    {
      term: "Jam operasional",
      detail:
        site.operatingHours && site.operatingHours.length > 0 ? (
          <ul>
            {site.operatingHours.map((row) => (
              <li key={row.day}>
                {row.day}: {row.hours}
              </li>
            ))}
          </ul>
        ) : (
          <Placeholder label="Jam operasional" />
        ),
    },
  ];

  return (
    <section
      id={HOME_SECTIONS.profil}
      aria-labelledby="profil-judul"
      className="border-y border-line bg-surface py-16 md:py-24"
    >
      <div className="reveal mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 md:grid-cols-[1fr_1fr] md:gap-14">
        <div>
          <SectionHeading id="profil-judul" eyebrow="Profil usaha" title={businessName.name} />
          <div className="mt-6">
            {site.profile ? (
              <p className="text-base leading-8 text-ink-muted">{site.profile}</p>
            ) : (
              <Placeholder
                label="Sejarah dan gambaran usaha"
                note="Profil lengkap akan diisi dengan bahan dari pemilik usaha."
              />
            )}
          </div>
        </div>

        <dl className="divide-y divide-line rounded-[1.75rem] border border-line bg-cream/60 px-6">
          {facts.map((fact) => (
            <div key={fact.term} className="grid gap-1 py-5 sm:grid-cols-[9rem_1fr] sm:gap-4">
              <dt className="text-sm font-semibold text-accent-strong">{fact.term}</dt>
              <dd className="text-base leading-7 text-ink">{fact.detail}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
