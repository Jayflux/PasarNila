-- Rekonstruksi skema v0.3 yang ADA di proyek cloud "PasarNila", disusun dari katalog yang dibaca
-- read-only pada 18 November 2026 (nama constraint, ACL tabel/kolom/fungsi, isi fungsi, policy, trigger).
-- Dipakai HANYA untuk menguji bahwa migrasi 20261118000001–06 konvergen dari keadaan ini.
-- Isi body artikel di cloud tidak dibaca; di sini diganti teks uji.

create schema private;
grant usage on schema private to authenticated;

create function private.set_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (char_length(name) >= 1 and char_length(name) <= 100),
  short_description text,
  image_path text,
  image_alt text,
  stock_kg numeric(10, 2) check (stock_kg >= (0)::numeric),
  price_per_kg_idr integer check (price_per_kg_idr >= 0),
  stock_price_confirmed_at timestamptz,
  is_published boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint products_confirmed_at_integrity check (
    stock_price_confirmed_at is not null or (stock_kg is null and price_per_kg_idr is null)
  )
);

create table public.articles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null check (char_length(btrim(title)) >= 1 and char_length(btrim(title)) <= 150),
  body text not null check (char_length(btrim(body)) >= 1 and char_length(btrim(body)) <= 20000),
  cover_image_path text,
  cover_image_alt text,
  is_published boolean not null default false,
  published_at timestamptz,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.site_settings (
  id boolean primary key default true check (id),
  -- Bentuk BETWEEN menghasilkan definisi tersimpan yang sama dengan katalog cloud.
  business_name text not null check (
    char_length(btrim(business_name)) between 2 and 80 and business_name !~ '[\r\n]'
  ),
  updated_at timestamptz not null default now()
);

create table private.partner_admins (
  singleton boolean primary key default true check (singleton),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create trigger products_set_updated_at before update on public.products
  for each row execute function private.set_updated_at();
create trigger articles_set_updated_at before update on public.articles
  for each row execute function private.set_updated_at();
create trigger site_settings_set_updated_at before update on public.site_settings
  for each row execute function private.set_updated_at();

alter table public.products enable row level security;
alter table public.articles enable row level security;
alter table public.site_settings enable row level security;
alter table private.partner_admins enable row level security;

revoke all on public.products, public.articles, public.site_settings from anon, authenticated;
grant select on public.products, public.articles, public.site_settings to anon, authenticated;
grant update (title, body) on public.articles to authenticated;
grant update (business_name) on public.site_settings to authenticated;

create function private.is_partner_admin() returns boolean language sql stable security definer
set search_path = '' as $$
  select exists (
    select 1 from private.partner_admins
    where user_id = (select auth.uid())
  );
$$;
revoke execute on function private.is_partner_admin() from public;
grant execute on function private.is_partner_admin() to authenticated;

create function public.current_user_is_partner() returns boolean language sql stable security definer
set search_path = '' as $$ select private.is_partner_admin(); $$;
revoke execute on function public.current_user_is_partner() from public, anon;
grant execute on function public.current_user_is_partner() to authenticated;

create function public.confirm_product_stock_price(
  p_product_id uuid, p_stock_kg numeric, p_price_per_kg_idr integer
) returns public.products language plpgsql security definer set search_path = '' as $$
declare
  v_row public.products;
begin
  if not private.is_partner_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_stock_kg is null or p_price_per_kg_idr is null then
    raise exception 'stok dan harga wajib diisi' using errcode = '22023';
  end if;
  if p_stock_kg < 0 or p_stock_kg > 100000 then
    raise exception 'stok di luar batas wajar' using errcode = '22023';
  end if;
  if p_stock_kg <> round(p_stock_kg, 2) then
    raise exception 'stok maksimal 2 desimal' using errcode = '22023';
  end if;
  if p_price_per_kg_idr < 0 or p_price_per_kg_idr > 10000000 then
    raise exception 'harga di luar batas wajar' using errcode = '22023';
  end if;
  update public.products
     set stock_kg = p_stock_kg,
         price_per_kg_idr = p_price_per_kg_idr,
         stock_price_confirmed_at = now()
   where id = p_product_id
  returning * into v_row;
  if not found then
    raise exception 'produk tidak ditemukan' using errcode = 'P0002';
  end if;
  return v_row;
end;
$$;
revoke execute on function public.confirm_product_stock_price(uuid, numeric, integer) from public, anon;
grant execute on function public.confirm_product_stock_price(uuid, numeric, integer) to authenticated;

create policy "mitra baca semua artikel" on public.articles for select to authenticated
  using ((select private.is_partner_admin()));
create policy "mitra ubah artikel" on public.articles for update to authenticated
  using ((select private.is_partner_admin())) with check ((select private.is_partner_admin()));
create policy "publik baca artikel terbit" on public.articles for select to anon, authenticated
  using (is_published);
create policy "mitra baca semua produk" on public.products for select to authenticated
  using ((select private.is_partner_admin()));
create policy "publik baca produk terbit" on public.products for select to anon, authenticated
  using (is_published);
create policy "mitra ubah nama usaha" on public.site_settings for update to authenticated
  using ((select private.is_partner_admin())) with check ((select private.is_partner_admin()));
create policy "publik baca pengaturan" on public.site_settings for select to anon, authenticated
  using (true);

insert into public.products (slug, name, is_published) values ('ikan-nila', 'Ikan Nila', true);
insert into public.articles (slug, title, body, is_published, sort_order) values
  ('artikel-1', '[PLACEHOLDER] Artikel 1, menunggu bahan dari klien', 'Isi uji v0.3 artikel 1.', true, 1),
  ('artikel-2', '[PLACEHOLDER] Artikel 2, menunggu bahan dari klien', 'Isi uji v0.3 artikel 2.', true, 2);
insert into public.site_settings (id, business_name) values (true, 'Juki Fish Farm');
