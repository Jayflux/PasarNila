import { buttonClass } from "@/components/ui/button-styles";
import { isSuccessState, type ActionResult } from "@/lib/write/action-result";

type Props = {
  result: ActionResult<unknown, string> | null;
  pending?: boolean;
  onRecheck?: () => void;
  /** Tombol tambahan (mis. "Segarkan tampilan publik"). */
  extraAction?: { label: string; onClick: () => void };
  className?: string;
};

const tone = {
  success: "border-wa/30 bg-wa/10 text-ink",
  warning: "border-warn-ink/25 bg-warn-soft text-warn-ink",
  error: "border-error-ink/20 bg-error-soft text-error-ink",
} as const;

/**
 * Pesan hasil simpan panel (PRD AC-26, AC-29, AC-51, AC-52; ARCHITECTURE §10.3).
 * Berhasil → `role="status"`; gagal/belum pasti → `role="alert"` agar dibacakan pembaca layar.
 */
export function ResultNotice({ result, pending = false, onRecheck, extraAction, className = "" }: Props) {
  if (!result) return null;
  const success = isSuccessState(result.state);
  const uncertain = result.state === "uncertain" || result.state === "changed_elsewhere";
  const variant = success ? "success" : uncertain ? "warning" : "error";

  return (
    <div
      role={success ? "status" : "alert"}
      className={`rounded-2xl border p-4 sm:p-5 ${tone[variant]} ${className}`}
    >
      <p className="font-semibold leading-6">{result.message}</p>
      {result.detail ? <p className="mt-1 text-sm leading-6">{result.detail}</p> : null}
      {result.warning ? (
        <p className="mt-2 rounded-xl bg-warn-soft px-3 py-2 text-sm leading-6 text-warn-ink">{result.warning}</p>
      ) : null}

      {(result.canRecheck && onRecheck) || result.state === "session_expired" || extraAction ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {result.canRecheck && onRecheck ? (
            <button
              type="button"
              onClick={onRecheck}
              disabled={pending}
              className={buttonClass("secondary", "sm")}
            >
              {pending ? "Memeriksa…" : "Periksa ulang"}
            </button>
          ) : null}
          {result.state === "session_expired" ? (
            <a href="/mitra/login" target="_blank" rel="noopener" className={buttonClass("secondary", "sm")}>
              Login ulang di tab baru
            </a>
          ) : null}
          {extraAction ? (
            <button
              type="button"
              onClick={extraAction.onClick}
              disabled={pending}
              className={buttonClass("secondary", "sm")}
            >
              {extraAction.label}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
