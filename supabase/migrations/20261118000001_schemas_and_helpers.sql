-- Migrasi #1 (ARCHITECTURE.md §8.8): schema `private` + fungsi trigger `updated_at`.
-- Bergantung pada: —
-- Konvergen: aman pada database kosong dan pada skema v0.3 yang sudah ada di cloud (§8.9).

create schema if not exists private;

-- Tidak ada role selain pemilik yang boleh memakai schema private secara bawaan.
-- (USAGE untuk `authenticated` peninggalan v0.3 baru dicabut di migrasi #4, setelah policy RLS
-- tidak lagi memanggil fungsi di schema ini.)
revoke all on schema private from public;
revoke all on schema private from anon;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Hanya dipanggil trigger. Hak EXECUTE fungsi trigger diperiksa saat CREATE TRIGGER (oleh pemilik
-- migrasi), bukan saat trigger berjalan, jadi role API tidak memerlukannya (diuji di tests/db).
revoke all on function private.set_updated_at() from public, anon, authenticated;
