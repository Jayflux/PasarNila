import type { Metadata } from "next";

import { ArticlesSection } from "@/components/publik/beranda/articles-section";
import { ContactCta } from "@/components/publik/beranda/contact-cta";
import { Hero } from "@/components/publik/beranda/hero";
import { LocationSection } from "@/components/publik/beranda/location-section";
import { ProductHighlight } from "@/components/publik/beranda/product-highlight";
import { ProfileSection } from "@/components/publik/beranda/profile-section";
import { site } from "@/config/site";
import { getBusinessName } from "@/lib/data/site-settings";
import { getGeneralWhatsAppHref, getWhatsAppDisplayNumber } from "@/lib/whatsapp-links";

/**
 * Beranda (PRD §7, FR-01; ARCHITECTURE.md §6, §12.3).
 *
 * Shell statis: hero, profil, lokasi, kontak (nama usaha dari cache bertag `site-settings`).
 * Bagian dinamis di balik <Suspense>: stok/harga produk (tanpa cache) dan artikel (dinamis di MVP).
 */
export async function generateMetadata(): Promise<Metadata> {
  const businessName = await getBusinessName();
  const location = site.shortLocation ? ` di ${site.shortLocation}` : "";
  return {
    title: businessName.name,
    description:
      `Informasi stok (kg), harga per kg, dan waktu pembaruan ikan nila${location}. ` +
      "Pemesanan melalui chat WhatsApp.",
  };
}

export default async function HomePage() {
  const businessName = await getBusinessName();
  const generalWhatsAppHref = getGeneralWhatsAppHref(businessName);

  return (
    <>
      <Hero businessName={businessName} whatsappHref={generalWhatsAppHref} />
      <ProductHighlight />
      <ProfileSection businessName={businessName} />
      <ArticlesSection />
      <LocationSection />
      <ContactCta
        whatsappHref={generalWhatsAppHref}
        whatsappNumber={getWhatsAppDisplayNumber()}
      />
    </>
  );
}
