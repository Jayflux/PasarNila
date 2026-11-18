"use client";

import { useState, useTransition } from "react";

import { ResultNotice } from "@/components/panel/result-notice";
import { usePanelAction } from "@/components/panel/use-panel-action";
import { buttonClass } from "@/components/ui/button-styles";
import type { BusinessNameResult } from "@/lib/actions/core/site-settings";
import {
  recheckBusinessNameAction,
  refreshBusinessNameCacheAction,
  updateBusinessNameAction,
} from "@/lib/actions/site-settings";
import { BUSINESS_NAME_MAX_CHARS } from "@/lib/domain/limits";
import type { ActionResult } from "@/lib/write/action-result";
import { charLength } from "@/lib/validation/text-input";

type Props = {
  /** Nama TERSIMPAN dari database (bukan nama cadangan tampilan). */
  currentName: string;
  /** `updated_at` mentah dari database. */
  currentUpdatedAt: string;
};

/** Formulir nama usaha (PRD FR-29, AC-45–AC-50, AC-52). */
export function BusinessNameForm({ currentName, currentUpdatedAt }: Props) {
  const [name, setName] = useState(currentName);
  const [baselineUpdatedAt, setBaselineUpdatedAt] = useState(currentUpdatedAt);
  const [refreshResult, setRefreshResult] = useState<ActionResult | null>(null);
  const [refreshing, startRefresh] = useTransition();

  const action = usePanelAction<BusinessNameResult>({
    save: updateBusinessNameAction,
    recheck: recheckBusinessNameAction,
    onResult: (result) => {
      setRefreshResult(null);
      if (result.saved) setBaselineUpdatedAt(result.saved.updatedAt);
    },
  });

  const fieldError = action.result?.fieldErrors?.businessName;
  const preview = name.replace(/\s+/g, " ").trim();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (action.pending) return;
    action.submit(new FormData(event.currentTarget));
  }

  function refreshPublicView() {
    startRefresh(async () => {
      try {
        setRefreshResult(await refreshBusinessNameCacheAction());
      } catch {
        setRefreshResult({ state: "uncertain", message: "Penyegaran tampilan publik belum dapat dipastikan. Coba lagi." });
      }
    });
  }

  return (
    <div className="space-y-6">
      <div aria-live="polite" className="space-y-3">
        <ResultNotice
          result={action.result}
          pending={action.pending || refreshing}
          onRecheck={action.recheck}
          extraAction={
            action.result?.warning ? { label: refreshing ? "Menyegarkan…" : "Segarkan tampilan publik", onClick: refreshPublicView } : undefined
          }
        />
        <ResultNotice result={refreshResult} />
      </div>

      <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[1.75rem] border border-line bg-surface p-6 shadow-sm sm:p-8">
          <h2 className="text-xl font-bold text-ink">Ubah nama usaha</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Nama ini tampil di header, footer, judul tab, dan pesan WhatsApp umum.
          </p>

          <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-6">
            <input type="hidden" name="baselineUpdatedAt" value={baselineUpdatedAt} />
            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="businessName" className="block text-sm font-semibold text-ink">
                  Nama usaha <span className="text-error-ink">*</span>
                </label>
                <span className="text-xs text-ink-muted">
                  {charLength(preview)} / {BUSINESS_NAME_MAX_CHARS}
                </span>
              </div>
              <input
                id="businessName"
                name="businessName"
                type="text"
                required
                autoComplete="organization"
                aria-invalid={fieldError ? true : undefined}
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="mt-2 block w-full rounded-xl border border-line bg-surface px-4 py-3 text-base font-semibold text-ink outline-none transition focus:border-accent-strong focus:ring-2 focus:ring-accent-strong/20"
              />
              {fieldError ? <p className="mt-1.5 text-sm font-semibold text-error-ink">{fieldError}</p> : null}
            </div>

            <button type="submit" disabled={action.pending} className={`w-full ${buttonClass("primary")}`}>
              {action.pending ? "Menyimpan…" : "Simpan nama usaha"}
            </button>
            <p className="text-center text-xs leading-5 text-ink-muted">
              Mengganti nama tidak mengubah waktu konfirmasi stok & harga maupun isi artikel.
            </p>
          </form>
        </div>

        <div className="rounded-[1.75rem] border border-line bg-surface p-6 shadow-sm sm:p-8">
          <h3 className="text-base font-bold text-ink">Pratinjau</h3>
          <dl className="mt-6 space-y-4">
            <div className="rounded-2xl border border-line bg-cream/50 p-4">
              <dt className="text-xs font-semibold uppercase text-accent-strong">Header</dt>
              <dd className="mt-1 truncate text-lg font-bold text-deep">{preview || "(Nama belum diisi)"}</dd>
            </div>
            <div className="rounded-2xl border border-line bg-cream/50 p-4">
              <dt className="text-xs font-semibold uppercase text-accent-strong">Pesan WhatsApp umum</dt>
              <dd className="mt-1 text-sm leading-6 text-ink italic">
                &ldquo;Halo {preview || "…"}, saya ingin bertanya tentang ikan nila.&rdquo;
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}
