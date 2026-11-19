# PasarNila

Website informasi & promosi ikan nila (stok kg, harga/kg, waktu pembaruan WIB, tombol WhatsApp) dengan
panel untuk satu mitra. Kebutuhan ada di [`PRD.md`](./PRD.md), keputusan teknis di
[`ARCHITECTURE.md`](./ARCHITECTURE.md).

## Status

Kode aplikasi MVP + paket katalog **lulus uji fungsional lokal**. Proyek Supabase "PasarNila" dikonfirmasi
pemilik sebagai **dev/staging** (19 Nov 2026); semua migrasi sudah diterapkan di sana dan diuji lewat Data API
dan build produksi lokal (`ARCHITECTURE.md` Lampiran E). Proyek itu **belum** dipakai klien, belum ada
deployment. **Fase 9 selesai sebagian**: run akhir 81 tes browser dan 65 pemeriksaan responsif lulus;
36 scan axe tanpa pelanggaran (12 `incomplete` ditinjau). URI SQL sudah valid; suite SQL cloud
**terhalang jaringan** (TCP 5432 ke pooler timeout dari host ini; 0 assertion berjalan). NFR-18 **belum
terverifikasi terpenuhi**: host pengukuran tidak memadai (baterai, paket Balanced, render SwiftShader; halaman
statis kosong hanya mendapat 80). Seluruh perubahan fase 9 masih di working tree (HEAD `173d9d6`); clone commit
itu saja tidak mencakupnya. Langkah untuk host lain ada di
[laporan verifikasi fase 9 §19](./docs/verification/phase-9.md#19-tabel-kriteria-pekerjaan-selesai-dan-langkah-berikutnya).

- **Halaman publik:** beranda, `/produk`, `/produk/ikan-nila`, `/artikel`, `/artikel/[slug]`, `/profil`,
  `/kontak`, `robots.txt`, `sitemap.xml`. Stok, harga, dan paket dibaca dari database setiap kali halaman
  dibuka (tanpa cache). Bila data gagal dimuat, tampil pesan gangguan tanpa angka (AC-12). Isi artikel
  dirender sebagai Markdown aman.
- **Panel mitra** (`/mitra`): stok & harga satuan, **paket katalog** (`/mitra/paket`: tambah, ubah nama/berat/
  harga total, hapus), artikel (edit judul & isi dua artikel), pengaturan nama usaha, login/logout.
  Hasil simpan yang belum pasti (timeout/koneksi putus) dibaca ulang dan tidak dilaporkan "tidak berubah";
  sesi yang berakhir tidak menghapus isian.
- **Paket katalog:** semua paket memakai **stok total bersama** (asumsi PRD A-21). Harga total paket
  ditentukan mitra; harga efektif/kg dan badge "Hemat Rp…" dihitung dari harga satuan per kg saat ini
  (PRD §12.8, ARCHITECTURE §11.4). Belum ada paket awal.
- **Database:** 11 versi migrasi lokal dan staging, tanpa pending. PGlite 145/145 lulus; Data API 26/26
  adalah bukti historis. `test:db:cloud` berhenti sebelum assertion karena TCP timeout (0 kasus berjalan).
  Klien aplikasi memakai tipe skema `public` hasil generate dari staging (`src/types/database.ts`).
- **Konten menunggu klien:** foto, deskripsi produk, sejarah usaha, jam operasional, isi artikel, daftar paket
  awal, serta konfirmasi tertulis dukungan program pemerintah sebelum logonya ditampilkan (PRD K3–K5, K9,
  K10, K16–K18). Konten itu tampil sebagai **placeholder, bukan konten final**.

Rincian: `ARCHITECTURE.md` §6.2 dan Lampiran D (perbaikan audit commit `4373729`).

## Kebutuhan

- Node.js ≥ 20.9 (dikembangkan dengan Node 26; disarankan versi LTS)
- npm (lockfile: `package-lock.json`)
- **Tidak perlu Docker.** Supabase CLI dipasang sebagai devDependency (`npx supabase …`).

## Menjalankan

```bash
npm install
cp .env.example .env.local   # lalu isi nilainya
npm run check:env            # nama & status env saja, tanpa nilai
npm run dev
```

## Perintah

| Perintah | Fungsi |
|---|---|
| `npm run dev` | Server pengembangan |
| `npm run build` / `npm start` | Build & jalankan mode produksi (uji cache wajib di sini, bukan hanya `dev`) |
| `npm run lint` | ESLint |
| `npm run typecheck` | `next typegen` + `tsc --noEmit` |
| `npm test` | Unit test (Vitest): parser, domain, klasifikasi hasil simpan, inti Server Action, render komponen |
| `npm run test:e2e` | Browser Chromium, axe, dan responsif setelah build produksi lokal; memakai akun/staging terverifikasi, port localhost 3201 dan 3202 |
| `npm run test:db` | Uji migrasi & keamanan database secara lokal (PGlite, tanpa Docker/jaringan), termasuk paket katalog |
| `npm run check` | lint + typecheck + test + test:db |
| `npm run check:env` | Memeriksa format & keberadaan env var (tidak memeriksa koneksi database) |

## Aturan penting

- Jangan commit `.env.local` atau secret apa pun. Aplikasi tidak memakai Supabase secret key.
- Nama usaha tidak ditulis di kode; sumbernya tabel `site_settings` (PRD §12.7).
- Data stok/harga dan paket tidak di-cache (ARCHITECTURE.md §12).
- Harga paket tidak ditulis di kode; sumbernya tabel `product_packages` yang diisi mitra (PRD §12.8).

## Database: Supabase cloud tanpa Docker

Laptop pengembangan **tidak** menjalankan Docker atau Supabase lokal. Next.js berjalan lokal; database &
auth memakai proyek Supabase cloud **development/staging** yang terpisah dari production.
Rincian: `ARCHITECTURE.md` §8.9 (rekonsiliasi) dan §16.6 (alur tanpa Docker).

| Perintah | Fungsi | Mengubah cloud? |
|---|---|---|
| `npm run test:db` | Uji migrasi & RLS/grant/RPC di PGlite (Postgres WASM) + shim Supabase | Tidak |
| `npm run db:preflight` | Cek target dari `.env.local` + bandingkan riwayat migrasi cloud (GET) | Tidak |
| `npx supabase db push --remote=<ref> --dry-run --skip-vault` | Daftar migrasi yang akan diterapkan | Riwayat tidak; CLI memperbarui role sementara `cli_login_postgres` |
| `npm run test:db:cloud` | Uji SQL di cloud, setiap kasus di-ROLLBACK | Tidak (rollback) |
| `npm run test:api:cloud` | Uji Data API dengan sesi anon/non-mitra/mitra, termasuk paket katalog | Login + produk uji tersembunyi dan paket `UJI-API-…` (dibuat dan dihapus oleh uji) |

Prasyarat uji/penerapan cloud (di `.env.local`, bukan environment sistem):
`SUPABASE_TARGET_ENV=development|staging`, `SUPABASE_PROJECT_REF` cocok dengan URL, `SUPABASE_DB_URL`
(untuk `test:db:cloud`; gunakan URI project yang benar, mis. Session pooler port 5432, dan percent-encode
karakter khusus pada komponen password). Fixture uji Data API memakai `SUPABASE_DB_URL` bila ada,
jika tidak `SUPABASE_ACCESS_TOKEN` lewat Management API (`tests/support/cloud-fixture.ts`).
Untuk CLI, injeksikan `SUPABASE_ACCESS_TOKEN` dari `.env.local` per proses; token di environment sistem bisa
berbeda proyek.
Jangan pernah menjalankan `supabase start` atau `db reset`.

Untuk E2E, gunakan staging khusus testing dengan `ALLOW_INDEXING=false`, akun uji mitra/non-mitra,
stok/harga yang bisa dipulihkan lewat RPC, linked project yang cocok, dan tanpa paket awal pada `ikan-nila`
untuk kasus katalog kosong. E2E memakai Data API, tidak memakai kredensial SQL.
Jalankan `npm run build` lalu `npm run test:e2e` dengan Chromium Playwright terpasang. Jangan jalankan
suite tulis bersamaan dengan pengguna atau runner staging lain. Laporan JSON/HTML dan sesi uji tersimpan
di `.playwright/`; jika teardown gagal, periksa ledger dan baseline yang tersimpan sebelum memulai run baru.
Jika build biasa sedang dipakai, set `PASARNILA_E2E_ISOLATED=1` pada proses build, typecheck, dan E2E agar
output Next dan laporan dipisahkan di `.playwright/`. Lock penulisan staging tetap dipakai bersama.
