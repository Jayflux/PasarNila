"use client";

import { useActionState } from "react";

import { buttonClass } from "@/components/ui/button-styles";
import { signInAction, type AuthActionResult } from "@/lib/actions/auth";

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
        <label
          htmlFor="email"
          className="block text-sm font-semibold text-ink"
        >
          Email Mitra
        </label>
        <div className="mt-2">
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="nama@email.com"
            disabled={isPending}
            className="block w-full rounded-xl border border-line bg-surface px-4 py-3 text-base text-ink transition outline-none placeholder:text-neutral-ink/50 focus:border-accent-strong focus:ring-2 focus:ring-accent-strong/20 disabled:bg-neutral-soft/50"
          />
        </div>
      </div>

      <div>
        <label
          htmlFor="password"
          className="block text-sm font-semibold text-ink"
        >
          Kata Sandi
        </label>
        <div className="mt-2">
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            placeholder="••••••••"
            disabled={isPending}
            className="block w-full rounded-xl border border-line bg-surface px-4 py-3 text-base text-ink transition outline-none placeholder:text-neutral-ink/50 focus:border-accent-strong focus:ring-2 focus:ring-accent-strong/20 disabled:bg-neutral-soft/50"
          />
        </div>
      </div>

      <div>
        <button
          type="submit"
          disabled={isPending}
          className={`w-full ${buttonClass("primary")}`}
        >
          {isPending ? "Memeriksa kredensial…" : "Masuk ke Panel Mitra"}
        </button>
      </div>

      <p className="text-center text-xs text-ink-muted">
        Hanya untuk mitra terdaftar PasarNila. Tidak ada pendaftaran mandiri.
      </p>
    </form>
  );
}
