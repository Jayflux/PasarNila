# Verifikasi Fase 9 — Pengerasan, responsif, aksesibilitas, browser, Lighthouse

**Status terkini (19 November 2026): selesai sebagian; tidak ada pekerjaan produktif lagi di host ini.**
Pekerjaan aplikasi fase 9 selesai dan teruji (§11). Dua pemeriksaan **terhalang lingkungan**: SQL cloud
(TCP 5432 ke Session pooler tidak terjangkau dari jaringan ini) dan NFR-18 (host: baterai, paket daya
Balanced, Chromium headless merender dengan SwiftShader). Bukti terkini, tabel kriteria, dan langkah untuk
host lain ada di §13–§19 (ronde terakhir: §16–§19). §1–§12 mencatat putaran sebelumnya.

> **Peringatan serah terima:** seluruh perubahan fase 9 masih berada di **working tree** `feat/fondasi-aplikasi`
> (HEAD `173d9d6`, belum di-commit). Meng-clone commit `173d9d6` saja **tidak** mencakup perubahan itu;
> gunakan salinan working tree (atau commit yang dibuat pemilik setelah tinjauan). Tidak ada commit, push,
> PR, deployment, akses Vercel, atau pekerjaan fase 10 dalam ronde mana pun yang tercatat di sini.

---

## Baseline historis (recovery)

Tanggal: 19 November 2026 · Branch `feat/fondasi-aplikasi` (di atas `173d9d6`, belum di-commit) ·
Lingkungan: Windows / PowerShell, Node 26.13.0, build produksi lokal (`next build` + `next start` di
127.0.0.1) dengan Supabase **dev/staging** "PasarNila" (dikonfirmasi pemilik). Bukan Vercel atau production.

**Status: selesai sebagian.** Suite browser, pemeriksaan responsif, batas severity AC-43, dan pemeriksaan
keamanan lokal lulus; target performa NFR-18 belum tercapai. SQL langsung cloud belum dijalankan.

Dokumen ini tidak memuat rahasia, cookie, atau sesi. Artefak mentah (sesi login uji, trace, screenshot,
laporan JSON Lighthouse/axe) ada di `.playwright/` yang diabaikan Git.

## 1. Kriteria dari dokumen

| Sumber | Kriteria | Catatan |
|---|---|---|
| PRD NFR-01, AC-42, ARCHITECTURE T-18 | Lebar 360/768/1280 px: tanpa gulir horizontal, teks terbaca, tombol ≥ 44×44 px; papan ketik angka (`inputMode`). | Ditambah 390 & 1440 px atas permintaan pemilik. |
| PRD NFR-02 | Panel mobile-first, tombol ≥ 44×44 px, teks input ≥ 16 px. | |
| PRD NFR-15–NFR-17, AC-43, T-19 | axe tanpa pelanggaran *critical/serious*; keyboard penuh; label input; fokus terlihat; pesan simpan diumumkan (`aria-live`). | |
| PRD NFR-18 **[Saran]** | Lighthouse Performance **mobile ≥ 90** dan **LCP < 2,5 s** pada 4G. | Target berstatus saran; tidak ada ambang untuk desktop, Accessibility, Best Practices, SEO. |
| ARCHITECTURE §9.6 butir 2, §9.8 | Kebijakan password (min. 12), security headers, `Cache-Control` panel `private, no-store`. | |

## 2. Alat

| Alat | Versi | Cara |
|---|---|---|
| `@playwright/test` | 1.64.1 (devDependency, dipin) | `npm run build && npm run test:e2e` — `playwright.config.ts`, satu worker, Chromium saja |
| `playwright-core` | 1.64.1 (devDependency, dipin) | menyamakan salinan yang ditarik `@axe-core/playwright` |
| `@axe-core/playwright` | 4.14.0 (devDependency, dipin) | tag `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22aa`, `best-practice`; tidak ada aturan yang dimatikan |
| Chromium (Playwright) | 156.0.8078.4 | headless |
| Lighthouse | 13.6.0 dari npm, CLI lokal cache (tidak ditambahkan ke lockfile) | Headless Chromium 156.0.8078.4 (Playwright) |

Server uji (dibuat & dihentikan otomatis oleh Playwright): `127.0.0.1:3202` (normal) dan `127.0.0.1:3201`
(build yang sama dengan preload `tests/e2e/support/fail-supabase-fetch.cjs`: semua `fetch` ke `*.supabase.co`
   gagal seperti jaringan putus; server ini tidak menghubungi cloud). Port 3000 dan 3200 tidak disentuh. Origin uji =
host server, sehingga pemeriksaan Origin/Host Server Actions bawaan Next.js tetap aktif.

Login mitra dilakukan lewat formulir sungguhan (`tests/e2e/auth.setup.ts`) memakai akun uji dari
`.env.local`; tidak ada jalur bypass autentikasi di aplikasi.

## 3. Recovery: riwayat dan perubahan

- HEAD tetap `173d9d6`, branch `feat/fondasi-aplikasi` (2 commit di depan tracking branch lokal).
  Perubahan lokal integrasi Supabase dan fase 9 dipertahankan. PRD dan ARCHITECTURE yang tersedia adalah v0.8.
- Bukti sebelumnya: `.playwright/report-final.json` mulai 02:08 WIB, 73 lulus, 1 gagal, 0 skip/retry;
  kasus katalog kosong gagal menemukan pesan setelah fixture koneksi putus tertinggal. `run-final2.txt`
  mulai sekitar 02:15 WIB, 33 lulus untuk subset panel/publik + setup; bukan rekap final.
  `run1`, `run2`, `run3`, `run4-panel` mencatat 9/7/6/1 *did not run* setelah kegagalan dalam grup serial
  (antara lain dialog/edit paket, Markdown placeholder, dan strict mode `role=alert`); tidak ada skip
  tersisa pada run final recovery. `lh-server.log` lama menunjukkan server **Ready**, bukan bukti audit
  Lighthouse; PID yang aktif ditemukan pada port 3200 dan dipertahankan.
- Temuan aplikasi lama terkonfirmasi dari log: `color-contrast` (*serious*) pada `.reveal` beranda dan
  `definition-list` (*serious*) pada `<dl>` panel dengan error. Perbaikan lokal dipertahankan, termasuk
  `reveal-shift` tanpa opacity, struktur `<dl>` + unit test, heading, target sentuh, dan `connection()`
  sebelum blok penangkap error sesi. Di sisi test, perbaikan juga mencakup konteks anon eksplisit dan
  penilaian fokus `<dialog>`: Tab boleh singgah di UI browser, tetapi tidak boleh masuk ke halaman di belakangnya.
- Recovery: locator edit dikunci ke UUID pada form tersembunyi, bukan urutan kartu. Regex nonspasi
  benar-benar `/\S/`. Markdown uji tanpa marker placeholder diverifikasi di Pratinjau dan publik.
  Test paket menyiapkan datanya sendiri (termasuk harga satuan), dan test katalog kosong memakai
  prasyarat staging kosong yang diperiksa sendiri tanpa menghapus paket nyata. Fixture bernama unik
  didaftarkan sebelum tulis; teardown per test berjalan juga pada kegagalan, dan teardown global
  mengecek katalog/baseline. Satu worker, tanpa retry otomatis; lock lokal mencegah baseline tertimpa
  oleh run lain di workspace yang sama. Jalankan suite ini hanya saat staging diperuntukkan bagi pengujian.
- Performa: jejak awal memperlihatkan Chrome meminta Google Maps saat peta beranda masih di luar viewport.
  Kini iframe beranda dipasang saat kontainernya terlihat, dengan ruang tetap, fallback `<noscript>`,
  dan tautan Maps yang sama. Teks hero terlihat sejak frame awal dan masih bergerak untuk pengguna
  tanpa preferensi reduced motion. Detail memendekkan placeholder foto di HP dan mencadangkan ruang
  pada desktop agar footer tidak bergeser saat streaming. Prefetch latar pada header/footer dan breadcrumb
  detail dimatikan; navigasi dan pembacaan data tetap aktif. Ikon tab generik menghilangkan 404 favicon;
  ini bukan logo resmi. Pengukuran perbandingan ada di §5.

## 4. Bukti final browser, responsif, dan aksesibilitas

Build produksi final dibuat sekitar **02:46 WIB**, setelah perubahan aplikasi terakhir. Suite penuh final
mulai **02:46:37 WIB**, durasi **5m 12s**: **81 lulus, 0 gagal, 0 skipped, 0 flaky, 0 retry**, termasuk setup.
Kode keluar Playwright 0 dan `errors` global kosong. Run acuan recovery sebelum optimasi adalah 80/80;
run penuh diulang sekali karena perubahan header/footer bersama, beranda dan detail. Hasil tidak dijumlahkan.
Laporan final: `.playwright/report.json`, `.playwright/html/index.html`, `recovery-browser-final.log`.

| Area | Hasil final |
|---|---|
| Publik | Navigasi HP/desktop, alur produk/artikel, slug 404, metadata/noindex, skeleton, katalog kosong dan kegagalan muat terkontrol. Peta beranda diuji sebelum/sesudah scroll dan tanpa JavaScript. Hanya `href` WhatsApp yang diperiksa; tidak ada pesan dikirim. |
| Panel | Login normal, non-mitra, password salah, logout, sesi hilang saat form, gagal cek akses. Simpan stok/harga dan waktu konfirmasi maju, Rp0 (batal dan lanjut), data publik berubah setelah reload, artikel Sunting/Pratinjau/simpan/Markdown aman, nama usaha panjang, tambah/edit/hapus paket, harga paket bebas, badge dan harga efektif, klik ganda, putus sebelum Server Action sampai, periksa ulang, kirim ulang tanpa duplikat. |
| Responsif | 65 pemeriksaan halaman pada **360, 390, 768, 1280, 1440 px**; tidak ada overflow terdeteksi, target interaktif terukur memenuhi ambang pembulatan ke 44 px, input ≥16 px. Dialog hapus dan error form muat; nama paket 60 karakter, nama usaha panjang, harga Rp999.999.999 dan berat 12,34/0,25 kg diuji. Smoke terpisah Pixel 7 dan iPhone 13 (emulasi Chromium): tap menu/navigasi, login, panel paket dan `inputMode` lulus; tidak menguji Safari asli atau papan ketik fisik HP. |
| Keyboard, fokus, motion | Skip link Tab pertama → main, fokus visual, perpindahan Tab, keyboard form dan pengumuman simpan, Escape/fokus kembali pada dialog/menu, tidak bocor ke konten belakang dialog. Reduced motion dan reflow 320 px lulus; reflow adalah emulasi 400%, bukan zoom browser/perangkat fisik. |
| Axe | **36 pemindaian**: awal tanpa gulir, setelah gulir, beberapa lebar beranda, serta menu HP, error login/form, dialog Rp0/hapus, Pratinjau, pesan simpan, paket tersedia. **Critical 0, serious 0, moderate 1, minor 0.** Satu `landmark-unique` (*moderate*) pada `section` di `/kontak` setelah gulir; tidak muncul pada keadaan awal maupun satu pemeriksaan diagnostik terpisah. Temuan run final tetap dilaporkan. |

13 pemindaian memuat hasil `incomplete` yang memerlukan penilaian manual. Judul iframe, tautan alternatif,
dan perilaku muat peta diuji; isi pihak ketiga lintas domain dan pembacaan dengan pembaca layar asli
belum diverifikasi end-to-end. Tes keyboard adalah lintasan yang disebut di atas, bukan audit manual
setiap elemen. Hasil axe tidak membuktikan seluruh WCAG 2.2 AA. Artefak rinci: `state/axe.jsonl` dan
`state/responsive.jsonl` di bawah `.playwright/`.

**Batas cakupan:** tidak ada tes Playwright wajib terdaftar yang dilewati. Pemutusan koneksi browser
sebelum request sampai diuji end-to-end; variasi timeout setelah RPC tulis dan kegagalan baca ulang
dicakup pada level unit, bukan injeksi jaringan browser tambahan (T-23). Stok/harga `null` dan konfigurasi
WhatsApp kosong/tidak valid diuji lokal via unit, bukan mengosongkan nilai staging. Smoke Vercel (termasuk
bagian Vercel T-15/T-22), perangkat fisik, UAT, serta audit pembaca layar tidak dijalankan di recovery ini.

## 5. Lighthouse final (build yang sama dengan §4)

Pengukuran sekitar **02:52–02:55 WIB** setelah cleanup browser, tanpa suite berat paralel, origin
`http://127.0.0.1:3202`, build produksi lokal, data staging sungguhan, `noindex` aktif. Chrome/Chromium
headless 156.0.8078.4, Lighthouse 13.6.0, cache/storage browser direset setiap pengukuran. Tiga navigasi
dingin per kombinasi halaman/profil, berurutan. Profil mobile default (*simulated* slow 4G: RTT 150 ms,
1.638,4 kbps, CPU 4×, 412×823); `--preset=desktop` (RTT 40 ms, 10.240 kbps, CPU 1×, 1350×940).
Smoke produksi memastikan kedua respons 200, konten sebenarnya dan bukan fallback gangguan data.
Ini ukuran lab lokal, bukan data perangkat pengguna atau Vercel.

Median **[min–maks]** (tanpa kurung bila semua pengukuran identik), 12/12 proses sukses:

| URL | Profil | Performance | Accessibility | Best Practices | SEO | LCP (s) | CLS | TBT (ms) | FCP (s) | Speed Index (s) |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| `/` | Mobile | **74 [70–74]** | 100 | 100 | 63 | **0,98 [0,94–0,99]** | 0 | 1.562 [1.481–2.597] | 0,98 [0,94–0,99] | 2,70 [2,55–3,17] |
| `/produk/ikan-nila` | Mobile | **75 [74–87]** | 100 | 100 | 54 | **2,61 [2,59–2,61]** | 0 | 953 [416–1.118] | 0,92 [0,91–0,92] | 1,95 [1,88–2,02] |
| `/` | Desktop | 85 [80–87] | 100 | 100 | 63 | 0,27 [0,27–0,28] | 0 | 334 [314–440] | 0,27 [0,27–0,28] | 1,05 [1,00–1,09] |
| `/produk/ikan-nila` | Desktop | 99 [96–100] | 100 | 100 | 54 | 0,62 [0,62–0,63] | 0 | 85 [52–154] | 0,26 [0,26–0,26] | 0,72 [0,65–0,73] |

**NFR-18 [Saran], mobile Performance ≥90 dan LCP <2,5 s: belum tercapai.** LCP beranda memenuhi
target; Performance kedua halaman serta LCP detail belum memenuhi. Tidak ada ambang dokumen untuk
desktop/skor yang lain. Dibanding median sebelum optimasi (`.playwright/lh-recovery/`), LCP mobile
beranda **1,76 → 0,98 s**, detail **2,76 → 2,61 s**, dan CLS desktop detail **0,108 → 0**. Audit console
404 favicon hilang, dan permintaan Maps tidak terlihat pada jejak navigasi awal final beranda.
Sebaliknya, TBT median naik di beranda (mobile **990 → 1.562 ms**; desktop **21 → 334 ms**) dan
Performance desktop beranda turun **99 → 85**. Jangan menyebut optimasi sebagai kelulusan menyeluruh.
Jejak masih menunjukkan long task yang tidak teratribusi dan evaluasi bundle bersama Next/React;
satu run mobile beranda memberi peringatan kalibrasi CPU. Penyebab seluruh variasi TBT belum terisolasi.
SEO berkurang karena `noindex`/`robots.txt` yang disengaja, serta audit `meta-description` detail yang tidak
menangkap metadata dinamis saat audit; fungsi metadata tetap mengeluarkan deskripsi. Beberapa audit
`bf-cache` menandai keterbatasan navigasi/internal. Jangan menghapus proteksi cache/noindex demi skor.

JSON individual dan log: `.playwright/lh-final/`; launcher lokal diabaikan Git (`run-lighthouse.mjs`).
CLI dipanggil langsung dari paket npm `lighthouse@13.6.0` dengan `CHROME_PATH` menunjuk Chromium lokal,
`--chrome-flags=--headless --only-categories=performance,accessibility,best-practices,seo --output=json`
dan `--preset=desktop` hanya pada desktop. Tidak ada dependency Lighthouse baru pada repo.

## 6. Keamanan, cloud, dan cleanup

- Pemeriksaan final: security headers (termasuk CSP `frame-ancestors`, permissions, referrer), panel
  ber-sesi `private, no-store`, konteks tanpa cookie tidak mendapat panel, redirect internal, penolakan
  Origin asing, Markdown tanpa HTML aktif/tautan `javascript:`, `noindex, nofollow`, robots dan sitemap.
  Scanner suite tidak menemukan pola/nilai rahasia yang diperiksa dalam bundle klien `.next/static`;
  pencocokan di memori pada log build, Playwright, dan server Lighthouse juga tidak menemukan nilai
  kredensial yang diperiksa. Artefak sesi/trace tetap lokal dan tidak dilacak.
- `db:preflight` dan inspeksi read-only: URL, linked project dan Management API cocok; **ap-northeast-1**,
  11/11 migrasi tercatat, 0 pending, signup tetap nonaktif, `password_min_length=12` sudah berlaku.
  Tidak ada PATCH/reset pada recovery ini. Aturan min. 12 tidak menguji password akun lama.
  Kredensial sistem yang berbeda tidak dipakai; aplikasi saat audit dijalankan dengan konfigurasi proyek.
- **`test:db:cloud` belum dijalankan**: `SUPABASE_DB_URL` tidak tersedia pada konfigurasi proyek.
  Bukti sebelumnya: Data API 26/26 dan PGlite 145/145 pada source API/DB/migrasi yang tidak diubah
  dalam recovery; 46 pemeriksaan HTTP/Server Actions dari build lebih awal adalah bukti historis
  (browser final menguji ulang jalur yang relevan, bukan mengklaim ulang seluruh 46). Management API
  hanya dipakai untuk verifikasi target/kebijakan dan hasil cleanup, bukan pengganti suite SQL langsung.
- Run final mendaftarkan 22 nama fixture; tidak tersisa pada teardown, 0 paket perlu dihapus di teardown
  global. Nilai stok, harga, nama usaha, dan isi/judul artikel yang disentuh identik dengan baseline.
  `stock_price_confirmed_at` dan `updated_at` produk, artikel, pengaturan maju; timestamp tidak dimanipulasi.
  Pemeriksaan read-only pada staging sesudah run: 0 paket dan 0 produk fixture Data API (`uji-api-…`,
  `uji-paket-…`). Tidak ada penghapusan prefiks luas, perubahan allowlist, akun, atau riwayat migrasi.
- Server dan browser recovery dihentikan melalui pemilik proses masing-masing. Port 3201/3202 kosong
  setelah selesai, port 3200 tetap PID yang sudah ada di awal. Tidak ada listener pada 3000 saat awal/akhir.
- `git diff --check`, `npm run lint`, `npm run typecheck`, `npm test` (**358/358**) dan build produksi
  final lulus. Perubahan recovery: `playwright.config.ts`, spec/helper `tests/e2e/`, beranda/peta/header/footer,
  detail produk, CSS dan ikon, serta dokumentasi ini. Tidak ada tambahan dependency dibanding working tree
  saat recovery dimulai; pin Playwright/axe dan lockfile dari pekerjaan sebelumnya dipertahankan.

## 7. Sebelum fase 10

Tutup pengukuran TBT/latensi render yang masih terbuka dan ulangi Lighthouse dalam kondisi setara sampai
target NFR-18 tercapai, atau dokumentasikan persetujuan pemilik untuk menerima target saran yang belum
tercapai. Tinjau temuan axe `/kontak` dan hasil `incomplete` secara manual. Sediakan `SUPABASE_DB_URL`
staging yang cocok serta jalankan suite SQL langsung; generate tipe TS masih tercatat sebagai utang
integrasi. Sebelum Vercel, pastikan keputusan/persetujuan pemilik, akun dan region per lingkungan, URL
kanonik bukan localhost dan env eksplisit (tetap `noindex`), lalu rencanakan smoke T-15/T-22 di preview.
Tidak ada commit, push, PR, merge atau deployment dalam recovery ini.

---

## 8. Putaran lanjutan: target staging dan SQL

- Branch `feat/fondasi-aplikasi`, HEAD `173d9d6`, dua commit di depan tracking branch lokal; working tree
  sejak awal berisi integrasi dan perubahan fase 9 yang belum di-commit. Perubahan itu dipertahankan.
- Windows PowerShell 5.1, Node 26.13.0, npm 11.20.0. Nilai proyek dibaca privat dari `.env.local` melalui
  helper repo; environment sistem memiliki `SUPABASE_ACCESS_TOKEN` dan `SUPABASE_DB_PASSWORD` berbeda,
  keduanya tidak dipakai. Ref aplikasi HTTPS, `SUPABASE_PROJECT_REF`, linked project dan identitas Management
  API cocok; peruntukan lokal `staging`. GET read-only mengonfirmasi region `ap-northeast-1`, 11 migrasi
  tercatat / 0 pending, signup nonaktif, minimum password 12, dan produk terbit bisa dibaca via Data API.
- **`npm run test:db:cloud` belum dijalankan: 0 kasus dieksekusi; tidak ada hitungan runner passed/failed/skipped.**
  `SUPABASE_DB_URL` tersedia, tetapi `new URL()` gagal sebelum DNS/TLS/auth. Pemeriksaan struktur secara
  privat menunjukkan endpoint Supavisor sesi port 5432 dan username dengan ref yang cocok, tetapi ada
  delimiter URI mentah di bagian kredensial. Itu belum memverifikasi koneksi SQL. Pemilik perlu memasukkan
  URI **Session pooler** yang valid (encode komponen password saja; gunakan string dari Connect di Dashboard),
  lalu periksa ulang ref, endpoint, TLS terverifikasi, dan sesi. Jangan gunakan transaction pooler port 6543
  untuk suite ini. Tidak ada percobaan login SQL, transaksi SQL uji, atau fixture SQL cloud.
- Harness memakai satu `pg.Client`, TLS terverifikasi, `SET timezone`, `SET LOCAL ROLE`, savepoint,
  `ROLLBACK` di `finally` dan `close()` di `afterAll`. Dua probe `TRUNCATE` eksplisit kini PGlite-only;
  cloud tetap menguji grant efektif `TRUNCATE` via `has_table_privilege`. Probe DELETE dibatasi ke fixture
  ber-ID atau `WHERE false` (uji penolakan privilege, tanpa menghapus baris lama). Tidak ada migrasi,
  perubahan grants/schema/allowlist, atau reset. Management API bukan pengganti suite SQL.

## 9. Trace dan perubahan performa

JSON lama `lh-final` mencatat *long task* mobile beranda **1.148–1.823 ms** tanpa atribusi Lighthouse,
serta **378–603 ms** pada `/_next/static/chunks/0evrn330v-5x5.js`; detail **391–417 ms** pada chunk sama.
Parsing/kompilasi mobile sekitar 98–121 ms total, lebih kecil daripada evaluasi skrip (detail 643–669 ms;
beranda 619–891 ms). TTFB dokumen lokal 6–10 ms; itu bukan ukuran waktu data yang di-stream.

Trace mentah lama tidak tersedia. Trace diagnostik `lh-trace-before` merekam ulang build lama (chunk yang
sama); `lh-trace-after` memakai build baru. Waktu nyata trace, bukan angka simulasi Lighthouse:

| Bukti | Beranda sebelum → sesudah | Detail sebelum → sesudah |
|---|---:|---:|
| `RunTask` tanpa child yang terukur, wall vs thread CPU | **925/0,32 → 1.044/0,26 ms** | **93/0,28 → 119/0,29 ms** |
| Task evaluasi chunk bersama | 149 → 164 ms | 135 → 131 ms |
| `Layout` dalam task render terbesar | 122 → 131 ms | 67 → 85 ms |

Task tanpa atribusi hampir tidak menggunakan CPU thread renderer; data konsisten dengan stall/waktu tunggu
lingkungan, tetapi tidak mengidentifikasi penyebab di luar thread. Di chunk bersama, `EvaluateScript` dan
`RunMicrotasks` mendominasi task JS awal; callback minified `fq` hanya ~3 ms, bukan sumber long task
terbesar. Trace tidak memisahkan biaya tiap Client Component. Batas publik tetap kecil (menu HP dan observer
peta); tidak ada permintaan Maps/skrip pihak ketiga pada navigasi awal dua halaman yang diaudit. Tidak ada
fitur/script diblokir untuk pengukuran. Peta, peta tanpa JavaScript, dan tautan alternatif tetap diuji.

LCP detail adalah **paragraf penjelasan waktu stok/harga** (`ConfirmedAtNote`, `p.mt-2`), bukan gambar.
Sebelumnya produk → paket dibaca serial dan metadata juga memerlukan produk. Sekarang `loadPublishedCatalog`
memakai embed FK PostgREST terurut dalam satu baca anon; React `cache()` hanya mendeduplikasi metadata dan
render dalam satu permintaan. `connection()` dan RLS tetap berlaku; tidak ada cache baru lintas reload.
Jika embed gagal, baca produk saja untuk membedakan stok/harga valid dengan paket yang gagal, sedangkan
relasi tidak valid tidak disamakan dengan katalog kosong. Unit dan browser memeriksa alur tersebut sesuai
cakupan masing-masing. Harga paket bebas dan Hemat tidak diubah. Prefetch menu HP kini nonaktif seperti
header/footer; backdrop blur header dan caption diganti latar solid, sehingga konten bergerak/peta tidak
berada di balik teks header transparan. `.reveal` tetap tanpa opacity; reduced motion dipertahankan.

## 10. Aksesibilitas dan tipe

`landmark-unique` lama menargetkan `section` di `/kontak` setelah scroll; ringkasan arsip tidak menyimpan
pasangan landmark atau `relatedNodes`. Diagnostik sebelum patch menemukan satu region bernama “Peta” dari
H2-nya pada keadaan awal dan pascagulir, dan tidak mereproduksi pelanggaran. H2 sekarang “Peta alamat usaha”,
menamai region yang sama melalui `aria-labelledby`; judul iframe tetap mendeskripsikan peta dari alamat.
Regresi memeriksa satu region bernama tepat dan tidak ada `landmark-unique` sebelum dan setelah gulir.
Tidak ada aturan axe yang dimatikan.

Utang tipe konkret dari §19 langkah 4 dan §7 ARCHITECTURE: SDK tidak diparameterisasi oleh skema sehingga
nama kolom, fungsi, dan payload RPC tidak dikontrak TypeScript. Tipe skema `public` dihasilkan read-only
dari staging ke `src/types/database.ts` dan dipakai klien anon, klien server, proxy dan adapter action.
Nilai kg tervalidasi (maksimal dua desimal, dalam batas bisnis) dikirim sebagai JSON number sesuai kontrak
RPC; parser tampilan dan validasi Zod respons eksternal tetap dipakai. Baseline pemulihan E2E divalidasi
termasuk ketika dibaca dari disk, menggantikan cast terhadap bentuk data eksternal. Cast `as never` pada
adapter fixture diganti generic `Db.query<T>`. Tipe hasil generator bukan bukti otorisasi maupun validitas
runtime. Tidak ada dependency baru pada putaran ini.

**Peninjauan `incomplete`.** Arsip memuat 13 lokasi pemindaian, tetapi hanya menyimpan jumlah rule;
node lama tidak dapat dipulihkan persis. Pemindaian ulang 36 keadaan menyimpan rule, target, alasan dan
node terkait: **12 `incomplete`, semuanya `color-contrast`**. Diagnostik build lama juga mereproduksi
`imgNode` (header transparan di atas iframe kontak/profil; caption di atas SVG) dan `elmPartiallyObscured`
(header sticky di katalog). Header/caption solid menghilangkan ketidakpastian tersebut di rekap akhir.

| Kelompok akhir | Keputusan dan bukti manual |
|---|---|
| `bgGradient` — hero, awal, pascagulir, empat lebar; label lokasi, H1, isi dan teks tebal | Luminansi sRGB dihitung dari warna CSS terhadap titik paling gelap gradien secara konservatif: isi **5,50:1**, judul/teks tebal **13,19:1**, label lokasi **9,39:1**. Caption berlatar solid **11,61:1**. Memenuhi ambang yang relevan. |
| `bgOverlap` — menu HP terbuka | Screenshot 390 px menunjukkan hero tertutup panel opak sesuai rancangan; teks yang tersisa terlihat di bawahnya. Tab mencapai tautan pertama dengan fokus terlihat; Escape menutup menu dan fokus kembali ke tombol. Teks hero saat tidak ditutupi memenuhi rasio di atas. |
| `bgOverlap` — pascagulir beranda, katalog, detail, artikel, profil dan keadaan error panel | Pemeriksaan computed style + komposisi latar, pada node yang terlihat dan tanpa halangan header: CTA beranda/profil **10,88:1**, teks placeholder foto dan catatan waktu katalog **7,08:1 / 5,74:1**, heading paket **15,30:1**, label artikel dan panel error **5,02:1**, alamat profil **15,30:1**. Perbandingan ini menilai warna teks, bukan menjadikan `incomplete` lulus otomatis. |

Judul iframe, tautan alternatif, keyboard dan struktur aksesibilitas halaman diperiksa. Isi Maps lintas
domain, pembaca layar asli (termasuk bunyi pesan simpan), Safari dan perangkat fisik belum diverifikasi.
Tidak ada klaim sertifikasi WCAG. Laporan/screenshot tinjauan ada di `.playwright/phase9/` (diabaikan Git).

## 11. Bukti akhir pada build produksi lokal

**Regresi:** `git diff --check`, `npm run lint`, `npm run typecheck`, `npm test` **361/361**, dan build
produksi isolasi lulus. PGlite **145/145** diulang karena harness SQL bersama diubah. Data API **26/26**
adalah bukti historis, tidak diulang. Satu run lengkap Playwright Chromium **81 passed, 0 failed,
0 skipped, 0 flaky, 0 retry**, 6m30s, tanpa global error; **65** pemeriksaan responsif, **36** scan axe,
**0 critical / 0 serious / 0 moderate / 0 minor**, 12 incomplete ditinjau di §10. Alur stok/harga setelah
reload, paket bebas/Hemat, skeleton, gangguan, sesi/akses mitra, Markdown, redirect, security headers,
cache panel private/no-store dan noindex termasuk dalam cakupan run. JSON/HTML dan ledger baru di
`.playwright/phase9/`; build di `.playwright/build-phase9/` via `PASARNILA_E2E_ISOLATED=1` per proses.

**Lighthouse akhir:** 12/12 pengukuran dari build yang sama, sesudah browser dan cleanup; Lighthouse 13.6.0,
Chromium headless 156.0.8078.4, origin lokal 3202 dan staging yang sama, tiga navigasi dingin per kombinasi,
tanpa suite berat paralel. Profil simulasi sama dengan baseline §5; smoke kedua halaman 200 dengan konten
sesungguhnya/noindex dan tanpa fallback gangguan. Setiap run mobile memunculkan peringatan kalibrasi CPU
(baseline: satu run). Versi dan setelan sama, kondisi host tidak cukup stabil untuk mengatribusikan delta
ke perubahan source saja. Semua run dipertahankan, tidak dipilih hasil terbaik. `lh-phase9-final/` memuat
JSON, log, trace dan devtools log. Median **[min–maks]**:

| Halaman/profil | Performance sebelum → akhir | LCP (s) sebelum → akhir | TBT (ms) sebelum → akhir | CLS | A11y / BP / SEO (keduanya) |
|---|---:|---:|---:|---:|---:|
| Beranda mobile | 74 [70–74] → **66 [66–67]** | 0,98 [0,94–0,99] → **0,94 [0,92–1,20]** | 1.562 [1.481–2.597] → **6.049 [5.998–7.013]** | 0 → 0 | 100 / 100 / 63 |
| Detail mobile | 75 [74–87] → **68 [66–72]** | 2,61 [2,59–2,61] → **2,92 [0,92–2,96]** | 953 [416–1.118] → **1.975 [1.692–2.231]** | 0 → 0 | 100 / 100 / 54 |
| Beranda desktop | 85 [80–87] → **67 [66–67]** | 0,27 [0,27–0,28] → **0,31 [0,31–0,34]** | 334 [314–440] → **1.475 [1.422–1.611]** | 0 → 0 | 100 / 100 / 63 |
| Detail desktop | 99 [96–100] → **89 [81–93]** | 0,62 [0,62–0,63] → **0,69 [0,66–0,74]** | 85 [52–154] → **270 [209–410]** | 0 → 0 | 100 / 100 / 54 |

Final FCP / Speed Index (s): beranda mobile **0,94 [0,92–1,20] / 5,20 [4,77–5,24]**, detail mobile
**0,92 [0,92–0,92] / 2,00 [1,84–2,24]**, beranda desktop **0,31 [0,31–0,34] / 1,92 [1,88–2,02]**,
detail desktop **0,27 [0,27–0,28] / 0,73 [0,67–0,82]**.

**NFR-18 belum terpenuhi.** Satu round-trip serial dihilangkan, tetapi manfaat LCP detail pada trace
diagnostik (~1,00 s) tidak konsisten dalam run akhir. Di ketiga trace mobile akhir task terbesar beranda
berdurasi wall-clock **1,28–1,50 s** dengan thread CPU **0,26–1,24 ms**; detail **216–317 ms** dengan
thread CPU **0,32–0,54 ms**. Biaya JS/render nyata juga masih ada. Langkah berikutnya: A/B kedua build pada
host yang lolos kalibrasi (ulang tiga kali per kombinasi), ukur waktu respons stream data, lalu profilkan
startup chunk Next/React dengan sampling CPU bila TBT tetap tinggi. Tidak ada pengurangan target atau
persetujuan pengecualian dari pemilik. `noindex` sengaja menurunkan skor SEO; audit deskripsi detail
tidak menangkap metadata dinamis. Indexing tetap ditutup.

## 12. Cleanup, file, dan keputusan fase

- Ledger browser: 22 nama fixture terdaftar, semua bersih, tidak perlu penghapusan tambahan di teardown
  global. Baca ulang Data API mengonfirmasi paket produk terbit **0**, nilai stok/harga, isi/judul dan
  nama usaha identik baseline. Timestamp berubah dengan operasi aplikasi biasa, dalam UTC:
  - Produk `stock_price_confirmed_at` dan `updated_at`: `2026-11-18 19:48:47.567133` → `2026-11-19 01:50:34.762749`.
  - Artikel `updated_at`: `2026-11-18 19:48:52.748834` → `2026-11-19 01:50:39.562268`.
  - Pengaturan `updated_at`: `2026-11-18 19:48:58.003401` → `2026-11-19 01:50:44.601897`.
- Teardown menutup sesi lewat mekanisme suite, logout diuji, proses/browser milik putaran dihentikan.
  Port 3201–3203 bebas setelah uji; tidak ditemukan listener 3000/3200 pada awal/akhir dan port itu tidak dipakai.
  Tidak mengirim pesan WhatsApp, mengubah `.env.local`, atau menampilkan rahasia. Artefak lokal tidak dilacak.
- File: halaman kontak dan detail; `site-header`, `mobile-nav`, `hero-visual`; pembaca `products`/`packages`;
  `src/types/database.ts` dan klien Supabase, proxy, gate/adapter Server Action; harness SQL/fixture;
  konfigurasi Next/ESLint/TS/Playwright, dukungan dan regresi E2E/unit, serta laporan/README/ARCHITECTURE.
  Tidak ada perubahan dependensi baru relatif ke working tree saat mulai.

| Kriteria | Status putaran ini |
|---|---|
| AC-42 / NFR-01–02 / T-18 | **Terpenuhi pada Chromium** di 360/390/768/1280/1440 px, termasuk tombol dan `inputMode`; papan ketik fisik belum diverifikasi. |
| AC-43 / NFR-15–17 / T-19 | **Batas severity, landmark dan lintasan keyboard teruji terpenuhi.** `aria-live`/pesan simpan teruji secara struktural; pembaca layar dan aksesibilitas isi iframe **belum terverifikasi**. |
| Security headers, sesi/cache panel, AC-44, kebijakan signup & password staging | **Terpenuhi** dalam build lokal dan pemeriksaan read-only staging. HTTPS/CDN pada deployment **belum terverifikasi**. |
| SQL langsung staging/T-07 DB cloud | **Belum terverifikasi**; URI tidak valid. |
| Generate dan gunakan tipe TS skema publik | **Terpenuhi**; validasi runtime dipertahankan. |
| NFR-18 [Saran] | **Belum terpenuhi**; LCP beranda saja memenuhi ambang mobile. |

Sebelum fase 10: perbaiki URI dan jalankan SQL cloud hingga ada hasil terstruktur; selesaikan verifikasi
aksesibilitas perangkat/pembaca layar yang tersisa; stabilkan pengukuran dan penuhi NFR-18 atau catat keputusan
eksplisit pemilik. Konfirmasi akun/region, biaya, URL kanonik bukan localhost, env eksplisit dan preview smoke
T-15/T-22 dengan noindex. Tidak ada commit, push, PR, deployment, atau pekerjaan fase 10.

## 13. Penutupan: URI staging dan konektivitas SQL

`SUPABASE_DB_URL` di `.env.local` kini dapat diparse. Komponen username/ref, host pooler dan nama database
dicocokkan secara privat dengan konfigurasi proyek dari Management API (GET), URL aplikasi, dan linked
project. Endpoint asli tetap **Supavisor Session pooler port 5432**. Batas kredensial ditentukan dari
prefiks username dan sufiks endpoint lengkap yang unik dan terverifikasi, bukan dengan membelah pada `@`
mentah. Nilai asli utuh saat dibaca dari dotenv dan tidak memiliki escape persen yang ambigu. Hanya
komponen password yang di-encode, sekali; hasil decode identik dengan kredensial yang semula tersimpan.
Semua variabel lain tetap sama. Password tidak diubah di server; kredensial sistem yang berbeda tidak dipakai.

| Tahap | Hasil |
|---|---|
| Validasi URI dan identitas | Lulus; guard repo menerima URI, ref aplikasi/linked/Management API cocok dan `SUPABASE_TARGET_ENV=staging`. |
| DNS | Lulus; host pooler terurai ke 3 alamat IPv4. |
| TCP ke port 5432 | Probe timeout; `pg` di runner juga melaporkan `ETIMEDOUT` saat koneksi. Sumber penghambat jaringan belum ditentukan. |
| TLS dan autentikasi | Tidak tercapai. Verifikasi TLS pada harness tetap aktif; belum ada bukti password diterima server. |
| `npm run test:db:cloud` | Runner gagal pada `beforeAll`, sebelum kueri prasyarat atau assertion: **69 terdaftar; 0 dijalankan, 0 passed, 0 failed assertion, 69 skipped oleh runner**. `success: false` pada laporan JSON. |

Probe dan runner tidak mencapai transaksi atau penulisan SQL, sehingga tidak ada fixture yang perlu
dibersihkan. Harness dan rollback sudah diperiksa; test, schema, riwayat migrasi, RLS, dan grants tidak
diubah. Bukti JSON runner disimpan lokal di `.playwright/phase9-sql-connectivity.json`. Langkah berikutnya:
jalankan dari host/jaringan yang dapat mencapai **endpoint Session pooler yang sama** pada TCP 5432;
verifikasi TLS, autentikasi, database, dan perilaku sesi dengan probe read-only, lalu ulangi
`npm run test:db:cloud` dan periksa hasil assertion. Tidak perlu mengubah URI hanya karena TCP timeout.

## 14. Penutupan: kelayakan pengukuran Lighthouse

Satu diagnostik beranda mobile memakai build produksi isolasi yang sama dengan §11 (`BUILD_ID`
`anZnCmNVYIAizAJkcduKU`; input aplikasi, konfigurasi Next, dan lockfile tidak lebih baru dari build).
Smoke beranda serta detail produk 200, konten sesuai, tanpa fallback gagal muat, dan `noindex` aktif.
Lighthouse **13.6.0**, Chromium headless **156.0.8078.4**, *simulated* slow 4G **150 ms / 1.638,4 kbps**,
CPU **4×**, profil mobile default. Browser suite dan runner SQL tidak berjalan bersamaan dengan audit.
Host Windows 11, Ryzen 7 5700U, 16 prosesor logis, profil daya Balanced; proses Chrome biasa masih ada
dan tiga sampel CPU sebelum diagnostik sekitar 15–20%. Sampel global belum mengukur penjadwalan thread.

| Bukti kalibrasi | `benchmarkIndex` |
|---|---:|
| Baseline mobile §5 (6 run) | 977,5–1.088 |
| Putaran akhir mobile §11 (6 run) | 575,5–648 |
| Diagnostik baru (1 run) | **701,5** |

Peringatan aktual: “The tested device appears to have a slower CPU than Lighthouse expects. This can
negatively affect your performance score.” Implementasi CLI 13.6.0 mengeluarkan peringatan itu pada
profil dengan multiplier default bila `benchmarkIndex` **≤ 1.000**; desktop 1× tidak memenuhi syarat
untuk pesan ini, jadi absennya warning di desktop lama tidak membuktikan host stabil.

Diagnostik selesai tanpa runtime error: **Performance 67, LCP 1,13 s, TBT 4.984,5 ms, CLS 0**. Angka ini
diagnostik, bukan pengganti median atau bukti penerimaan. Trace memuat task **1.097 ms wall / 0,37 ms
thread CPU** tanpa atribusi, sekaligus `Layout` ~123 ms dan task evaluasi JS ~163 ms dengan ~158 ms
CPU thread. Sebagian waktu tunggu tidak terjelaskan; biaya JS/layout juga nyata. Artefak di
`.playwright/lh-phase9-host-check/`. Tidak ada source aplikasi yang diubah dalam putaran ini.

Audit penuh tidak diulang di host ini. Multiplier **tetap 4×**. [Panduan Lighthouse 13.6.0](https://github.com/GoogleChrome/lighthouse/blob/v13.6.0/docs/throttling.md#calibrating-the-cpu-slowdown)
memungkinkan kalibrasi terhadap kelas perangkat yang dituju, tetapi angka benchmark yang rendah dan
bervariasi serta stall yang terlihat tidak cukup untuk menyimpulkan bahwa penggantian multiplier
akan memperbaiki validitas. Tidak ada klaim A/B antara build lama dan baru. **NFR-18 [Saran]: belum
terbukti terpenuhi**; bukti performa yang memadai untuk penutupan tertahan oleh lingkungan.

## 15. Reproduksi pada host pembanding

1. Gunakan snapshot working tree yang sama (HEAD `173d9d6` saja belum mencakup perubahan lokal), Node
   26.13.0, `npm ci`, dan Chromium dari Playwright yang dipin (`npx playwright install chromium`).
   Isi konfigurasi staging secara lokal, pastikan `ALLOW_INDEXING=false`, dan pastikan nilai app dari
   environment shell tidak menimpa konfigurasi staging. Jangan memindahkan rahasia bersama snapshot kode.
2. Di terminal server, pastikan port **3202** kosong. Set `$env:PASARNILA_E2E_ISOLATED='1'` untuk proses
   lokal, jalankan `npm run build` lalu `npm run start -- -p 3202 -H 127.0.0.1`. Smoke `/` dan
   `/produk/ikan-nila`: periksa status 200, konten sesungguhnya, `noindex`, serta tidak ada fallback data.
   Simpan ID build dan identitas snapshot.
3. Pada host yang idle dan tanpa suite paralel, jalankan satu diagnostik dari terminal kedua. Jangan
   lanjut ke matriks bila muncul warning/masalah kalibrasi, respons keliru, atau stall berat yang
   membuat perbandingan tidak dapat dipercaya. Jika host dan profil memadai, gunakan perintah berikut
   di PowerShell; direktori diagnostik dan matriks terpisah agar hasil tidak tercampur:

   ```powershell
   $env:CHROME_PATH = node -p "require('playwright').chromium.executablePath()"
   $base = 'http://127.0.0.1:3202'
   $diag = '.playwright/lh-host-diagnostic'
   $out = '.playwright/lh-host-matrix'
   New-Item -ItemType Directory -Force -Path $diag, $out | Out-Null
   $common = @('--throttling-method=simulate', '--chrome-flags=--headless', '--save-assets', '--output=json',
                '--only-categories=performance,accessibility,best-practices,seo')
   npx --yes --package=lighthouse@13.6.0 lighthouse "$base/" @common "--output-path=$diag/home-mobile.json"
   # Periksa environment.benchmarkIndex, runWarnings, runtimeError, trace, dan respons sebelum lanjut.
   # Jalankan blok berikut hanya setelah diagnostik memadai:
   $routes = [ordered]@{ home = '/'; detail = '/produk/ikan-nila' }
   foreach ($run in 1..3) {
     foreach ($route in $routes.Keys) {
       foreach ($profile in 'mobile', 'desktop') {
         $preset = @()
         if ($profile -eq 'desktop') { $preset = @('--preset=desktop') }
         npx --yes --package=lighthouse@13.6.0 lighthouse "$base$($routes[$route])" @preset @common "--output-path=$out/$route-$profile-$run.json"
         if ($LASTEXITCODE -ne 0) { throw "Audit gagal: $route/$profile/$run" }
       }
     }
   }
   ```

4. Catat nilai median dan rentang Performance/LCP/TBT/CLS, seluruh warning, benchmark, versi dan setelan
   efektif dari JSON untuk 12 run. Jika kalibrasi digunakan, catat justifikasi perangkat sasaran dan
   perlakukan konfigurasi baru sebagai seri terpisah. Jika TBT tetap tinggi pada host yang memadai,
   periksa profil CPU untuk startup JS/layout; untuk LCP detail, pisahkan waktu stream data dan render.
   Pertahankan target mobile **≥90 dan LCP <2,5 s**. Hentikan hanya server lokal yang dimulai untuk audit.

**Git dan cleanup putaran ini:** `feat/fondasi-aplikasi` / `173d9d6`, masih dua commit di depan tracking
branch lokal; perubahan kerja lama dipertahankan. Putaran ini hanya mengubah format satu nilai lokal
yang diabaikan Git, dokumentasi, dan artefak pemeriksaan lokal. Tidak ada perubahan source atau dependency,
sehingga regresi aplikasi tidak diulang. Proses uji dihentikan, port 3202 kembali bebas, port 3000/3200
tidak disentuh. Tidak ada commit, push, PR, deploy, atau pekerjaan fase 10.

---

## 16. Ronde serah terima (Claude Code): keadaan yang ditemukan

Tanggal 19 November 2026. Instruksi ronde ini membatasi lingkup pada penyelesaian fase 9 dan melarang commit,
push, PR, deployment, akses/konfigurasi Vercel, serta fase 10; instruksi itu menggantikan izin sebelumnya.

- **Lingkungan:** Windows 11 native (10.0.26200), Windows PowerShell 5.1 dan Git Bash, Node 26.13.0, npm 11.20.0,
  proyek di folder OneDrive pengguna. Tidak ada bukti perubahan host atau jaringan dibanding §8/§14 (laptop
  yang sama, satu adapter Wi-Fi). Perpindahan dari Codex ke Claude Code tidak dianggap sebagai perubahan host.
- **Hook:** tidak ada kegagalan hook pada sesi ini; kedua shell berjalan. `rtk` terpasang di `~/.local/bin` dan
  menulis ulang sebagian perintah. Satu pemanggilan `grep` menghasilkan teks bantuan RTK alih-alih hasil; keluaran
  itu **tidak** dipakai sebagai bukti dan pemeriksaannya diulang lewat Node. Tidak ada konfigurasi global yang diubah.
- **Repository:** `feat/fondasi-aplikasi`, HEAD `173d9d6`, `git status --short` berisi 57 entri (47 file berubah,
  sisanya tak terlacak: `docs/`, `tests/e2e/`, `src/types/`, dll.), sama dengan awal ronde; seluruh perubahan lokal
  dipertahankan. Cabang lokal dua commit di depan tracking `origin`, tanpa tambahan dari ronde ini.
- **Tidak ada jejak deployment:** tidak ada `.vercel/`, reflog hanya berisi commit lokal (`173d9d6` terakhir),
  tidak ada listener pada 3000/3200–3203 di awal maupun akhir ronde.
- **Source aplikasi tidak diubah.** Build terisolasi `anZnCmNVYIAizAJkcduKU` (dibuat 01:46 UTC) lebih baru dari semua
  file `src/` (terbaru 01:43 UTC), jadi hasil §11 berlaku untuk source saat ini. `tsconfig.json` lebih baru 2 menit
  dari build karena Next menambahkan `include` untuk tipe build terisolasi
  (`.playwright/build-phase9/types/**`); itu efek samping build, bukan perubahan aplikasi. Tinjau sebelum commit.
  Karena tidak ada perubahan aplikasi, lint/typecheck/unit/browser/PGlite **tidak diulang**; hasil §11
  (361/361 unit, 145/145 PGlite, 81/81 browser, 65 responsif, 36 axe) tetap berlaku untuk build itu saja.

## 17. SQL cloud: tahap yang berhasil dan gagal

Semua pemeriksaan privat; tidak ada URI, username, atau password yang dicetak. `.env.local` tidak diubah.

| Tahap | Hasil |
|---|---|
| Penjaga target (`resolveCloudTarget`) | Lulus: `SUPABASE_TARGET_ENV=staging`, ref cocok, `SUPABASE_DB_URL` tersedia dan cocok dengan ref. |
| Parsing URI | Lulus: protokol `postgresql:`, port 5432, host Supavisor Session pooler. |
| DNS | Lulus: 3 alamat IPv4. |
| TCP 5432 ke pooler | **Timeout 8 detik pada ketiga alamat** (satu putaran, bukan loop). |
| Kontrol: TCP 443 ke API proyek yang sama | Tersambung dalam 99 ms. Internet umum berfungsi; hanya jalur ke port 5432 pooler yang tidak terjangkau. |
| Konteks jaringan | Satu adapter Wi-Fi aktif; klien VPN (OpenVPN Connect, ProtonVPN) terpasang tetapi tidak ada adapter tunnel aktif. |
| TLS, autentikasi, assertion | **Tidak tercapai.** TLS terverifikasi tetap aktif di harness; belum ada bukti password diterima server. |
| `npm run test:db:cloud` | **Tidak dijalankan ulang**: prasyarat TCP gagal, hasilnya pasti 69 *skipped* lagi (lihat §13). 0 assertion SQL cloud berjalan. |

Status: **terhalang koneksi jaringan** (firewall/router/ISP di jalur ini; penyebab persisnya tidak diketahui).
Tidak ada perubahan skema, grants, RLS, migrasi, firewall, port, atau TLS. PGlite, Data API, dan Management API
**bukan** pengganti kelulusan suite SQL langsung.

## 18. Analisis performa dari bukti yang ada

**Keputusan: tidak ada perubahan source.** Tidak ada temuan yang menunjuk perbaikan aplikasi dengan manfaat
terukur, dan stall dominan terbukti bergantung pada kondisi host/rendering. Refactor tanpa bukti tidak dilakukan.

### 18.1 Stall main-thread tanpa CPU

Pada setiap trace beranda mobile ada satu `RunTask` main-thread panjang **tanpa child event dan dengan CPU thread
≈ 0**, mulai pada offset hampir sama (~1,05 s setelah navigasi), tepat sebelum paint pertama. Sebelum stall, semua
CSS/JS sudah selesai diunduh (~200 ms) dan `load` sudah terjadi (~0,5–0,7 s).

| Trace | Mulai | Wall | CPU thread | `GPUTask` terpanjang di proses GPU | FCP teramati di trace |
|---|---:|---:|---:|---:|---:|
| Beranda mobile, 3 run akhir (§11) | 1.047 / 1.138 / 1.049 ms | 1.505 / 1.276 / 1.285 ms | 0,3 / 0,3 / 1,2 ms | 1.136 ms (run 1) | 2,33–2,54 s |
| Beranda mobile, diagnostik §14 | 1.045 ms | 1.097 ms | 0,4 ms | — | 2,14 s |
| Beranda mobile, GPU-aktif (§18.3) | 1.047 ms | 907 ms | 0,7 ms | 945 ms | 1,95 s |
| Detail mobile, run akhir | 1.146 ms | 317 ms | — | 356 ms | — |
| Detail mobile, GPU-aktif | 1.122 ms | 119 ms | 0,3 ms | 330 ms | 0,81 s |
| **Kontrol: halaman statis tanpa JS** | 1.117 ms | 169 ms | 0,2 ms | 437 ms | 0,78 s |

Selama stall, thread renderer/GPU/browser lain aktif dan compositor menjatuhkan frame (beranda: 21–97
`DroppedFrame`; detail dan kontrol: 0). Stall berakhir tepat saat paint pertama. Permulaan yang konstan di
~1,05–1,15 s pada semua halaman (termasuk kontrol) menunjukkan pemicu yang terkait harness pengukuran, sedangkan
besarnya berbeda per halaman. Ini konsisten dengan kerja render/komposit di luar thread utama yang memblokir
frame, tetapi **penyebab persisnya belum terisolasi**. Perkiraan bahwa TBT 4–6 s pada Lighthouse (simulasi
CPU 4×) terutama berasal dari task ±1,3 s ini bersifat **inferensi**, bukan hasil pembacaan kode Lighthouse.

### 18.2 Kontrol: halaman minimal tanpa aplikasi

Satu run Lighthouse 13.6.0, Chromium 156.0.0.0, profil mobile default (*simulated* 150 ms / 1.638,4 kbps, CPU 4×),
pada halaman HTML statis (±170 elemen teks/daftar, tanpa JavaScript, tanpa aplikasi) di port 3290:
**Performance 80, FCP/LCP 0,6 s, TBT 870 ms, `benchmarkIndex` 612,5, dengan peringatan CPU lambat yang sama.**
Artinya host ini tidak dapat memperlihatkan Performance ≥ 90 bahkan untuk halaman yang hampir kosong, sehingga
tidak memadai untuk membuktikan NFR-18. Layout pertama halaman kontrol memakan 61 ms, jadi sebagian biaya Layout
pertama aplikasi (127–143 ms untuk 274 objek) adalah biaya satu kali di host; selisih ±65–80 ms adalah batas atas
kontribusi aplikasi, bukan atribusi pasti.

### 18.3 Diagnostik GPU-aktif (seri terpisah, n = 1 per halaman)

`SystemInfo.getInfo` pada Chromium Playwright 156.0.8078.4 menunjukkan konfigurasi default Lighthouse headless
merender dengan **SwiftShader** (`gpu_compositing` dan `rasterization`: `disabled_software`), padahal mesin
punya GPU AMD Radeon. Dengan `--enable-gpu --ignore-gpu-blocklist`, keduanya `enabled`. Perubahan ini
mempertahankan profil simulasi dan CPU 4× (bukan pemilihan multiplier) dan dijalankan pada build yang sama
(`anZnCmNVYIAizAJkcduKU`), 200 + konten nyata + `noindex`, satu run per halaman, serial:

| Halaman (mobile) | Performance | LCP | TBT | Speed Index | `benchmarkIndex` | Peringatan |
|---|---:|---:|---:|---:|---:|---|
| Beranda | 68 | 1,1 s | 4.110 ms | 3,9 s | 688,5 | CPU lambat |
| Detail produk | 76 | 0,9 s | 1.240 ms | 1,7 s | 695 | CPU lambat |

Ini **bukan** pengganti median §11 dan tidak dibandingkan langsung dengannya (konfigurasi berbeda, n = 1).
Pengamatan: stall beranda mengecil (1.097–1.505 → 907 ms) tetapi tidak hilang, benchmark tetap ~690 dengan
peringatan yang sama. Pengulangan tiga kali **tidak** dilakukan karena host belum memenuhi syarat kalibrasi.

### 18.4 Kondisi host

Laptop berjalan **dengan baterai** (status *discharging*, 57%), paket daya **Balanced**, CPU 1.440 dari 1.801 MHz
saat dicek, dengan beban latar (Chrome, WebView2, proses lain). `benchmarkIndex` turun dari 977–1.088 (baseline §5)
ke 575–700 pada semua pengukuran berikutnya; median TBT beranda naik dari 1.562 ke 6.049 ms dalam rentang yang
sama. Korelasi ini kuat tetapi **tidak membuktikan sebab**. Paket daya tidak diubah (di luar lingkup).

### 18.5 Pemisahan temuan

| Kategori | Isi |
|---|---|
| **Biaya aplikasi yang terlihat** | Evaluasi chunk bersama `0evrn330v-5x5.js` (±224 KB; runtime React/Next) 140–244 ms pada beranda, 130–159 ms pada detail; Layout pertama 127–143 ms (beranda) dan 79–83 ms (detail); jumlah task >50 ms bercatatan CPU 306–448 ms. Bundel klien halaman publik hanya runtime React/Next; tidak ada Supabase, zod, atau Markdown di chunk yang dimuat beranda (Markdown hanya di chunk panel). Komponen Client publik hanya `mobile-nav` dan `viewport-map`; font hanya `system-ui` (tanpa permintaan font); `.reveal` dipakai di 5 seksi. Tidak ada temuan yang dapat dikurangi tanpa refactor luas. |
| **Waktu tunggu penyebab belum diketahui** | Stall ~0,9–1,5 s beranda: berkorelasi dengan `GPUTask` panjang dan frame yang dijatuhkan, ukurannya bergantung halaman (beranda ≫ detail ≈ kontrol), sehingga kompleksitas paint beranda mungkin ikut berkontribusi. Belum dapat dipisahkan dari rendering perangkat lunak di host ini. |
| **Pengaruh host** | Terbukti: halaman statis kosong hanya mendapat 80; benchmark CPU 575–700 (peringatan Lighthouse pada setiap run mobile); baterai + Balanced; rendering default SwiftShader. |

Penetapan: **NFR-18 [Saran] belum terverifikasi terpenuhi.** Target tidak diturunkan dan tidak ada pengecualian
dari pemilik. LCP beranda (≈0,9–1,1 s dalam simulasi) memenuhi ambang; Performance mobile belum terbukti ≥ 90.
LCP detail 2,92 s pada §11 belum dapat dipastikan sebagai biaya aplikasi atau host (diagnostik GPU-aktif 0,9 s, n = 1).

## 19. Tabel kriteria, pekerjaan selesai, dan langkah berikutnya

| Kriteria | Status | Bukti | Tindakan berikutnya |
|---|---|---|---|
| AC-42 / NFR-01–02 / T-18 (responsif, tombol ≥ 44 px, `inputMode`) | **Terpenuhi** (Chromium, 360/390/768/1280/1440) | §4, §11: 65 pemeriksaan responsif; smoke Pixel 7/iPhone 13 emulasi | Uji papan ketik fisik dan Safari asli (perangkat). |
| AC-43 / NFR-15–17 / T-19 (axe, keyboard, label, fokus, `aria-live`) | **Terpenuhi** untuk batas severity dan lintasan teruji | §10–§11: 36 scan, 0 critical/serious/moderate/minor; 12 `incomplete` ditinjau | Pembaca layar asli dan isi iframe Maps **belum terverifikasi**. |
| Security headers, cache panel `private, no-store`, noindex, sesi/allowlist, signup nonaktif, password ≥ 12 | **Terpenuhi** (build lokal, staging read-only) | §6, §11 | Verifikasi HTTPS/CDN pada deployment (fase 10, di luar lingkup). |
| Tipe TS skema publik dipakai aplikasi | **Terpenuhi** | §10 | Regenerasi bila skema berubah. |
| Fungsi: peta, `.reveal` tanpa opacity, reduced motion, harga paket bebas + Hemat, stok/harga setelah reload | **Terpenuhi** | §4, §11 | — |
| SQL langsung staging / T-07 DB cloud | **Belum terverifikasi: terhalang jaringan** | §13, §17: TCP 5432 timeout; 0 assertion berjalan | Jalankan dari host yang menjangkau pooler (§19.2). |
| NFR-18 [Saran]: Performance mobile ≥ 90 dan LCP < 2,5 s | **Belum terverifikasi terpenuhi** | §11, §14, §18: host tidak memadai; kontrol statis 80 | Benchmark di host memadai (§19.3). |
| Verifikasi perangkat fisik, Safari, pembaca layar, UAT | **Belum dilakukan** | Di luar kemampuan lingkungan ini | Jadwalkan sebelum rilis. |

**Pekerjaan aplikasi yang selesai (dari §3, §9–§11):** perbaikan kontras `.reveal`, struktur `<dl>`, landmark `/kontak`,
target sentuh, peta dimuat saat terlihat, prefetch latar dimatikan, baca katalog+paket dalam satu query terurut,
tipe skema, serta suite Playwright/axe/responsif. **Terhalang lingkungan:** SQL cloud dan validasi NFR-18.
Ronde ini tidak menambah perubahan source.

### 19.1 Versi alat dan konfigurasi

Node 26.13.0, npm 11.20.0, `@playwright/test` dan `playwright-core` 1.64.1, `@axe-core/playwright` 4.14.0, Chromium
156.0.8078.4, Lighthouse 13.6.0 (via `npx --package=lighthouse@13.6.0`, tidak ada di lockfile), Windows 11, Ryzen 7
5700U. Profil mobile default: *simulated* RTT 150 ms, 1.638,4 kbps, CPU 4×; desktop `--preset=desktop`.

### 19.2 Menjalankan SQL cloud dari host yang menjangkau pooler

1. Gunakan **salinan working tree** (bukan clone `173d9d6` saja), `npm ci`, dan `.env.local` staging yang diisi
   secara lokal (`SUPABASE_TARGET_ENV=staging`, `SUPABASE_PROJECT_REF` cocok dengan URL, `SUPABASE_DB_URL` =
   Session pooler port 5432 dengan hanya komponen password yang di-percent-encode). Jangan kirim rahasia bersama kode.
2. Periksa jangkauan TCP tanpa mencetak kredensial (PowerShell; ambil host dan port saja):
   ```powershell
   $raw = (Select-String -Path .env.local -Pattern '^SUPABASE_DB_URL=(.*)$').Matches[0].Groups[1].Value.Trim('"')
   $u = [uri]$raw
   Test-NetConnection -ComputerName $u.Host -Port $u.Port | Select-Object TcpTestSucceeded
   ```
   Lanjut hanya bila `TcpTestSucceeded` bernilai `True`. Jika `False`, masalahnya masih jaringan (coba jaringan lain,
   tanpa VPN, atau hotspot); jangan mengubah URI atau port.
3. `npm run db:preflight`, lalu `npm run test:db:cloud` (satu `pg.Client`, TLS terverifikasi, tiap kasus di
   `ROLLBACK`; harness tidak mengubah allowlist, skema, atau grants).
4. **Hasil valid:** ringkasan Vitest memperlihatkan seluruh kasus terdaftar (69) berjalan dengan 0 gagal dan 0
   *skipped*. Hasil yang hanya berisi *skipped*, atau gagal pada `beforeAll`, **bukan** kelulusan. Bedakan kegagalan
   parsing URI, DNS, TCP (`ETIMEDOUT`), TLS, autentikasi (`28P01`), dan assertion.

### 19.3 Benchmark NFR-18 dengan kondisi memadai

1. Gunakan snapshot working tree yang sama, `npm ci`, dan `npx playwright install chromium`. Colokkan daya AC, pilih
   paket daya **High performance**/Best performance, tutup browser lain dan aplikasi berat; jangan jalankan suite lain
   bersamaan. Pastikan `ALLOW_INDEXING=false` dan port 3202 kosong.
2. Build dan jalankan sesuai §15 langkah 2 (`PASARNILA_E2E_ISOLATED=1`, `npm run build`, `npm run start -- -p 3202 -H 127.0.0.1`).
   Smoke `/` dan `/produk/ikan-nila`: 200, konten nyata, `noindex`, tanpa pesan gangguan data.
3. Jalankan **satu** diagnostik (§15 langkah 3). **Syarat valid sebelum melanjutkan ke matriks:** `runtimeError` kosong,
   tidak ada `runWarnings` kalibrasi CPU, `environment.benchmarkIndex` di atas ±1.000 (peringatan dikeluarkan pada ≤ 1.000),
   tidak ada task main-thread ≥ 500 ms berCPU ≈ 0 pada trace (heuristik ronde ini, bukan ambang resmi Lighthouse),
   dan respons benar. Bila tidak, hentikan dan perbaiki host.
4. Catat jalur render: `SystemInfo.getInfo` lewat CDP memperlihatkan `gpu_compositing`/`rasterization`. Konfigurasi default
   adalah seri utama; hasil dengan `--enable-gpu --ignore-gpu-blocklist` adalah **seri terpisah** yang harus diberi
   label dan tidak dicampur. Jangan memilih multiplier CPU atau flag hanya untuk menaikkan skor; bila kalibrasi
   dipakai, ikuti panduan Lighthouse 13.6.0, tulis alasan perangkat sasarannya, dan perlakukan sebagai seri baru.
5. Matriks: tiga navigasi dingin per kombinasi (beranda/detail × mobile/desktop), serial; laporkan median dan rentang
   Performance/LCP/TBT/CLS beserta seluruh peringatan. Target tetap mobile ≥ 90 dan LCP < 2,5 s. Bila TBT tinggi pada
   host valid, profil CPU startup JS/layout dan pisahkan waktu data stream dari render.
6. Hasil dari host ini (baterai, Balanced, ±600–700 benchmark, SwiftShader) tidak boleh dipakai sebagai bukti lulus
   maupun gagal NFR-18 yang final.

### 19.4 Cleanup ronde ini

Server milik ronde (3202, build terisolasi) dan server kontrol statis (3290) dihentikan; tidak ada listener tersisa,
port 3000/3200 tidak disentuh. Tidak ada tulis ke staging (hanya pembacaan anon oleh halaman yang diaudit), tidak
ada fixture yang perlu dibersihkan, `.env.local` tidak diubah, tidak ada dependency baru. Artefak lokal
(diabaikan Git): `.playwright/phase9-round3/` (skrip probe/analisis tanpa rahasia dan hasil kontrol) dan
`.playwright/lh-gpu-diagnostic/` (JSON, log, trace). Tidak ada commit, push, PR, deploy, akses Vercel, atau fase 10.
