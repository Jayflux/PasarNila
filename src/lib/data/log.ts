import "server-only";

/**
 * Pencatatan kegagalan baca data publik ke log server.
 *
 * Hanya mencatat nama, kode, dan pesan error. Tidak pernah mencatat nilai env var, header, atau isi
 * permintaan. `EnvValidationError` sendiri hanya memuat nama variabel (src/lib/env.ts).
 */
export function logReadError(scope: string, error: unknown): void {
  if (error instanceof Error) {
    console.error(`[data:${scope}] gagal dimuat: ${error.name}: ${error.message}`);
    return;
  }
  if (typeof error === "object" && error !== null) {
    const { code, message } = error as { code?: unknown; message?: unknown };
    console.error(
      `[data:${scope}] gagal dimuat: kode=${String(code ?? "-")} pesan=${String(message ?? "-")}`,
    );
    return;
  }
  console.error(`[data:${scope}] gagal dimuat`);
}
