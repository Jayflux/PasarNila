# PasarNila

Website informasi & promosi ikan nila (stok kg, harga/kg, waktu pembaruan WIB, tombol WhatsApp) dengan
panel untuk satu mitra. Kebutuhan ada di [`PRD.md`](./PRD.md), keputusan teknis di
[`ARCHITECTURE.md`](./ARCHITECTURE.md).

## Status

Tahap fondasi + database: Next.js 16.4.6 (App Router, TypeScript strict, Tailwind CSS v4), fungsi domain
murni, validasi konfigurasi, unit test, dan 6 migrasi Supabase v0.4 yang lulus uji database lokal.
Migrasi **belum** diterapkan ke cloud (peruntukan proyek cloud belum terverifikasi, PRD Q-22).
**Belum ada** halaman publik, panel, atau deployment.

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
| `npm test` | Unit test (Vitest) |
| `npm run test:db` | Uji migrasi & keamanan database secara lokal (PGlite, tanpa Docker/jaringan) |
| `npm run check` | lint + typecheck + test + test:db |
| `npm run check:env` | Memeriksa format & keberadaan env var (tidak memeriksa koneksi database) |

## Aturan penting

- Jangan commit `.env.local` atau secret apa pun. Aplikasi tidak memakai Supabase secret key.
- Nama usaha tidak ditulis di kode; sumbernya tabel `site_settings` (PRD §12.7).
- Data stok/harga tidak di-cache (ARCHITECTURE.md §12).

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
| `npm run test:api:cloud` | Uji Data API dengan sesi anon/non-mitra/mitra | Login + produk uji tersembunyi (dihapus) |

Prasyarat uji/penerapan cloud (di `.env.local`, bukan environment sistem):
`SUPABASE_TARGET_ENV=development|staging`, `SUPABASE_PROJECT_REF` cocok dengan URL, `SUPABASE_DB_URL`.
Jangan pernah menjalankan `supabase start` atau `db reset`.
