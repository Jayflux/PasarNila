import type { Metadata } from "next";

import { BusinessNameForm } from "@/components/panel/business-name-form";
import { SectionHeading } from "@/components/publik/section-heading";
import { getBusinessName } from "@/lib/data/site-settings";

export const metadata: Metadata = {
  title: "Pengaturan Usaha – Panel Mitra",
  robots: { index: false, follow: false },
};

export default async function PanelPengaturanPage() {
  const businessName = await getBusinessName();

  return (
    <div className="space-y-8">
      <SectionHeading
        id="panel-pengaturan-judul"
        eyebrow="Panel Pengelolaan"
        title="Pengaturan Identitas Usaha"
        description="Nama usaha yang tampil di header navigasi, footer, metadata SEO, serta pesan otomatis pemesanan WhatsApp."
      />

      <BusinessNameForm currentName={businessName.name} />
    </div>
  );
}
