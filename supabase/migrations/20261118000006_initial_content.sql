-- Migrasi #6 (ARCHITECTURE.md §8.5): data awal. Idempoten dan TIDAK menimpa data yang sudah ada.
-- Bergantung pada: #2. Sengaja setelah #4 agar data masuk ke skema yang sudah terkunci.
--
-- - Stok, harga, dan waktu konfirmasi TIDAK diisi: mitra mengisinya lewat panel (PRD BR-H9).
-- - Tidak ada akun, password, atau baris allowlist mitra di sini (ARCHITECTURE §9.6).
-- - `on conflict do nothing`: baris yang sudah ada (termasuk yang sudah diedit mitra) tidak disentuh.

insert into public.products (slug, name, is_published, sort_order)
values ('ikan-nila', 'Ikan Nila', true, 0)
on conflict (slug) do nothing;

insert into public.articles (slug, title, body, is_published, sort_order)
values
  ('artikel-1',
   '[PLACEHOLDER] Artikel 1, menunggu bahan dari klien',
   '[PLACEHOLDER] Isi artikel 1 belum tersedia. Konten akan diganti dengan bahan asli dari klien.',
   true, 1),
  ('artikel-2',
   '[PLACEHOLDER] Artikel 2, menunggu bahan dari klien',
   '[PLACEHOLDER] Isi artikel 2 belum tersedia. Konten akan diganti dengan bahan asli dari klien.',
   true, 2)
on conflict (slug) do nothing;

insert into public.site_settings (id, business_name)
values (true, 'Juki Fish Farm')
on conflict (id) do nothing;
