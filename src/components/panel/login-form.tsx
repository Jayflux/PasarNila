"use client";

import { useActionState } from "react";

import { buttonClass } from "@/components/ui/button-styles";
import { signInAction, type AuthActionResult } from "@/lib/actions/auth";

/** Form login mitra (PRD FR-15, AC-17, AC-18, AC-20). Tidak ada pendaftaran mandiri (AC-22). */
export function LoginForm() {
  const [state, formAction, isPending] = useActionState<AuthActionResult | null, FormData>(
    signInAction,
    null,
  );

  return (
    <form action={formAction} className="mt-8 space-y-6">
      {state?.error ? (
        <div
          role="alert"
          className="rounded-2xl border border-error-ink/20 bg-error-soft p-4 text-sm font-medium text-error-ink"
        >
          {state.error}
        </div>
      ) : null}

      <div>
        <label htmlFor="email" className="block text-sm font-semibold text-ink">
          Email mitra
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          // Kolom email tidak dikosongkan lagi setelah login gagal (form di-reset React setelah action).
          defaultValue={state?.email ?? ""}
          key={state?.email ?? ""}
          className="mt-2 block w-full rounded-xl border border-line bg-surface px-4 py-3 text-base text-ink outline-none transition focus:border-accent-strong focus:ring-2 focus:ring-accent-strong/20"
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-semibold text-ink">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="mt-2 block w-full rounded-xl border border-line bg-surface px-4 py-3 text-base text-ink outline-none transition focus:border-accent-strong focus:ring-2 focus:ring-accent-strong/20"
        />
      </div>

      <button type="submit" disabled={isPending} className={`w-full ${buttonClass("primary")}`}>
        {isPending ? "Memeriksa…" : "Masuk ke panel mitra"}
      </button>

      <p className="text-center text-xs text-ink-muted">
        Hanya untuk mitra terdaftar. Tidak ada pendaftaran akun mandiri.
      </p>
    </form>
  );
}
