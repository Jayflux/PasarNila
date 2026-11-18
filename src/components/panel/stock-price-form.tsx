"use client";

import { useRef, useState } from "react";

import { ConfirmDialog } from "@/components/panel/confirm-dialog";
import { ResultNotice } from "@/components/panel/result-notice";
import { usePanelAction } from "@/components/panel/use-panel-action";
import { buttonClass } from "@/components/ui/button-styles";
import { ClockIcon, ScaleIcon, TagIcon } from "@/components/ui/icons";
import { recheckStockPriceAction, saveStockPriceAction } from "@/lib/actions/stock-price";
import type { StockPriceResult } from "@/lib/actions/core/stock-price";
import { formatKg, formatPricePerKg } from "@/lib/format/number";
import { parsePriceInput, parseStockInput } from "@/lib/validation/stock-price-input";

type Baseline = {
  /** Waktu konfirmasi MENTAH (ISO) dari database; `null` = belum pernah dikonfirmasi. */
  confirmedAt: string | null;
  confirmedAtLabel: string;
  stockCanonical: string;
  priceIdr: string;
};

type Props = {
  productId: string;
  productName: string;
  initialStockKg: number | null;
  initialPriceIdr: number | null;
  initialConfirmedAt: string | null;
  initialConfirmedAtLabel: string;
};

/**
 * Formulir stok & harga (PRD FR-18–FR-21, AC-25–AC-34, AC-51).
 * Isian terkontrol: tidak hilang saat gagal, sesi berakhir, atau hasil belum pasti.
 */
export function StockPriceForm({
  productId,
  productName,
  initialStockKg,
  initialPriceIdr,
  initialConfirmedAt,
  initialConfirmedAtLabel,
}: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const [stockInput, setStockInput] = useState(
    initialStockKg !== null ? String(initialStockKg).replace(".", ",") : "",
  );
  const [priceInput, setPriceInput] = useState(initialPriceIdr !== null ? String(initialPriceIdr) : "");
  const [baseline, setBaseline] = useState<Baseline>({
    confirmedAt: initialConfirmedAt,
    confirmedAtLabel: initialConfirmedAtLabel,
    stockCanonical: initialStockKg !== null ? String(initialStockKg) : "",
    priceIdr: initialPriceIdr !== null ? String(initialPriceIdr) : "",
  });
  const [zeroPriceDialog, setZeroPriceDialog] = useState(false);
  const [clientErrors, setClientErrors] = useState<{ stock?: string; price?: string }>({});

  const action = usePanelAction<StockPriceResult>({
    save: saveStockPriceAction,
    recheck: recheckStockPriceAction,
    onResult: (result) => {
      // Baseline berikutnya = nilai yang benar-benar terbaca dari database.
      if (result.saved) {
        setBaseline({
          confirmedAt: result.saved.confirmedAt,
          confirmedAtLabel: result.saved.confirmedAtLabel,
          stockCanonical: result.saved.stockCanonical,
          priceIdr: String(result.saved.pricePerKgIdr),
        });
      }
    },
  });

  const liveStock = parseStockInput(stockInput);
  const livePrice = parsePriceInput(priceInput);
  const fieldErrors = { ...clientErrors, ...(action.result?.fieldErrors ?? {}) };

  function send() {
    const form = formRef.current;
    if (form) action.submit(new FormData(form));
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (action.pending) return;
    const errors = {
      stock: liveStock.ok ? undefined : liveStock.message,
      price: livePrice.ok ? undefined : livePrice.message,
    };
    setClientErrors(errors);
    if (errors.stock || errors.price) return;
    action.clear();
    if (livePrice.ok && livePrice.idr === 0) {
      setZeroPriceDialog(true); // PRD AC-34
      return;
    }
    send();
  }

  return (
    <div className="space-y-8">
      <div aria-live="polite">
        <ResultNotice result={action.result} pending={action.pending} onRecheck={action.recheck} />
      </div>

      <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[1.75rem] border border-line bg-surface p-6 shadow-sm sm:p-8">
          <h2 className="text-xl font-bold text-ink">Formulir Pembaruan</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Produk: <strong>{productName}</strong>
          </p>

          <form ref={formRef} onSubmit={handleSubmit} noValidate className="mt-6 space-y-6">
            <input type="hidden" name="productId" value={productId} />
            <input type="hidden" name="baselineConfirmedAt" value={baseline.confirmedAt ?? ""} />
            <input type="hidden" name="baselineStock" value={baseline.stockCanonical} />
            <input type="hidden" name="baselinePrice" value={baseline.priceIdr} />

            <div>
              <div className="flex flex-wrap items-center justify-between gap-1">
                <label htmlFor="stockKg" className="block text-sm font-semibold text-ink">
                  Stok total (kg) <span className="text-error-ink">*</span>
                </label>
                <span className="text-xs text-ink-muted" id="stockKg-hint">
                  Contoh: 12,5 atau 1250
                </span>
              </div>
              <input
                id="stockKg"
                name="stockKg"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                required
                aria-invalid={fieldErrors.stock ? true : undefined}
                aria-describedby={fieldErrors.stock ? "stockKg-hint stockKg-error" : "stockKg-hint"}
                value={stockInput}
                onChange={(event) => setStockInput(event.target.value)}
                className="mt-2 block w-full rounded-xl border border-line bg-surface px-4 py-3 text-base text-ink outline-none transition focus:border-accent-strong focus:ring-2 focus:ring-accent-strong/20"
              />
              {fieldErrors.stock ? (
                <p id="stockKg-error" className="mt-1.5 text-sm font-semibold text-error-ink">
                  {fieldErrors.stock}
                </p>
              ) : null}
            </div>

            <div>
              <div className="flex flex-wrap items-center justify-between gap-1">
                <label htmlFor="pricePerKgIdr" className="block text-sm font-semibold text-ink">
                  Harga satuan per kg (Rp) <span className="text-error-ink">*</span>
                </label>
                <span className="text-xs text-ink-muted" id="pricePerKgIdr-hint">
                  Contoh: 35000 atau 35.000
                </span>
              </div>
              <input
                id="pricePerKgIdr"
                name="pricePerKgIdr"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                required
                aria-invalid={fieldErrors.price ? true : undefined}
                aria-describedby={fieldErrors.price ? "pricePerKgIdr-hint pricePerKgIdr-error" : "pricePerKgIdr-hint"}
                value={priceInput}
                onChange={(event) => setPriceInput(event.target.value)}
                className="mt-2 block w-full rounded-xl border border-line bg-surface px-4 py-3 text-base text-ink outline-none transition focus:border-accent-strong focus:ring-2 focus:ring-accent-strong/20"
              />
              {fieldErrors.price ? (
                <p id="pricePerKgIdr-error" className="mt-1.5 text-sm font-semibold text-error-ink">
                  {fieldErrors.price}
                </p>
              ) : null}
            </div>

            <button type="submit" disabled={action.pending} className={`w-full ${buttonClass("primary")}`}>
              {action.pending ? "Menyimpan…" : "Simpan & Konfirmasi"}
            </button>

            <p className="text-center text-xs leading-5 text-ink-muted">
              Menekan simpan mencatat jam database sebagai waktu konfirmasi terbaru, juga bila angkanya
              tidak berubah.
            </p>
          </form>
        </div>

        <div className="rounded-[1.75rem] border border-line bg-surface p-6 shadow-sm sm:p-8">
          <h3 className="text-base font-bold text-ink">Pratinjau tampilan</h3>
          <p className="mt-1 text-xs text-ink-muted">Cara angka yang Anda ketik akan disimpan dan ditampilkan:</p>

          <dl className="mt-6 space-y-4">
            <div className="rounded-2xl border border-line bg-cream/50 p-4">
              <dt className="flex items-center gap-2 text-xs font-semibold uppercase text-accent-strong">
                <ScaleIcon className="size-4" />
                Stok
              </dt>
              <dd className="mt-1 text-2xl font-bold text-ink">
                {liveStock.ok ? (liveStock.kg === 0 ? "Stok habis" : formatKg(liveStock.kg)) : "Belum valid"}
              </dd>
            </div>
            <div className="rounded-2xl border border-line bg-cream/50 p-4">
              <dt className="flex items-center gap-2 text-xs font-semibold uppercase text-accent-strong">
                <TagIcon className="size-4" />
                Harga satuan
              </dt>
              <dd className="mt-1 text-2xl font-bold text-ink">
                {livePrice.ok ? formatPricePerKg(livePrice.idr) : "Belum valid"}
              </dd>
              {livePrice.ok && livePrice.idr === 0 ? (
                <p className="mt-1.5 inline-block rounded bg-warn-soft px-2 py-0.5 text-xs font-semibold text-warn-ink">
                  Harga Rp0 akan diminta konfirmasi
                </p>
              ) : null}
            </div>
            <div className="rounded-2xl bg-neutral-soft/70 p-4 text-sm text-ink-muted">
              <dt className="flex items-center gap-2 font-semibold text-ink">
                <ClockIcon className="size-4 shrink-0 text-accent-strong" />
                Waktu konfirmasi terakhir
              </dt>
              <dd className="mt-0.5">{baseline.confirmedAtLabel}</dd>
            </div>
          </dl>
        </div>
      </div>

      <ConfirmDialog
        open={zeroPriceDialog}
        title="Harga Rp0 / kg"
        description="Harga Rp0 akan tampil di website. Lanjutkan?"
        confirmLabel="Ya, simpan Rp0"
        onCancel={() => setZeroPriceDialog(false)}
        onConfirm={() => {
          setZeroPriceDialog(false);
          send();
        }}
      />
    </div>
  );
}
