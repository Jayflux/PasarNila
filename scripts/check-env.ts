/**
 * `npm run check:env` — laporkan NAMA environment variable, status, dan sumbernya, TANPA nilai.
 *
 * File `.env*` dimuat dengan pemuat resmi Next.js (`@next/env`), urutan yang sama seperti `next dev`
 * (atau `next build` bila dijalankan dengan `--production`). Seperti Next.js, variabel yang SUDAH ada di
 * environment sistem tidak ditimpa oleh file `.env*`; kolom "sumber" menunjukkan hal itu. Isi file dan
 * nilai variabel tidak pernah dicetak (hanya dibandingkan di memori).
 *
 * Pemeriksaan ini hanya format & keberadaan. Ia TIDAK menghubungi Supabase dan TIDAK membuktikan
 * bahwa database atau migrasinya sudah siap.
 */
import { parseEnv } from "node:util";

import { loadEnvConfig } from "@next/env";

import { checkEnvironment, isEnvCheckPassing, type EnvCheckRow } from "../src/lib/env";

const production = process.argv.includes("--production");

// Catat NAMA variabel yang sudah terisi di environment sistem sebelum file .env* dimuat.
const presetNames = new Set(
  Object.keys(process.env).filter((name) => (process.env[name] ?? "").trim() !== ""),
);

const silentLog = { info: () => {}, error: () => {} };
const { loadedEnvFiles } = loadEnvConfig(process.cwd(), !production, silentLog);

// PENTING: `file.env` dari @next/env sudah ditimpa nilai environment sistem (dotenv-expand), jadi nilai
// per file dibaca ulang dari `file.contents` mentah. Versi sebelumnya keliru karena memakai `file.env`.
const fileValues = loadedEnvFiles.map((file) => ({
  path: file.path,
  values: parseEnv(file.contents) as Record<string, string | undefined>,
}));

function sourceOf(name: string): string {
  const filesWithValue = fileValues.filter((file) => (file.values[name] ?? "").trim() !== "");
  if (presetNames.has(name)) {
    const ignored = filesWithValue.filter(
      (file) => (file.values[name] ?? "").trim() !== (process.env[name] ?? "").trim(),
    );
    return ignored.length > 0
      ? `environment sistem (nilai berbeda di ${ignored.map((f) => f.path).join(", ")} DIABAIKAN)`
      : "environment sistem";
  }
  return filesWithValue[0]?.path ?? "-";
}

const rows = checkEnvironment(process.env);

function pad(text: string, width: number): string {
  return text.length >= width ? text : text + " ".repeat(width - text.length);
}

function printGroup(title: string, groupRows: EnvCheckRow[]): void {
  if (groupRows.length === 0) return;
  const nameWidth = Math.max(...groupRows.map((row) => row.name.length), 4) + 2;
  console.log(`\n${title}`);
  for (const row of groupRows) {
    const status = row.status + (row.required ? " (wajib)" : "");
    const source = row.status === "kosong" ? "-" : sourceOf(row.name);
    const note = row.note ? ` — ${row.note}` : "";
    console.log(`  ${pad(row.name, nameWidth)}${pad(status, 20)}sumber: ${source}${note}`);
  }
}

console.log(`Mode: ${production ? "production" : "development"}`);
console.log(
  `File env yang dimuat: ${
    loadedEnvFiles.length > 0 ? loadedEnvFiles.map((file) => file.path).join(", ") : "(tidak ada)"
  }`,
);

printGroup("Aplikasi", rows.filter((row) => row.group === "aplikasi"));
printGroup("Tooling lokal/CI (tidak dipakai aplikasi)", rows.filter((row) => row.group === "tooling"));
printGroup("Tidak boleh ada", rows.filter((row) => row.group === "terlarang"));

const fromSystem = rows.filter((row) => row.status !== "kosong" && presetNames.has(row.name));
if (fromSystem.length > 0) {
  console.log(
    `\nPerhatian: ${fromSystem.map((row) => row.name).join(", ")} berasal dari environment sistem ` +
      "dan mengalahkan file .env*. Supabase CLI juga membaca environment sistem. Pastikan nilainya " +
      "milik proyek yang benar sebelum `supabase link` / `db push`.",
  );
}

const passing = isEnvCheckPassing(rows);
console.log(
  `\nHasil: ${passing ? "LULUS" : "ADA MASALAH"} (hanya format & keberadaan; koneksi dan kesiapan database tidak diperiksa).`,
);
process.exitCode = passing ? 0 : 1;
