"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { ConfirmDialog } from "@/components/panel/confirm-dialog";
import { ResultNotice } from "@/components/panel/result-notice";
import { usePanelAction } from "@/components/panel/use-panel-action";
import { buttonClass } from "@/components/ui/button-styles";
import type { PackageResult } from "@/lib/actions/core/packages";
import {
  createPackageAction,
  deletePackageAction,
  recheckPackageAction,
  updatePackageAction,
} from "@/lib/actions/packages";
import { PACKAGE_NAME_MAX_CHARS } from "@/lib/domain/limits";
import {
  comparisonLabel,
  computePackagePricing,
  effectivePerKgLabel,
  savingsBadgeLabel,
} from "@/lib/domain/package-pricing";
import { formatWib } from "@/lib/format/datetime";
import { formatKg, formatPricePerKg, formatRupiah } from "@/lib/format/number";
import { parsePackagePriceInput, parsePackageWeightInput } from "@/lib/validation/stock-price-input";
import { charLength, validatePackageName } from "@/lib/validation/text-input";
import { isSuccessState, type ActionResult } from "@/lib/write/action-result";

export type ManagedPackage = {
  id: string;
  name: string;
  weightKg: number;
  priceTotalIdr: number;
  /** `updated_at` mentah (ISO) dari database. */
  updatedAt: string;
};

type Props = {
  productId: string;
  productName: string;
  /** Harga satuan per kg saat ini (produk); `null` = belum diisi. */
  unitPricePerKgIdr: number | null;
  packages: ManagedPackage[];
};

/** ID permintaan tambah (UUID v4). `crypto.randomUUID` hanya ada di konteks aman, jadi ada cadangan. */
export function newRequestId(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Pengelolaan paket katalog (PRD §12.8, AC-53–AC-60).
 * Server Action memeriksa mitra di setiap operasi; database menegakkan hak tulis lewat RPC.
 */
export function PackageManager({ productId, productName, unitPricePerKgIdr, packages }: Props) {
  const router = useRouter();
  const [notice, setNotice] = useState<ActionResult<unknown, string> | null>(null);

  function refreshList() {
    router.refresh();
  }

  return (
    <div className="space-y-8">
      <div aria-live="polite">
        <ResultNotice result={notice} />
      </div>

      <section aria-labelledby="paket-tambah-judul" className="rounded-[1.75rem] border border-line bg-surface p-6 shadow-sm sm:p-8">
        <h2 id="paket-tambah-judul" className="text-xl font-bold text-ink">
          Tambah paket
        </h2>
        <p className="mt-1 text-sm text-ink-muted">
          Produk: <strong>{productName}</strong>. Semua paket memakai stok total yang sama; paket tidak punya stok
          sendiri.
        </p>
        <PackageEditor
          mode="create"
          productId={productId}
          unitPricePerKgIdr={unitPricePerKgIdr}
          onSuccess={() => {
            setNotice(null);
            refreshList();
          }}
        />
      </section>

      <section aria-labelledby="paket-daftar-judul" className="space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="paket-daftar-judul" className="text-xl font-bold text-ink">
            Paket tersimpan
          </h2>
          <span className="text-sm text-ink-muted">{packages.length} paket</span>
        </div>
        {packages.length === 0 ? (
          <p className="rounded-[1.75rem] border border-dashed border-line bg-surface p-6 text-sm leading-6 text-ink-muted">
            Belum ada paket. Katalog publik menampilkan &ldquo;Belum ada pilihan paket&rdquo; dan tombol bertanya lewat
            WhatsApp sampai paket pertama ditambahkan.
          </p>
        ) : (
          <ul className="space-y-4">
            {packages.map((pkg) => (
              <PackageCard
                key={pkg.id}
                pkg={pkg}
                productId={productId}
                unitPricePerKgIdr={unitPricePerKgIdr}
                onDeleted={(result) => {
                  setNotice(result);
                  refreshList();
                }}
                onChanged={refreshList}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function PackageCard({
  pkg,
  productId,
  unitPricePerKgIdr,
  onDeleted,
  onChanged,
}: {
  pkg: ManagedPackage;
  productId: string;
  unitPricePerKgIdr: number | null;
  onDeleted: (result: PackageResult) => void;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [lastSaved, setLastSaved] = useState<PackageResult | null>(null);
  const deleteForm = useRef<HTMLFormElement>(null);

  const remove = usePanelAction<PackageResult>({
    save: deletePackageAction,
    recheck: recheckPackageAction,
    onResult: (result) => {
      if (result.deletedId) onDeleted(result);
    },
  });

  const pricing = safePricing(pkg.weightKg, pkg.priceTotalIdr, unitPricePerKgIdr);
  const badge = pricing ? savingsBadgeLabel(pricing) : null;
  const summary = `${pkg.name} (${formatKg(pkg.weightKg)}, ${formatRupiah(pkg.priceTotalIdr)})`;

  return (
    <li className="rounded-2xl border border-line bg-surface p-5 shadow-sm sm:p-6">
      <div aria-live="polite" className="space-y-3">
        <ResultNotice result={lastSaved} />
        <ResultNotice
          result={remove.result && !remove.result.deletedId ? remove.result : null}
          pending={remove.pending}
          onRecheck={remove.recheck}
        />
      </div>

      {editing ? (
        <div className="mt-2">
          <h3 className="text-base font-bold text-ink">Ubah paket</h3>
          <PackageEditor
            mode="update"
            productId={productId}
            unitPricePerKgIdr={unitPricePerKgIdr}
            initial={pkg}
            onCancel={() => setEditing(false)}
            onSuccess={(result) => {
              setLastSaved(result);
              setEditing(false);
              onChanged();
            }}
          />
        </div>
      ) : (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h3 className="text-lg font-bold text-ink">{pkg.name}</h3>
            <p className="text-sm text-ink-muted">{formatKg(pkg.weightKg)}</p>
            <p className="mt-2 text-2xl font-extrabold text-ink">{formatRupiah(pkg.priceTotalIdr)}</p>
            {pricing ? <p className="text-sm text-ink-muted">{effectivePerKgLabel(pricing.effectivePerKg)}</p> : null}
            {badge ? (
              <span className="mt-2 inline-block rounded-full bg-warn-soft px-2.5 py-0.5 text-xs font-bold text-warn-ink">
                {badge}
              </span>
            ) : null}
            <p className="mt-2 text-xs text-ink-muted">Paket terakhir diubah: {safeWib(pkg.updatedAt)}</p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setLastSaved(null);
                setEditing(true);
              }}
              disabled={remove.pending}
              className={buttonClass("secondary", "sm")}
            >
              Ubah
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              disabled={remove.pending}
              className={`${buttonClass("secondary", "sm")} text-error-ink`}
            >
              {remove.pending ? "Menghapus…" : "Hapus"}
            </button>
          </div>
        </div>
      )}

      <form ref={deleteForm} hidden>
        <input type="hidden" name="operation" value="delete" />
        <input type="hidden" name="packageId" value={pkg.id} />
        <input type="hidden" name="name" value={pkg.name} />
      </form>

      <ConfirmDialog
        open={confirmDelete}
        tone="danger"
        title="Hapus paket?"
        description={
          <>
            Paket <strong>{summary}</strong> akan dihapus dan tidak lagi tampil di katalog. Stok total dan harga satuan
            tidak berubah.
          </>
        }
        confirmLabel="Ya, hapus paket"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          setConfirmDelete(false);
          setLastSaved(null);
          if (deleteForm.current) remove.submit(new FormData(deleteForm.current));
        }}
      />
    </li>
  );
}

function safePricing(weightKg: number, priceTotalIdr: number, unitPrice: number | null) {
  try {
    return computePackagePricing({ weightKg, priceTotalIdr, unitPricePerKgIdr: unitPrice });
  } catch {
    return null;
  }
}

function safeWib(value: string): string {
  try {
    return formatWib(value);
  } catch {
    return "—";
  }
}

type EditorProps = {
  mode: "create" | "update";
  productId: string;
  unitPricePerKgIdr: number | null;
  initial?: ManagedPackage;
  onSuccess: (result: PackageResult) => void;
  onCancel?: () => void;
};

/** Formulir tambah/ubah paket. Isian terkontrol: tetap ada saat gagal, sesi berakhir, atau belum pasti. */
function PackageEditor({ mode, productId, unitPricePerKgIdr, initial, onSuccess, onCancel }: EditorProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [name, setName] = useState(initial?.name ?? "");
  const [weight, setWeight] = useState(initial ? String(initial.weightKg).replace(".", ",") : "");
  const [price, setPrice] = useState(initial ? String(initial.priceTotalIdr) : "");
  const [requestId, setRequestId] = useState(() => newRequestId());
  const [baselineUpdatedAt, setBaselineUpdatedAt] = useState(initial?.updatedAt ?? "");
  const [zeroDialog, setZeroDialog] = useState(false);
  const [clientErrors, setClientErrors] = useState<{ name?: string; weight?: string; price?: string }>({});

  const action = usePanelAction<PackageResult>({
    save: mode === "create" ? createPackageAction : updatePackageAction,
    recheck: recheckPackageAction,
    onResult: (result) => {
      if (result.saved) setBaselineUpdatedAt(result.saved.updatedAt);
      if (isSuccessState(result.state)) {
        if (mode === "create") {
          // Paket berikutnya memakai ID permintaan baru; isian dikosongkan HANYA setelah tersimpan pasti.
          setName("");
          setWeight("");
          setPrice("");
          setRequestId(newRequestId());
        }
        onSuccess(result);
      }
    },
  });

  const liveName = validatePackageName(name);
  const liveWeight = parsePackageWeightInput(weight);
  const livePrice = parsePackagePriceInput(price);
  const preview =
    liveWeight.ok && livePrice.ok ? safePricing(liveWeight.kg, livePrice.idr, unitPricePerKgIdr) : null;
  const fieldErrors = { ...clientErrors, ...(action.result?.fieldErrors ?? {}) };
  const idPrefix = mode === "create" ? "paket-baru" : `paket-${initial?.id ?? ""}`;

  function send() {
    if (formRef.current) action.submit(new FormData(formRef.current));
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (action.pending) return;
    const errors = {
      name: liveName.ok ? undefined : liveName.message,
      weight: liveWeight.ok ? undefined : liveWeight.message,
      price: livePrice.ok ? undefined : livePrice.message,
    };
    setClientErrors(errors);
    if (errors.name || errors.weight || errors.price) return;
    action.clear();
    if (livePrice.ok && livePrice.idr === 0) {
      setZeroDialog(true);
      return;
    }
    send();
  }

  // Mode tambah: pesan berhasil tampil di sini. Mode ubah: formulir ditutup setelah berhasil dan pesannya
  // tampil di kartu paket.
  const showResult =
    mode === "create" || (action.result && !isSuccessState(action.result.state)) ? action.result : null;

  return (
    <div className="mt-6 space-y-6">
      <div aria-live="polite">
        <ResultNotice result={showResult} pending={action.pending} onRecheck={action.recheck} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <form ref={formRef} onSubmit={handleSubmit} noValidate className="space-y-5">
          <input type="hidden" name="operation" value={mode} />
          <input type="hidden" name="productId" value={productId} />
          {mode === "create" ? (
            <input type="hidden" name="requestId" value={requestId} />
          ) : (
            <>
              <input type="hidden" name="packageId" value={initial?.id ?? ""} />
              <input type="hidden" name="baselineUpdatedAt" value={baselineUpdatedAt} />
            </>
          )}

          <Field
            id={`${idPrefix}-nama`}
            label="Nama paket"
            hint={`${charLength(name.replace(/\s+/g, " ").trim())} / ${PACKAGE_NAME_MAX_CHARS}`}
            error={fieldErrors.name}
          >
            <input
              id={`${idPrefix}-nama`}
              name="name"
              type="text"
              autoComplete="off"
              required
              aria-invalid={fieldErrors.name ? true : undefined}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="mis. Paket Hemat"
              className={inputClass}
            />
          </Field>

          <Field id={`${idPrefix}-berat`} label="Berat paket (kg)" hint="Contoh: 10 atau 12,5" error={fieldErrors.weight}>
            <input
              id={`${idPrefix}-berat`}
              name="weightKg"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              required
              aria-invalid={fieldErrors.weight ? true : undefined}
              value={weight}
              onChange={(event) => setWeight(event.target.value)}
              className={inputClass}
            />
          </Field>

          <Field
            id={`${idPrefix}-harga`}
            label="Harga total paket (Rp)"
            hint="Contoh: 320000 atau 320.000"
            error={fieldErrors.price}
          >
            <input
              id={`${idPrefix}-harga`}
              name="priceTotalIdr"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              required
              aria-invalid={fieldErrors.price ? true : undefined}
              value={price}
              onChange={(event) => setPrice(event.target.value)}
              className={inputClass}
            />
          </Field>

          <div className="flex flex-col gap-3 sm:flex-row">
            <button type="submit" disabled={action.pending} className={buttonClass("primary")}>
              {action.pending ? "Menyimpan…" : mode === "create" ? "Tambah paket" : "Simpan perubahan"}
            </button>
            {onCancel ? (
              <button type="button" onClick={onCancel} disabled={action.pending} className={buttonClass("secondary")}>
                Batal
              </button>
            ) : null}
          </div>
        </form>

        <div className="rounded-2xl border border-line bg-cream/50 p-5">
          <p className="text-xs font-semibold uppercase text-accent-strong">Pratinjau kartu katalog</p>
          {preview && liveWeight.ok && livePrice.ok ? (
            <div className="mt-3">
              <p className="font-bold text-ink">{liveName.ok ? liveName.value : "(Nama paket)"}</p>
              <p className="text-sm text-ink-muted">{formatKg(liveWeight.kg)}</p>
              <p className="mt-2 text-2xl font-extrabold text-ink">{formatRupiah(livePrice.idr)}</p>
              <p className="text-sm text-ink-muted">{effectivePerKgLabel(preview.effectivePerKg)}</p>
              {savingsBadgeLabel(preview) ? (
                <span className="mt-2 inline-block rounded-full bg-warn-soft px-2.5 py-0.5 text-xs font-bold text-warn-ink">
                  {savingsBadgeLabel(preview)}
                </span>
              ) : (
                <p className="mt-2 text-xs text-ink-muted">Tanpa badge Hemat (harga tidak lebih rendah dari pembanding).</p>
              )}
              <p className="mt-3 text-xs leading-5 text-ink-muted">
                {comparisonLabel(preview) ??
                  "Harga satuan per kg belum diisi, jadi pembanding dan badge Hemat tidak ditampilkan."}
              </p>
            </div>
          ) : (
            <p className="mt-3 text-sm text-ink-muted">Isi berat dan harga yang valid untuk melihat pratinjau.</p>
          )}
          {unitPricePerKgIdr !== null ? (
            <p className="mt-3 text-xs text-ink-muted">Harga satuan saat ini: {formatPricePerKg(unitPricePerKgIdr)}.</p>
          ) : null}
        </div>
      </div>

      <ConfirmDialog
        open={zeroDialog}
        title="Harga paket Rp0"
        description="Harga paket Rp0 akan tampil di website. Lanjutkan?"
        confirmLabel="Ya, simpan Rp0"
        onCancel={() => setZeroDialog(false)}
        onConfirm={() => {
          setZeroDialog(false);
          send();
        }}
      />
    </div>
  );
}

const inputClass =
  "mt-2 block w-full rounded-xl border border-line bg-surface px-4 py-3 text-base text-ink outline-none transition focus:border-accent-strong focus:ring-2 focus:ring-accent-strong/20";

function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-1">
        <label htmlFor={id} className="block text-sm font-semibold text-ink">
          {label} <span className="text-error-ink">*</span>
        </label>
        <span className="text-xs text-ink-muted">{hint}</span>
      </div>
      {children}
      {error ? <p className="mt-1.5 text-sm font-semibold text-error-ink">{error}</p> : null}
    </div>
  );
}
