/**
 * Mengubah kegagalan yang PASTI (bukan `uncertain`) menjadi hasil aksi panel (ARCHITECTURE.md §10.3).
 */
import { MESSAGES, type ActionResult } from "@/lib/write/action-result";
import type { WriteFailure } from "@/lib/write/outcome";

export type CertainFailure = Exclude<WriteFailure, { kind: "uncertain" }>;

export type FieldError<TField extends string> = { field: TField; message: string };

export type FailureMappingOptions<TField extends string> = {
  /** Memetakan kunci exception database (mis. `stock_out_of_range`) ke pesan kolom. */
  fieldForKey?: (key: string | null) => FieldError<TField> | null;
  notFoundMessage?: string;
  conflictMessage?: string;
};

export function certainFailureResult<TSaved, TField extends string>(
  failure: CertainFailure,
  options: FailureMappingOptions<TField> = {},
): ActionResult<TSaved, TField> {
  switch (failure.kind) {
    case "session":
      return { state: "session_expired", message: MESSAGES.sessionExpired };
    case "forbidden":
      return { state: "forbidden", message: MESSAGES.forbidden };
    case "not_found":
      return { state: "not_found", message: options.notFoundMessage ?? MESSAGES.notFound };
    case "invalid": {
      const field = options.fieldForKey?.(failure.key) ?? null;
      if (field) {
        return {
          state: "invalid",
          message: MESSAGES.invalid,
          fieldErrors: { [field.field]: field.message } as Partial<Record<TField, string>>,
        };
      }
      return {
        state: "invalid",
        message: "Database menolak isian ini. Data tidak berubah. Periksa kembali isian Anda.",
      };
    }
    case "conflict":
      return { state: "rejected", message: options.conflictMessage ?? MESSAGES.rejected };
    case "rejected":
      return { state: "rejected", message: MESSAGES.rejected };
  }
}
