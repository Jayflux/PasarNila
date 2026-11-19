import { defineConfig, devices } from "@playwright/test";

import { readEnvLocalFile } from "./tests/support/cloud-target";

/**
 * Uji browser fase 9 (ARCHITECTURE.md §17, T-18, T-19). Prasyarat: `npm run build` lebih dulu.
 *
 * - Build PRODUKSI (`next start`), bukan `next dev`. Port 3000/3200 tidak disentuh.
 * - Server kedua (3201) memakai build yang sama, dengan `fetch` ke `*.supabase.co` digagalkan oleh preload
 *   (`tests/e2e/support/fail-supabase-fetch.cjs`) untuk menguji keadaan gangguan secara terkontrol. Cloud
 *   tidak dihubungi oleh server itu.
 * - Satu worker, Chromium saja (beban laptop). Sesi/trace/screenshot disimpan di `.playwright/` (diabaikan Git).
 * - Data cloud: hanya proyek dev/staging terverifikasi (tests/support/cloud-target.ts); fixture bertanda
 *   `UJI-E2E` dibersihkan di `tests/e2e/global-teardown.ts`.
 */
export const BASE_URL = "http://127.0.0.1:3202";
export const OUTAGE_URL = "http://127.0.0.1:3201";
const isolated = process.env.PASARNILA_E2E_ISOLATED === "1";
const artifacts = isolated ? ".playwright/phase9" : ".playwright";

const local = readEnvLocalFile() ?? {};
const appEnv = Object.fromEntries([
  "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "NEXT_PUBLIC_SITE_URL",
  "WHATSAPP_NUMBER", "ALLOW_INDEXING", "VERCEL_ENV", "VERCEL_URL",
].map((key) => [key, local[key] ?? ""]));
if (appEnv.ALLOW_INDEXING !== "false") throw new Error("Suite staging memerlukan ALLOW_INDEXING=false di .env.local");

export default defineConfig({
  testDir: "tests/e2e",
  outputDir: `${artifacts}/results`,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [["list"], ["json", { outputFile: `${artifacts}/report.json` }], ["html", { outputFolder: `${artifacts}/html`, open: "never" }]],
  globalSetup: "./tests/e2e/global-setup.ts",
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    locale: "id-ID",
    timezoneId: "Asia/Jakarta",
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "chromium",
      testIgnore: /auth\.setup\.ts/,
      dependencies: ["setup"],
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
    },
  ],
  webServer: [
    {
      command: "node ./node_modules/next/dist/bin/next start -p 3202 -H 127.0.0.1",
      url: `${BASE_URL}/kontak`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: appEnv,
    },
    {
      command: "node ./node_modules/next/dist/bin/next start -p 3201 -H 127.0.0.1",
      url: `${OUTAGE_URL}/kontak`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: { ...appEnv, NODE_OPTIONS: "--require ./tests/e2e/support/fail-supabase-fetch.cjs" },
    },
  ],
});
