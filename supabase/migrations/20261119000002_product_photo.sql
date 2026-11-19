-- Migrasi #8: fungsi RPC untuk memperbarui foto produk oleh mitra (PRD Q-12, A-12).
-- Bergantung pada: #2 (public.products), #3 (private.is_partner_admin).

create or replace function public.update_product_photo(
  p_product_id uuid,
  p_image_path text,
  p_image_alt text default null
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
  -- Otorisasi lebih dulu: akun non-mitra ditolak
  if not private.is_partner_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if p_product_id is null then
    raise exception 'product_required' using errcode = '22023';
  end if;

  -- Batas ukuran teks image_path (misal data URL atau path) maksimal 3MB (sekitar 3.000.000 karakter)
  if p_image_path is not null and char_length(p_image_path) > 3000000 then
    raise exception 'image_too_large' using errcode = '22023';
  end if;

  -- Mengubah foto TIDAK mengubah stock_price_confirmed_at
  update public.products
     set image_path = p_image_path,
         image_alt = case
           when p_image_path is null then null
           else coalesce(p_image_alt, image_alt)
         end
   where id = p_product_id
  returning * into v_row;

  if not found then
    raise exception 'product_not_found' using errcode = 'P0002';
  end if;

  return v_row;
end;
$$;

revoke all on function public.update_product_photo(uuid, text, text) from public, anon, authenticated;
grant execute on function public.update_product_photo(uuid, text, text) to authenticated;
