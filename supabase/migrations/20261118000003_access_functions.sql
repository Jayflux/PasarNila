-- Migrasi #3 (ARCHITECTURE.md §8.8, §9.3): fungsi pemeriksa akses mitra.
-- Bergantung pada: #2 (private.partner_admins). Harus ada SEBELUM policy di #4 yang memakainya.

-- Inti pemeriksaan: apakah pemanggil (auth.uid()) ada di allowlist satu baris?
-- `language sql` divalidasi saat dibuat, jadi tabel partner_admins harus sudah ada (#2).
create or replace function private.is_partner_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from private.partner_admins
     where user_id = (select auth.uid())
  );
$$;

-- Tidak ada role API yang memerlukan fungsi ini secara langsung. Pencabutan dari `authenticated`
-- (peninggalan v0.3, dipakai policy lama) dilakukan di #4 setelah policy diganti.
revoke all on function private.is_partner_admin() from public, anon;

-- Wrapper publik: dipakai aplikasi saat login ("apakah SAYA mitra?") dan oleh policy RLS (#4).
-- Hanya menjawab tentang pemanggil sendiri; tidak membuka isi allowlist.
create or replace function public.current_user_is_partner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_partner_admin();
$$;

-- Postgres memberi EXECUTE ke PUBLIC secara bawaan, dan Supabase memberi default privileges ke
-- anon/authenticated di schema public (terverifikasi di cloud, §8.9). Cabut semua, beri yang perlu.
revoke all on function public.current_user_is_partner() from public, anon, authenticated;
grant execute on function public.current_user_is_partner() to authenticated;
