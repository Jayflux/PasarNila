-- Migrasi #4 (ARCHITECTURE.md §8.8, §9.4): hak tabel/kolom dan policy RLS.
-- Bergantung pada: #2 (tabel), #3 (public.current_user_is_partner)
-- Konvergen: policy lama (v0.3) dengan nama yang sama diganti; hak lama dicabut lalu diberikan ulang.

-- ---------------------------------------------------------------------------------------------
-- Hak tabel & kolom (deny by default)
-- ---------------------------------------------------------------------------------------------

-- REVOKE di level tabel juga mencabut hak kolom yang sesuai, jadi grant kolom diberikan ulang di bawah.
revoke all on table public.products, public.articles, public.site_settings from anon, authenticated;
grant select on table public.products, public.articles, public.site_settings to anon, authenticated;

-- Mitra hanya boleh mengubah DUA kolom artikel dan SATU kolom pengaturan. Tidak ada INSERT/DELETE.
-- Produk: tidak ada hak tulis sama sekali; stok/harga hanya lewat RPC (#5).
grant update (title, body) on table public.articles to authenticated;
grant update (business_name) on table public.site_settings to authenticated;

revoke all on table private.partner_admins from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- Policy RLS. Semua pemeriksaan mitra memakai public.current_user_is_partner() (dibungkus SELECT
-- agar dievaluasi sekali per statement).
-- ---------------------------------------------------------------------------------------------

-- Produk
drop policy if exists "publik baca produk terbit" on public.products;
create policy "publik baca produk terbit" on public.products
  for select to anon, authenticated
  using (is_published);

drop policy if exists "mitra baca semua produk" on public.products;
create policy "mitra baca semua produk" on public.products
  for select to authenticated
  using ((select public.current_user_is_partner()));
-- Tidak ada policy INSERT/UPDATE/DELETE pada products.

-- Artikel
drop policy if exists "publik baca artikel terbit" on public.articles;
create policy "publik baca artikel terbit" on public.articles
  for select to anon, authenticated
  using (is_published);

drop policy if exists "mitra baca semua artikel" on public.articles;
create policy "mitra baca semua artikel" on public.articles
  for select to authenticated
  using ((select public.current_user_is_partner()));

drop policy if exists "mitra ubah artikel" on public.articles;
create policy "mitra ubah artikel" on public.articles
  for update to authenticated
  using ((select public.current_user_is_partner()))
  with check ((select public.current_user_is_partner()));
-- Tidak ada policy INSERT/DELETE pada articles (PRD AC-39).

-- Pengaturan usaha
drop policy if exists "publik baca pengaturan" on public.site_settings;
create policy "publik baca pengaturan" on public.site_settings
  for select to anon, authenticated
  using (true);

drop policy if exists "mitra ubah nama usaha" on public.site_settings;
create policy "mitra ubah nama usaha" on public.site_settings
  for update to authenticated
  using ((select public.current_user_is_partner()))
  with check ((select public.current_user_is_partner()));
-- Tidak ada policy INSERT/DELETE pada site_settings (PRD AC-48).

-- private.partner_admins: RLS aktif tanpa policy dan tanpa grant untuk role API.

-- ---------------------------------------------------------------------------------------------
-- Rekonsiliasi v0.3: setelah tidak ada policy yang memanggil fungsi di schema private, role API
-- tidak lagi memerlukan USAGE schema maupun EXECUTE fungsi private.
-- ---------------------------------------------------------------------------------------------

do $$
begin
  if exists (
    select 1 from pg_policies
     where schemaname in ('public', 'private')
       and (coalesce(qual, '') like '%private.%' or coalesce(with_check, '') like '%private.%')
  ) then
    raise exception 'Rekonsiliasi gagal: masih ada policy yang memanggil objek di schema private';
  end if;
end;
$$;

revoke all on function private.is_partner_admin() from authenticated;
revoke usage on schema private from anon, authenticated;

-- Hanya tujuh policy di atas yang boleh ada. Policy lain (mis. dibuat manual di dashboard) dapat
-- membuka akses karena policy PERMISSIVE digabung dengan OR; migrasi gagal agar ditinjau manusia.
do $$
declare
  unexpected text;
begin
  select string_agg(format('%I.%I: %s', schemaname, tablename, policyname), ', ')
    into unexpected
    from pg_policies
   where (schemaname, tablename) in (('public', 'products'), ('public', 'articles'),
                                     ('public', 'site_settings'), ('private', 'partner_admins'))
     and (tablename, policyname) not in (
       ('products', 'publik baca produk terbit'), ('products', 'mitra baca semua produk'),
       ('articles', 'publik baca artikel terbit'), ('articles', 'mitra baca semua artikel'),
       ('articles', 'mitra ubah artikel'),
       ('site_settings', 'publik baca pengaturan'), ('site_settings', 'mitra ubah nama usaha')
     );
  if unexpected is not null then
    raise exception 'Rekonsiliasi gagal: policy tak terduga ditemukan: %', unexpected;
  end if;
end;
$$;
