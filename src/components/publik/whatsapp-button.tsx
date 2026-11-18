import { buttonClass, type ButtonSize } from "@/components/ui/button-styles";
import { ChatIcon } from "@/components/ui/icons";

/**
 * Tombol WhatsApp (PRD BR-WA1–BR-WA6, ARCHITECTURE.md §13.2).
 *
 * - `href` dibuat di server dari konfigurasi (src/lib/whatsapp-links.ts). Komponen ini tidak pernah
 *   membuat tautan sendiri dan tidak mengenal nomor apa pun.
 * - `href === null` → `<button disabled>` bertuliskan "Nomor WhatsApp belum tersedia", tanpa atribut
 *   `href` dan tanpa nomor di HTML (AC-14).
 */
export const WHATSAPP_UNAVAILABLE_LABEL = "Nomor WhatsApp belum tersedia";

type Props = {
  href: string | null;
  label: string;
  size?: ButtonSize;
  className?: string;
};

export function WhatsAppButton({ href, label, size = "md", className = "" }: Props) {
  if (href === null) {
    return (
      <button
        type="button"
        disabled
        aria-disabled="true"
        className={`${buttonClass("disabled", size)} ${className}`}
      >
        <ChatIcon className="size-5 shrink-0" />
        {WHATSAPP_UNAVAILABLE_LABEL}
      </button>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`${buttonClass("whatsapp", size)} ${className}`}
    >
      <ChatIcon className="size-5 shrink-0" />
      {label}
      <span className="sr-only"> (membuka WhatsApp di tab baru)</span>
    </a>
  );
}
