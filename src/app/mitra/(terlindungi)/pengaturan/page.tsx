import type { Metadata } from "next";

import { BusinessNameForm } from "@/components/panel/business-name-form";
import { PanelLoadError } from "@/components/panel/panel-load-error";
import { SectionHeading } from "@/components/publik/section-heading";
import { loadSiteSettingsForPartner } from "@/lib/data/site-settings";

export const metadata: Metadata = {
  title: "Pengaturan Usaha – Panel Mitra",
  robots: { index: false, follow: false },
};

export const instant = false;

/**
 * Pengaturan nama usaha (PRD §12.7, AC-45–AC-50). Formulir diisi nama TERSIMPAN; bila pembacaan gagal,
 * formulir tidak ditampilkan agar nama cadangan "Ikan Nila" tidak tersimpan menimpa nama asli.
 */
export default async function PanelPengaturanPage() {
  const result = await loadSiteSettingsForPartner();

  return (
    <div className="space-y-8">
      <SectionHeading
        id="panel-pengaturan-judul"
        level="h1"
        eyebrow="Panel pengelolaan"
        title="Pengaturan usaha"
        description="Hanya nama usaha yang dapat diubah dari panel. Alamat, tautan peta, dan jam operasional diubah pengembang."
      />
      {result.status === "ok" ? (
        <BusinessNameForm currentName={result.businessName} currentUpdatedAt={result.updatedAt} />
      ) : result.status === "not_found" ? (
        <PanelLoadError
          title="Pengaturan usaha belum ada"
          what="pengaturan usaha"
          detail="Baris pengaturan usaha tidak ditemukan di database. Hubungi pengembang untuk memeriksa data awal."
        />
      ) : (
        <PanelLoadError what="nama usaha tersimpan" />
      )}
    </div>
  );
}
