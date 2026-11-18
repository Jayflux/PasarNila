"use client";

import { useActionState, useState } from "react";

import { buttonClass } from "@/components/ui/button-styles";
import { updateBusinessNameAction, type SiteSettingsActionResult } from "@/lib/actions/site-settings";

type BusinessNameFormProps = {
  currentName: string;
};

export function BusinessNameForm({ currentName }: BusinessNameFormProps) {
  const [name, setName] = useState(currentName);

  const [state, formAction, isPending] = useActionState<SiteSettingsActionResult | null, FormData>(
    updateBusinessNameAction,
    null,
  );

  return (
    <div className="space-y-6">
      {state?.ok && state.message ? (
        <div
          role="status"
          className="rounded-2xl border border-wa/30 bg-wa/10 p-5 text-wa flex items-center gap-3"
        >
          <span className="text-xl font-bold">✓</span>
          <p className="font-bold">{state.message}</p>
        </div>
      ) : null}

      {state && !state.ok && state.message ? (
        <div
          role="alert"
          className="rounded-2xl border border-error-ink/20 bg-error-soft p-5 text-error-ink flex items-center gap-3"
        >
          <span className="text-xl font-bold">!</span>
          <p className="font-bold">{state.message}</p>
        </div>
      ) : null}

      <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[1.75rem] border border-line bg-surface p-6 sm:p-8 shadow-sm">
          <h2 className="text-xl font-bold text-ink">Ubah Nama Usaha</h2>
          <p className="text-sm text-ink-muted mt-1">
            Nama ini adalah identitas resmi usaha Anda yang muncul di seluruh halaman website.
          </p>

          <form action={formAction} className="mt-6 space-y-6">
            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="businessName" className="block text-sm font-semibold text-ink">
                  Nama Usaha Baru <span className="text-error-ink">*</span>
                </label>
                <span className="text-xs text-ink-muted">{name.length} / 80</span>
              </div>
              <div className="mt-2">
                <input
                  id="businessName"
                  name="businessName"
                  type="text"
                  required
                  maxLength={80}
                  disabled={isPending}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="mis. Juki Fish Farm"
                  className="block w-full rounded-xl border border-line bg-surface px-4 py-3 text-base font-semibold text-ink outline-none transition focus:border-accent-strong focus:ring-2 focus:ring-accent-strong/20 disabled:bg-neutral-soft/50"
                />
              </div>
              {state?.fieldError ? (
                <p className="mt-1.5 text-xs font-semibold text-error-ink">{state.fieldError}</p>
              ) : null}
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isPending}
                className={`w-full ${buttonClass("primary")}`}
              >
                {isPending ? "Menyimpan Nama Usaha…" : "Simpan & Terapkan Nama Baru"}
              </button>
            </div>

            <p className="text-xs text-ink-muted text-center leading-5">
              Perubahan nama usaha akan langsung memperbarui header, footer, metadata SEO, serta pesan
              WhatsApp pengunjung secara otomatis.
            </p>
          </form>
        </div>

        {/* Live Preview Card */}
        <div className="space-y-6">
          <div className="rounded-[1.75rem] border border-line bg-surface p-6 sm:p-8 shadow-sm">
            <h3 className="text-base font-bold text-ink">Pratinjau Penggunaan Nama</h3>
            <p className="text-xs text-ink-muted mt-1">
              Bagaimana nama usaha ini akan terlihat di website:
            </p>

            <div className="mt-6 space-y-4">
              <div className="rounded-2xl border border-line bg-cream/50 p-4">
                <p className="text-xs font-semibold text-accent-strong uppercase">
                  Header &amp; Navigasi:
                </p>
                <p className="mt-1 text-lg font-bold text-deep truncate">
                  {name || "(Nama belum diisi)"}
                </p>
              </div>

              <div className="rounded-2xl border border-line bg-cream/50 p-4">
                <p className="text-xs font-semibold text-accent-strong uppercase">
                  Pesan WhatsApp Pengunjung:
                </p>
                <p className="mt-1 text-sm text-ink leading-6 italic">
                  &ldquo;Halo {name || "..."} , saya ingin bertanya tentang ikan nila.&rdquo;
                </p>
              </div>

              <div className="rounded-2xl border border-line bg-cream/50 p-4">
                <p className="text-xs font-semibold text-accent-strong uppercase">
                  Hak Cipta Footer:
                </p>
                <p className="mt-1 text-xs text-ink-muted">
                  © {name || "..."}. Website informasi; transaksi disepakati melalui WhatsApp.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
