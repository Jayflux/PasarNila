-- Migrasi #5 (ARCHITECTURE.md §9.5, §10.5): satu-satunya jalur ubah stok, harga, dan waktu konfirmasi.
-- Bergantung pada: #2 (public.products), #3 (private.is_partner_admin)
--
-- Rekonsiliasi v0.3: versi lama berparameter harga `integer` dihapus. Bila dibiarkan, `create or
-- replace` dengan tipe parameter berbeda membuat overload kedua, dan cast ke integer dapat
-- membulatkan pecahan diam-diam.

drop function if exists public.confirm_product_stock_price(uuid, numeric, integer);

create or replace function public.confirm_product_stock_price(
  p_product_id uuid,
  p_stock_kg numeric,
  p_price_per_kg_idr numeric
)
returns public.products
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_row public.products;
begin
  -- Otorisasi lebih dulu: akun non-mitra tidak mendapat informasi apa pun tentang validasi.
  if not private.is_partner_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if p_product_id is null then
    raise exception 'product_required' using errcode = '22023';
  end if;
  if p_stock_kg is null or p_price_per_kg_idr is null then
    raise exception 'stock_price_required' using errcode = '22023';
  end if;

  -- Batas SAMA dengan src/lib/domain/limits.ts dan constraint tabel (#2).
  -- Perbandingan rentang juga menolak NaN, Infinity, dan -Infinity.
  if p_stock_kg < 0 or p_stock_kg > 100000 then
    raise exception 'stock_out_of_range' using errcode = '22023';
  end if;
  if p_stock_kg <> round(p_stock_kg, 2) then
    raise exception 'stock_too_many_decimals' using errcode = '22023';  -- ditolak, bukan dibulatkan
  end if;
  if p_price_per_kg_idr < 0 or p_price_per_kg_idr > 10000000 then
    raise exception 'price_out_of_range' using errcode = '22023';
  end if;
  if p_price_per_kg_idr <> trunc(p_price_per_kg_idr) then
    raise exception 'price_not_whole' using errcode = '22023';  -- ditolak, bukan dibulatkan
  end if;

  -- Satu UPDATE = atomik. Waktu konfirmasi SELALU diisi jam database, juga saat angka sama
  -- (konfirmasi ulang, PRD BR-W4).
  update public.products
     set stock_kg = p_stock_kg,
         price_per_kg_idr = p_price_per_kg_idr::integer,
         stock_price_confirmed_at = now()
   where id = p_product_id
  returning * into v_row;

  if not found then
    raise exception 'product_not_found' using errcode = 'P0002';
  end if;

  return v_row;
end;
$$;

revoke all on function public.confirm_product_stock_price(uuid, numeric, numeric)
  from public, anon, authenticated;
grant execute on function public.confirm_product_stock_price(uuid, numeric, numeric) to authenticated;
