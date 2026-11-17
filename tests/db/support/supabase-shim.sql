-- Shim minimal lingkungan Supabase untuk PGlite (Postgres WASM) di laptop TANPA Docker.
--
-- Meniru bagian yang memengaruhi keamanan migrasi PasarNila, berdasarkan katalog proyek cloud yang
-- dibaca read-only pada 18 November 2026 (ARCHITECTURE.md §8.9):
-- - role anon/authenticated (tanpa BYPASSRLS) dan service_role (BYPASSRLS);
-- - schema auth + auth.users + auth.uid() (definisi disalin dari cloud);
-- - default privileges di schema public untuk tabel, fungsi, dan sequence.
--
-- Perbedaan yang diketahui: di PGlite `postgres` adalah superuser; di cloud `postgres` bukan superuser
-- tetapi BYPASSRLS dan pemilik semua objek. Keduanya melewati RLS saat menjalankan fungsi
-- SECURITY DEFINER. Uji perilaku dijalankan sebagai anon/authenticated lewat SET ROLE.

create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;

grant usage on schema public to anon, authenticated, service_role;

create schema auth;
create table auth.users (
  id uuid primary key,
  email text
);
grant usage on schema auth to anon, authenticated, service_role;

create function auth.uid()
returns uuid
language sql
stable
as $$
  select
  coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;
grant execute on function auth.uid() to anon, authenticated, service_role;

alter default privileges for role postgres in schema public
  grant all on tables to anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  grant all on functions to anon, authenticated, service_role;
alter default privileges for role postgres in schema public
  grant all on sequences to anon, authenticated, service_role;
