-- Migrasi #7 (ARCHITECTURE.md §8.10, §9.9): pilihan paket katalog yang dikelola mitra (PRD §12.8).
-- Bergantung pada: #1 (private.set_updated_at), #2 (public.products), #3 (private.is_partner_admin,
-- public.current_user_is_partner).
--
-- Aturan:
-- - Stok TOTAL dan harga satuan per kg tetap di public.products. Paket TIDAK memiliki stok sendiri.
-- - Harga total paket ditentukan bebas oleh mitra (boleh lebih rendah, sama, atau lebih tinggi daripada
--   berat x harga satuan). Penghematan & harga efektif TIDAK disimpan; dihitung saat ditampilkan.
-- - Tulis HANYA lewat tiga fungsi RPC di bawah (tidak ada hak INSERT/UPDATE/DELETE langsung).
--   Fungsi-fungsi itu tidak menyentuh public.products, sehingga stok, harga satuan, dan
--   stock_price_confirmed_at tidak berubah oleh CRUD paket.
-- - Batas SAMA dengan src/lib/domain/limits.ts (PACKAGE_*).
-- - Tidak ada data paket awal: contoh/harga lama yang ditulis di kode bukan data klien yang disetujui.
-- Idempoten: aman dijalankan ulang dan tidak menimpa data.

-- ---------------------------------------------------------------------------------------------
-- Tabel
-- ---------------------------------------------------------------------------------------------

create table if not exists public.product_packages (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null,
  name text not null,
  weight_kg numeric(10, 2) not null,
  price_total_idr integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_packages_product_id_fkey
    foreign key (product_id) references public.products (id) on delete cascade,
  constraint product_packages_name_check
    check (char_length(btrim(name)) between 1 and 60 and name !~ '[\r\n]'),
  -- Batas atas juga menolak NaN/Infinity (NaN dianggap lebih besar dari semua angka).
  constraint product_packages_weight_range check (weight_kg > 0 and weight_kg <= 10000),
  constraint product_packages_price_range check (price_total_idr between 0 and 1000000000)
);

create index if not exists product_packages_product_id_idx
  on public.product_packages (product_id, weight_kg, price_total_idr, created_at);

create or replace trigger product_packages_set_updated_at
  before update on public.product_packages
  for each row execute function private.set_updated_at();

alter table public.product_packages enable row level security;

-- Deny by default (default privileges Supabase memberi role API semua hak atas tabel baru).
revoke all on table public.product_packages from public, anon, authenticated;
grant select on table public.product_packages to anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- Policy baca. Tidak ada policy INSERT/UPDATE/DELETE: penulisan hanya lewat fungsi RPC.
-- ---------------------------------------------------------------------------------------------

drop policy if exists "publik baca paket produk terbit" on public.product_packages;
create policy "publik baca paket produk terbit" on public.product_packages
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.products p
       where p.id = product_packages.product_id and p.is_published
    )
  );

drop policy if exists "mitra baca semua paket" on public.product_packages;
create policy "mitra baca semua paket" on public.product_packages
  for select to authenticated
  using ((select public.current_user_is_partner()));

-- Hanya dua policy di atas yang boleh ada (policy PERMISSIVE digabung dengan OR).
do $$
declare
  unexpected text;
begin
  select string_agg(policyname, ', ')
    into unexpected
    from pg_policies
   where schemaname = 'public' and tablename = 'product_packages'
     and policyname not in ('publik baca paket produk terbit', 'mitra baca semua paket');
  if unexpected is not null then
    raise exception 'Rekonsiliasi gagal: policy tak terduga pada product_packages: %', unexpected;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Validasi bersama (schema private: tidak dapat dipanggil role API)
-- ---------------------------------------------------------------------------------------------

-- Mengembalikan nama yang dirapikan (spasi tepi dibuang, spasi ganda menjadi satu) atau melempar kunci.
create or replace function private.normalize_package_name(p_name text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_name text;
begin
  if p_name is null then
    raise exception 'package_name_required' using errcode = '22023';
  end if;
  if p_name ~ '[\r\n]' then
    raise exception 'package_name_line_break' using errcode = '22023';
  end if;
  v_name := regexp_replace(regexp_replace(p_name, '^\s+|\s+$', '', 'g'), '\s+', ' ', 'g');
  if char_length(v_name) < 1 then
    raise exception 'package_name_required' using errcode = '22023';
  end if;
  if char_length(v_name) > 60 then
    raise exception 'package_name_too_long' using errcode = '22023';
  end if;
  return v_name;
end;
$$;

create or replace function private.assert_package_numbers(p_weight_kg numeric, p_price_total_idr numeric)
returns void
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_weight_kg is null then
    raise exception 'package_weight_required' using errcode = '22023';
  end if;
  -- Perbandingan rentang menolak NaN, Infinity, dan -Infinity.
  if not (p_weight_kg > 0 and p_weight_kg <= 10000) then
    raise exception 'package_weight_out_of_range' using errcode = '22023';
  end if;
  if p_weight_kg <> round(p_weight_kg, 2) then
    raise exception 'package_weight_too_many_decimals' using errcode = '22023';  -- ditolak, bukan dibulatkan
  end if;
  if p_price_total_idr is null then
    raise exception 'package_price_required' using errcode = '22023';
  end if;
  if not (p_price_total_idr >= 0 and p_price_total_idr <= 1000000000) then
    raise exception 'package_price_out_of_range' using errcode = '22023';
  end if;
  if p_price_total_idr <> trunc(p_price_total_idr) then
    raise exception 'package_price_not_whole' using errcode = '22023';  -- ditolak, bukan dibulatkan
  end if;
end;
$$;

revoke all on function private.normalize_package_name(text) from public, anon, authenticated;
revoke all on function private.assert_package_numbers(numeric, numeric) from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- RPC tulis (SECURITY DEFINER; otorisasi mitra diperiksa lebih dulu)
-- ---------------------------------------------------------------------------------------------

-- Tambah paket. `p_id` dibuat browser per isian formulir: mengirim ulang permintaan yang sama
-- (retry/hasil belum pasti) TIDAK membuat paket ganda. Bila id sudah ada dengan isi yang sama, baris itu
-- dikembalikan; bila isinya berbeda, ditolak `package_id_conflict`.
create or replace function public.create_product_package(
  p_id uuid,
  p_product_id uuid,
  p_name text,
  p_weight_kg numeric,
  p_price_total_idr numeric
)
returns public.product_packages
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_name text;
  v_row public.product_packages;
begin
  if not private.is_partner_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_id is null then
    raise exception 'package_id_required' using errcode = '22023';
  end if;
  if p_product_id is null then
    raise exception 'product_required' using errcode = '22023';
  end if;
  v_name := private.normalize_package_name(p_name);
  perform private.assert_package_numbers(p_weight_kg, p_price_total_idr);

  if not exists (select 1 from public.products where id = p_product_id) then
    raise exception 'product_not_found' using errcode = 'P0002';
  end if;

  insert into public.product_packages (id, product_id, name, weight_kg, price_total_idr)
  values (p_id, p_product_id, v_name, p_weight_kg, p_price_total_idr::integer)
  on conflict (id) do nothing
  returning * into v_row;

  if not found then
    select * into v_row from public.product_packages where id = p_id;
    if v_row.product_id is distinct from p_product_id
       or v_row.name is distinct from v_name
       or v_row.weight_kg is distinct from p_weight_kg
       or v_row.price_total_idr is distinct from p_price_total_idr::integer then
      raise exception 'package_id_conflict' using errcode = '23505';
    end if;
  end if;

  return v_row;
end;
$$;

-- Ubah nama, berat, dan harga total. Kolom lain (product_id, waktu) tidak dapat diubah.
create or replace function public.update_product_package(
  p_id uuid,
  p_name text,
  p_weight_kg numeric,
  p_price_total_idr numeric
)
returns public.product_packages
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_name text;
  v_row public.product_packages;
begin
  if not private.is_partner_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_id is null then
    raise exception 'package_id_required' using errcode = '22023';
  end if;
  v_name := private.normalize_package_name(p_name);
  perform private.assert_package_numbers(p_weight_kg, p_price_total_idr);

  update public.product_packages
     set name = v_name,
         weight_kg = p_weight_kg,
         price_total_idr = p_price_total_idr::integer
   where id = p_id
  returning * into v_row;

  if not found then
    raise exception 'package_not_found' using errcode = 'P0002';
  end if;
  return v_row;
end;
$$;

-- Hapus paket. Mengembalikan baris yang dihapus; tidak ada → package_not_found.
create or replace function public.delete_product_package(p_id uuid)
returns public.product_packages
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_row public.product_packages;
begin
  if not private.is_partner_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_id is null then
    raise exception 'package_id_required' using errcode = '22023';
  end if;

  delete from public.product_packages where id = p_id returning * into v_row;

  if not found then
    raise exception 'package_not_found' using errcode = 'P0002';
  end if;
  return v_row;
end;
$$;

revoke all on function public.create_product_package(uuid, uuid, text, numeric, numeric) from public, anon, authenticated;
revoke all on function public.update_product_package(uuid, text, numeric, numeric) from public, anon, authenticated;
revoke all on function public.delete_product_package(uuid) from public, anon, authenticated;
grant execute on function public.create_product_package(uuid, uuid, text, numeric, numeric) to authenticated;
grant execute on function public.update_product_package(uuid, text, numeric, numeric) to authenticated;
grant execute on function public.delete_product_package(uuid) to authenticated;
