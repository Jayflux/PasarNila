"use client";

import { useRef, useState, useTransition } from "react";

import { ConfirmDialog } from "@/components/panel/confirm-dialog";
import { ResultNotice } from "@/components/panel/result-notice";
import { buttonClass } from "@/components/ui/button-styles";
import {
  deleteProductPhotoAction,
  updateProductPhotoAction,
} from "@/lib/actions/product-photo";
import type { ProductPhotoResult } from "@/lib/actions/core/product-photo";

type Props = {
  productId: string;
  productName: string;
  initialImagePath: string | null;
  initialImageAlt: string | null;
};

export function ProductPhotoForm({
  productId,
  productName,
  initialImagePath,
  initialImageAlt,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [currentPath, setCurrentPath] = useState<string | null>(initialImagePath);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [clientError, setClientError] = useState<string | null>(null);
  const [result, setResult] = useState<ProductPhotoResult | null>(null);
  const [isPending, startTransition] = useTransition();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    setClientError(null);
    setResult(null);
    const file = event.target.files?.[0];
    if (!file) {
      setSelectedFile(null);
      setPreviewUrl(null);
      return;
    }

    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) {
      setClientError("Format foto harus JPG, PNG, atau WebP.");
      event.target.value = "";
      setSelectedFile(null);
      setPreviewUrl(null);
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setClientError("Ukuran foto maksimal 2 MB.");
      event.target.value = "";
      setSelectedFile(null);
      setPreviewUrl(null);
      return;
    }

    setSelectedFile(file);
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
  }

  function handleCancelPreview() {
    setSelectedFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    setClientError(null);
  }

  function handleUpload() {
    if (!selectedFile) return;
    setClientError(null);
    setResult(null);

    const formData = new FormData();
    formData.append("productId", productId);
    formData.append("photo", selectedFile);
    formData.append("imageAlt", `Foto ${productName}`);

    startTransition(async () => {
      try {
        const res = await updateProductPhotoAction(formData);
        setResult(res);
        if (res.state === "saved" && res.saved) {
          setCurrentPath(res.saved.imagePath);
          handleCancelPreview();
        }
      } catch {
        setResult({
          state: "uncertain",
          message: "Koneksi terputus saat mengunggah foto. Silakan muat ulang halaman.",
          operation: "update",
        });
      }
    });
  }

  function handleDelete() {
    setShowDeleteConfirm(false);
    setClientError(null);
    setResult(null);

    const formData = new FormData();
    formData.append("productId", productId);

    startTransition(async () => {
      try {
        const res = await deleteProductPhotoAction(formData);
        setResult(res);
        if (res.state === "saved") {
          setCurrentPath(null);
          handleCancelPreview();
        }
      } catch {
        setResult({
          state: "uncertain",
          message: "Koneksi terputus saat menghapus foto. Silakan coba lagi.",
          operation: "delete",
        });
      }
    });
  }

  const activePhotoSrc = previewUrl || currentPath;

  return (
    <section
      aria-labelledby="foto-produk-heading"
      className="rounded-[1.75rem] border border-line bg-surface p-6 sm:p-8 shadow-sm"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 id="foto-produk-heading" className="text-xl font-bold text-ink">
            Foto Produk
          </h2>
          <p className="mt-1 text-sm text-ink-muted">
            Foto yang tampil di kartu ringkasan beranda dan halaman detail katalog. Format JPG, PNG, atau WebP (maks. 2 MB).
          </p>
        </div>
      </div>

      <div className="mt-6">
        {result ? (
          <div className="mb-6">
            <ResultNotice result={result} />
          </div>
        ) : null}

        {clientError ? (
          <div
            role="alert"
            className="mb-6 rounded-2xl border border-error-ink/20 bg-error-soft p-4 text-sm font-semibold text-error-ink"
          >
            {clientError}
          </div>
        ) : null}

        <div className="grid gap-6 md:grid-cols-[240px_1fr] items-start">
          {/* Box Foto / Pratinjau */}
          <div className="relative aspect-4/3 w-full overflow-hidden rounded-2xl border border-line bg-neutral-soft/50 flex flex-col items-center justify-center text-center p-4">
            {activePhotoSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={activePhotoSrc}
                alt={initialImageAlt || `Foto ${productName}`}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="text-xs text-ink-muted flex flex-col items-center gap-2">
                <svg
                  className="h-10 w-10 text-neutral-ink/40"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z"
                  />
                </svg>
                <span>Foto belum tersedia (placeholder aktif)</span>
              </div>
            )}
            {previewUrl ? (
              <span className="absolute bottom-2 left-2 rounded-full bg-accent-strong px-2.5 py-0.5 text-[11px] font-bold text-white shadow">
                Pratinjau baru
              </span>
            ) : currentPath ? (
              <span className="absolute bottom-2 left-2 rounded-full bg-surface/90 px-2.5 py-0.5 text-[11px] font-bold text-ink shadow backdrop-blur">
                Foto aktif
              </span>
            ) : null}
          </div>

          {/* Kontrol Unggah / Ganti */}
          <div className="flex flex-col gap-4">
            <input
              ref={fileInputRef}
              type="file"
              id="product-photo-input"
              name="photo"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileChange}
              disabled={isPending}
              className="sr-only"
            />

            <div className="flex flex-wrap items-center gap-3">
              <label
                htmlFor="product-photo-input"
                className={`${buttonClass("secondary", "md")} cursor-pointer ${
                  isPending ? "pointer-events-none opacity-50" : ""
                }`}
              >
                {currentPath ? "Pilih Foto Pengganti…" : "Pilih Foto…"}
              </label>

              {selectedFile ? (
                <>
                  <button
                    type="button"
                    onClick={handleUpload}
                    disabled={isPending}
                    className={buttonClass("primary", "md")}
                  >
                    {isPending ? "Mengunggah…" : "Simpan Foto"}
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelPreview}
                    disabled={isPending}
                    className={buttonClass("secondary", "md")}
                  >
                    Batal
                  </button>
                </>
              ) : null}

              {currentPath && !selectedFile ? (
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={isPending}
                  className="inline-flex min-h-11 items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold text-error-ink transition hover:bg-error-soft disabled:opacity-50"
                >
                  {isPending ? "Memproses…" : "Hapus Foto"}
                </button>
              ) : null}
            </div>

            {selectedFile ? (
              <p className="text-xs text-ink-muted">
                File terpilih: <span className="font-semibold text-ink">{selectedFile.name}</span> ({(selectedFile.size / 1024).toFixed(0)} KB). Klik <strong>Simpan Foto</strong> untuk menerapkan.
              </p>
            ) : currentPath ? (
              <p className="text-xs text-ink-muted">
                Foto produk saat ini sudah aktif di website. Anda bisa memilih foto baru untuk menggantinya atau klik <strong>Hapus Foto</strong> untuk kembali ke placeholder.
              </p>
            ) : (
              <p className="text-xs text-ink-muted">
                Belum ada foto yang diunggah. Tampilan website saat ini memakai placeholder netral.
              </p>
            )}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={showDeleteConfirm}
        title="Hapus foto produk?"
        description="Foto produk akan dihapus dan website akan menampilkan kembali placeholder [Foto belum tersedia]. Aksi ini dapat diganti dengan mengunggah foto baru kapan saja."
        confirmLabel="Ya, hapus foto"
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </section>
  );
}
