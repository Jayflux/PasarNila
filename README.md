# PasarNila

Website informasi & promosi ikan nila (stok kg, harga/kg, waktu pembaruan WIB, tombol WhatsApp) dengan
panel untuk satu mitra. Kebutuhan ada di [`PRD.md`](./PRD.md), keputusan teknis di
[`ARCHITECTURE.md`](./ARCHITECTURE.md).

## Status

Tahap fondasi: Next.js 16.4.6 (App Router, TypeScript strict, Tailwind CSS v4), fungsi domain murni
(parser stok/harga, format kg/rupiah/WIB, status stok/harga, tautan WhatsApp), validasi konfigurasi, dan
unit test. **Belum ada** migrasi database, koneksi Supabase, halaman publik, panel, atau deployment.

## Kebutuhan

- Node.js ≥ 20.9 (dikembangkan dengan Node 26; disarankan versi LTS)
- npm (lockfile: `package-lock.json`)

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
| `npm run check` | lint + typecheck + test |
| `npm run check:env` | Memeriksa format & keberadaan env var (tidak memeriksa koneksi database) |

## Aturan penting

- Jangan commit `.env.local` atau secret apa pun. Aplikasi tidak memakai Supabase secret key.
- Nama usaha tidak ditulis di kode; sumbernya tabel `site_settings` (PRD §12.7).
- Data stok/harga tidak di-cache (ARCHITECTURE.md §12).
