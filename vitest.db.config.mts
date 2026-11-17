import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

/**
 * Uji database (ARCHITECTURE.md §17.3).
 * - `npm run test:db`        → tests/db/*.local.test.ts (PGlite, tanpa Docker, tanpa jaringan)
 * - `npm run test:db:cloud`  → tests/db/*.cloud.test.ts (hanya dev/staging terverifikasi)
 * - `npm run test:api:cloud` → tests/api/*.cloud.test.ts (Data API dengan sesi pengguna)
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    include: ["tests/db/**/*.test.ts", "tests/api/**/*.test.ts"],
    environment: "node",
    testTimeout: 30_000,
    hookTimeout: 120_000,
    // Satu koneksi/instans per file; jangan jalankan file uji database secara paralel.
    fileParallelism: false,
  },
});
