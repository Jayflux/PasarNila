/**
 * `npm run db:preflight` — pemeriksaan READ-ONLY sebelum menerapkan migrasi ke Supabase cloud.
 *
 * 1. Memastikan target dari .env.local (bukan environment sistem): peruntukan dev/staging eksplisit,
 *    project ref cocok dengan URL (tests/support/cloud-target.ts).
 * 2. Membaca identitas proyek dan riwayat migrasi lewat Supabase Management API (GET saja) memakai
 *    SUPABASE_ACCESS_TOKEN dari .env.local.
 * 3. Membandingkan riwayat cloud dengan file di supabase/migrations dan mencetak daftar yang AKAN
 *    diterapkan. Tidak ada yang diubah. Nilai token/key/password tidak pernah dicetak.
 *
 * Penerapan sesungguhnya tetap memakai Supabase CLI (lihat README "Migrasi tanpa Docker").
 */
import { readdirSync } from "node:fs";
import path from "node:path";

import { readEnvLocalFile, resolveCloudTarget } from "../tests/support/cloud-target";

const env = readEnvLocalFile() ?? {};
const target = resolveCloudTarget(env);

const mask = (ref: string) => (ref ? `${ref.slice(0, 4)}…` : "(kosong)");

const localFiles = readdirSync(path.join(process.cwd(), "supabase", "migrations"))
  .filter((file) => /^\d{14}_[a-z0-9_]+\.sql$/.test(file))
  .sort();

console.log(`File migrasi lokal: ${localFiles.length}`);

let refForApi = "";
if (target.ok) {
  refForApi = target.target.ref;
  console.log(`Target: ${target.target.targetEnv} | ref ${mask(refForApi)} (cocok dengan URL)`);
  for (const note of target.notes) console.log(`  catatan: ${note}`);
} else {
  console.log("Target BELUM terverifikasi:");
  for (const reason of target.reasons) console.log(`  - ${reason}`);
  // Tetap tampilkan riwayat (read-only) bila ref dapat diturunkan dari URL, agar rekonsiliasi terlihat.
  try {
    refForApi = new URL(env.NEXT_PUBLIC_SUPABASE_URL ?? "").hostname.split(".")[0] ?? "";
  } catch {
    refForApi = "";
  }
}

async function main(): Promise<void> {
  const token = env.SUPABASE_ACCESS_TOKEN ?? "";
  if (!token || !refForApi) {
    console.log("\nRiwayat cloud tidak dibaca: SUPABASE_ACCESS_TOKEN atau URL proyek kosong di .env.local.");
    process.exitCode = 1;
  } else {
    const headers = { Authorization: `Bearer ${token}` };
    const api = `https://api.supabase.com/v1/projects/${refForApi}`;

    const project = await fetch(api, { headers });
    if (project.status !== 200) {
      console.log(`\nIdentitas proyek tidak dapat dibaca (HTTP ${project.status}). Token mungkin bukan milik proyek ini.`);
      process.exitCode = 1;
    } else {
      const info = (await project.json()) as { name?: string; region?: string; status?: string };
      console.log(`Proyek cloud: "${info.name}" | region ${info.region} | status ${info.status}`);

      const history = await fetch(`${api}/database/migrations`, { headers });
      const applied = history.status === 200 ? ((await history.json()) as Array<{ version: string; name?: string }>) : [];
      if (history.status !== 200) console.log(`Riwayat migrasi tidak dapat dibaca (HTTP ${history.status}).`);

      const localVersions = new Map(localFiles.map((f) => [f.slice(0, 14), f]));
      const remoteVersions = new Set(applied.map((m) => m.version));
      const remoteOnly = applied.filter((m) => !localVersions.has(m.version));
      const pending = localFiles.filter((f) => !remoteVersions.has(f.slice(0, 14)));

      console.log(`\nRiwayat cloud: ${applied.length} versi tercatat.`);
      for (const m of applied) {
        console.log(`  ${localVersions.has(m.version) ? "cocok " : "HANYA CLOUD"} ${m.version} ${m.name ?? ""}`);
      }
      console.log(`\nAkan diterapkan oleh \`supabase db push --remote\` (${pending.length}):`);
      for (const f of pending) console.log(`  + ${f}`);
      if (remoteOnly.length > 0) {
        console.log("\nPERINGATAN: ada versi di cloud yang tidak ada di repo; rekonsiliasi dulu (ARCHITECTURE §8.9).");
        process.exitCode = 1;
      }
      if (!target.ok) {
        console.log("\nPenerapan DITAHAN sampai target terverifikasi (lihat alasan di atas).");
        process.exitCode = 1;
      }
    }
  }
}

void main();
