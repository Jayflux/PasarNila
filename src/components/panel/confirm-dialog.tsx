"use client";

import { useEffect, useId, useRef } from "react";

import { buttonClass } from "@/components/ui/button-styles";

type Props = {
  open: boolean;
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: "warning" | "danger";
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * Dialog konfirmasi berbasis `<dialog>` bawaan (fokus terkunci di dalam dialog, Esc membatalkan,
 * fokus kembali ke pemicu). Fokus awal pada tombol Batal agar Enter tidak langsung mengonfirmasi.
 * Dipakai untuk harga Rp0 (PRD AC-34) dan hapus paket.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = "Batal",
  tone = "warning",
  onConfirm,
  onCancel,
}: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      cancelRef.current?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-[1.75rem] border border-line bg-surface p-6 text-ink shadow-xl backdrop:bg-deep/40 sm:p-8"
    >
      <div
        className={`flex size-12 items-center justify-center rounded-2xl text-xl font-bold ${tone === "danger" ? "bg-error-soft text-error-ink" : "bg-warn-soft text-warn-ink"}`}
        aria-hidden="true"
      >
        !
      </div>
      <h2 id={titleId} className="mt-4 text-xl font-bold">
        {title}
      </h2>
      <div id={descriptionId} className="mt-2 text-sm leading-6 text-ink-muted">
        {description}
      </div>
      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button ref={cancelRef} type="button" onClick={onCancel} className={buttonClass("secondary", "sm")}>
          {cancelLabel}
        </button>
        <button type="button" onClick={onConfirm} className={buttonClass("primary", "sm")}>
          {confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
