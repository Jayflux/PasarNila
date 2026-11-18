"use client";

import { useRef, useState, useTransition } from "react";

import { MESSAGES, type ActionResult } from "@/lib/write/action-result";

type AnyResult = ActionResult<unknown, string>;

/**
 * Pengiriman formulir panel ke Server Action (ARCHITECTURE.md §5.3, §10.4).
 *
 * - Formulir memakai state terkontrol dan `onSubmit` (bukan `<form action>`), sehingga isian TIDAK
 *   di-reset otomatis setelah action selesai; isian tetap ada saat gagal, sesi berakhir, atau belum pasti.
 * - Submit ganda dicegah (penanda `busy` + tombol nonaktif selama `pending`).
 * - Bila panggilan ke server gagal di jaringan (sinyal HP putus setelah form terkirim), hasilnya
 *   BELUM PASTI, bukan "gagal": data mungkin sudah tersimpan.
 * - "Periksa ulang" memakai salinan isian yang DIKIRIM, bukan isian yang mungkin sudah diubah sesudahnya.
 * - Tidak ada pengiriman ulang otomatis.
 */
export function usePanelAction<R extends AnyResult>(options: {
  save: (formData: FormData) => Promise<R>;
  recheck?: (formData: FormData) => Promise<R>;
  onResult?: (result: R) => void;
}) {
  const [result, setResult] = useState<R | null>(null);
  const [pending, startTransition] = useTransition();
  const busy = useRef(false);
  const lastSubmission = useRef<FormData | null>(null);

  function run(call: (formData: FormData) => Promise<R>, formData: FormData) {
    if (busy.current) return;
    busy.current = true;
    startTransition(async () => {
      try {
        const next = await call(formData);
        setResult(next);
        options.onResult?.(next);
      } catch {
        setResult({
          state: "uncertain",
          message: MESSAGES.uncertain,
          detail: MESSAGES.networkFromBrowser,
          canRecheck: Boolean(options.recheck),
        } as R);
      } finally {
        busy.current = false;
      }
    });
  }

  return {
    result,
    pending,
    submit(formData: FormData) {
      lastSubmission.current = formData;
      run(options.save, formData);
    },
    recheck() {
      const formData = lastSubmission.current;
      if (formData && options.recheck) run(options.recheck, formData);
    },
    clear() {
      setResult(null);
    },
  };
}
