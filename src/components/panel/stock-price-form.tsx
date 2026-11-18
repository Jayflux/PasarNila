"use client";

import { useActionState, useState } from "react";

import { buttonClass } from "@/components/ui/button-styles";
import { ClockIcon, ScaleIcon, TagIcon } from "@/components/ui/icons";
import { saveStockPriceAction, type StockPriceActionResult } from "@/lib/actions/stock-price";
import { formatKg, formatPricePerKg } from "@/lib/format/number";
import { parsePriceInput, parseStockInput } from "@/lib/validation/stock-price-input";

type StockPriceFormProps = {
  productId: string;
  productName: string;
  initialStockKg: number | null;
  initialPriceIdr: number | null;
  initialConfirmedAt: string | null;
  initialConfirmedAtLabel: string;
};

export function StockPriceForm({
  productId,
  productName,
  initialStockKg,
  initialPriceIdr,
  initialConfirmedAt,
  initialConfirmedAtLabel,
}: StockPriceFormProps) {
  const [stockInput, setStockInput] = useState(
    initialStockKg !== null ? String(initialStockKg).replace(".", ",") : "",
  );
  const [priceInput, setPriceInput] = useState(
    initialPriceIdr !== null ? String(initialPriceIdr) : "",
  );

  const [zeroPriceModalOpen, setZeroPriceModalOpen] = useState(false);

  const [state, formAction, isPending] = useActionState<StockPriceActionResult | null, FormData>(
    saveStockPriceAction,
    null,
  );

  // Live preview parsing
  const liveStock = parseStockInput(stockInput);
  const livePrice = parsePriceInput(priceInput);

  function handleSubmitIntercept(e: React.FormEvent<HTMLFormElement>) {
    if (livePrice.ok && livePrice.idr === 0 && !zeroPriceModalOpen) {
      e.preventDefault();
      setZeroPriceModalOpen(true);
    }
  }

  function handleConfirmZeroPrice() {
    setZeroPriceModalOpen(false);
    const form = document.getElementById("stock-price-form") as HTMLFormElement | null;
    if (form) {
      form.requestSubmit();
    }
  }

  return (
    <div className="space-y-8">
      {/* Pesan Sukses / Error Umum */}
      {state?.ok && state.message ? (
        <div
          role="status"
          className="rounded-2xl border border-wa/30 bg-wa/10 p-5 text-wa flex items-start gap-3"
        >
          <span className="text-xl font-bold">✓</span>
          <div>
            <p className="font-bold">{state.message}</p>
            {state.savedData ? (
              <p className="text-sm mt-1 text-ink">
                Tersimpan di sistem: <strong>{state.savedData.stockLabel}</strong> •{" "}
                <strong>{state.savedData.priceLabel}</strong>
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {state && !state.ok && state.message ? (
        <div
          role="alert"
          className="rounded-2xl border border-error-ink/20 bg-error-soft p-5 text-error-ink flex items-start gap-3"
        >
          <span className="text-xl font-bold">!</span>
          <div>
            <p className="font-bold">{state.message}</p>
          </div>
        </div>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        {/* Formulir Input */}
        <div className="rounded-[1.75rem] border border-line bg-surface p-6 sm:p-8 shadow-sm">
          <h2 className="text-xl font-bold text-ink">Formulir Pembaruan</h2>
          <p className="text-sm text-ink-muted mt-1">
            Produk: <strong>{productName}</strong>
          </p>

          <form
            id="stock-price-form"
            action={formAction}
            onSubmit={handleSubmitIntercept}
            className="mt-6 space-y-6"
          >
            <input type="hidden" name="productId" value={productId} />
            <input
              type="hidden"
              name="baselineConfirmedAt"
              value={state?.savedData?.confirmedAtLabel ?? initialConfirmedAt ?? ""}
            />

            {/* Input Stok */}
            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="stockKg" className="block text-sm font-semibold text-ink">
                  Stok Tersedia (kg) <span className="text-error-ink">*</span>
                </label>
                <span className="text-xs text-ink-muted">Contoh: 12,5 atau 1250</span>
              </div>
              <div className="mt-2">
                <input
                  id="stockKg"
                  name="stockKg"
                  type="text"
                  inputMode="decimal"
                  required
                  disabled={isPending}
                  value={stockInput}
                  onChange={(e) => setStockInput(e.target.value)}
                  placeholder="mis. 50 atau 12,5"
                  className="block w-full rounded-xl border border-line bg-surface px-4 py-3 text-base text-ink outline-none transition placeholder:text-neutral-ink/50 focus:border-accent-strong focus:ring-2 focus:ring-accent-strong/20 disabled:bg-neutral-soft/50"
                />
              </div>
              {state?.fieldErrors?.stock ? (
                <p className="mt-1.5 text-xs font-semibold text-error-ink">
                  {state.fieldErrors.stock}
                </p>
              ) : null}
            </div>

            {/* Input Harga */}
            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="pricePerKgIdr" className="block text-sm font-semibold text-ink">
                  Harga Satuan per Kg (Rp) <span className="text-error-ink">*</span>
                </label>
                <span className="text-xs text-ink-muted">Contoh: 35000 atau 35.000</span>
              </div>
              <div className="mt-2">
                <input
                  id="pricePerKgIdr"
                  name="pricePerKgIdr"
                  type="text"
                  inputMode="numeric"
                  required
                  disabled={isPending}
                  value={priceInput}
                  onChange={(e) => setPriceInput(e.target.value)}
                  placeholder="mis. 35000 atau 35.000"
                  className="block w-full rounded-xl border border-line bg-surface px-4 py-3 text-base text-ink outline-none transition placeholder:text-neutral-ink/50 focus:border-accent-strong focus:ring-2 focus:ring-accent-strong/20 disabled:bg-neutral-soft/50"
                />
              </div>
              {state?.fieldErrors?.price ? (
                <p className="mt-1.5 text-xs font-semibold text-error-ink">
                  {state.fieldErrors.price}
                </p>
              ) : null}
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isPending}
                className={`w-full ${buttonClass("primary")}`}
              >
                {isPending ? "Menyimpan ke Database…" : "Simpan & Konfirmasi Sekarang"}
              </button>
            </div>

            <p className="text-xs text-ink-muted text-center leading-5">
              Menekan simpan akan mencatat waktu database saat ini sebagai stempel waktu konfirmasi
              terbaru (WIB).
            </p>
          </form>
        </div>

        {/* Live Preview Card */}
        <div className="space-y-6">
          <div className="rounded-[1.75rem] border border-line bg-surface p-6 sm:p-8 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-ink">Pratinjau Langsung Tampilan</h3>
              <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-bold text-accent-strong">
                Live Preview
              </span>
            </div>
            <p className="text-xs text-ink-muted mt-1">
              Bagaimana angka yang Anda ketik akan terbaca oleh pengunjung:
            </p>

            <div className="mt-6 space-y-4">
              <div className="rounded-2xl border border-line bg-cream/50 p-4">
                <p className="flex items-center gap-2 text-xs font-semibold text-accent-strong uppercase">
                  <ScaleIcon className="size-4" />
                  Format Stok:
                </p>
                <p className="mt-1 text-2xl font-bold text-ink">
                  {liveStock.ok
                    ? liveStock.kg === 0
                      ? "Stok habis"
                      : formatKg(liveStock.kg)
                    : "Belum valid"}
                </p>
              </div>

              <div className="rounded-2xl border border-line bg-cream/50 p-4">
                <p className="flex items-center gap-2 text-xs font-semibold text-accent-strong uppercase">
                  <TagIcon className="size-4" />
                  Format Harga per Kg:
                </p>
                <p className="mt-1 text-2xl font-bold text-ink">
                  {livePrice.ok ? formatPricePerKg(livePrice.idr) : "Belum valid"}
                </p>
                {livePrice.ok && livePrice.idr === 0 ? (
                  <span className="mt-1.5 inline-block text-xs font-semibold text-warn-ink bg-warn-soft px-2 py-0.5 rounded">
                    ⚠️ Peringatan: Harga Rp0
                  </span>
                ) : null}
              </div>

              <div className="rounded-2xl bg-neutral-soft/70 p-4 text-xs text-ink-muted flex items-start gap-2">
                <ClockIcon className="size-4 text-accent-strong shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-ink">Waktu Konfirmasi Terakhir:</p>
                  <p className="mt-0.5">
                    {state?.savedData?.confirmedAtLabel ?? initialConfirmedAtLabel}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal Dialog Konfirmasi Harga Rp0 (PRD FR-28 / AC-34) */}
      {zeroPriceModalOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-deep/40 backdrop-blur-xs p-4"
        >
          <div className="max-w-md w-full rounded-[1.75rem] border border-line bg-surface p-6 sm:p-8 shadow-xl">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-warn-soft text-warn-ink">
              <span className="text-xl font-bold">!</span>
            </div>
            <h3 className="mt-4 text-xl font-bold text-ink">
              Peringatan: Harga Rp0 / kg
            </h3>
            <p className="mt-2 text-sm text-ink-muted leading-6">
              Anda memasukkan harga <strong>Rp0 / kg</strong>. Angka ini akan langsung tampil di
              website publik. Apakah Anda yakin ingin mengonfirmasi harga ini?
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setZeroPriceModalOpen(false)}
                className={buttonClass("secondary", "sm")}
              >
                Batal &amp; Ubah Harga
              </button>
              <button
                type="button"
                onClick={handleConfirmZeroPrice}
                className={buttonClass("primary", "sm")}
              >
                Ya, Tetapkan Rp0
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
