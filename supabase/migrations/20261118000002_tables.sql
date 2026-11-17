-- Migrasi #2 (ARCHITECTURE.md §8.2–§8.8): empat tabel, constraint, trigger, RLS aktif.
-- Bergantung pada: #1 (schema private, private.set_updated_at)
--
-- Konvergen (§8.9):
-- - Database kosong: tabel dibuat lengkap.
-- - Skema v0.3 di cloud: `create table if not exists` dilewati; kolom diperiksa (gagal keras bila tidak
--   sesuai), lalu constraint batas wajar diganti ke versi v0.4 (`BETWEEN`) tanpa menyentuh data.
-- Batas angka HARUS sama dengan src/lib/domain/limits.ts (§10.5).

-- ---------------------------------------------------------------------------------------------
-- Tabel
-- ---------------------------------------------------------------------------------------------

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  name text not null,
  short_description text,
  image_path text,
  image_alt text,
  stock_kg numeric(10, 2),
  price_per_kg_idr integer,
  stock_price_confirmed_at timestamptz,
  is_published boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint products_slug_key unique (slug),
  constraint products_slug_check check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint products_name_check check (char_length(name) between 1 and 100),
  -- Tidak boleh ada angka stok/harga tanpa waktu konfirmasi.
  constraint products_confirmed_at_integrity check (
    stock_price_confirmed_at is not null or (stock_kg is null and price_per_kg_idr is null)
  )
);

create table if not exists public.articles (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  title text not null,
  body text not null,
  cover_image_path text,
  cover_image_alt text,
  is_published boolean not null default false,
  published_at timestamptz,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint articles_slug_key unique (slug),
  constraint articles_slug_check check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint articles_title_check check (char_length(btrim(title)) between 1 and 150),
  constraint articles_body_check check (char_length(btrim(body)) between 1 and 20000)
);

create table if not exists public.site_settings (
  id boolean primary key default true,
  business_name text not null,
  updated_at timestamptz not null default now(),
  constraint site_settings_id_check check (id),
  constraint site_settings_business_name_check check (
    char_length(btrim(business_name)) between 2 and 80 and business_name !~ '[\r\n]'
  )
);

create table if not exists private.partner_admins (
  singleton boolean primary key default true,
  user_id uuid not null,
  created_at timestamptz not null default now(),
  constraint partner_admins_singleton_check check (singleton),
  constraint partner_admins_user_id_key unique (user_id),
  constraint partner_admins_user_id_fkey foreign key (user_id) references auth.users (id) on delete cascade
);

-- ---------------------------------------------------------------------------------------------
-- Rekonsiliasi: pastikan tabel yang sudah ada memiliki kolom & tipe yang diharapkan.
-- Bila tidak cocok, migrasi GAGAL (seluruh file dibatalkan) daripada diam-diam menyimpang.
-- ---------------------------------------------------------------------------------------------

do $$
declare
  expected constant text[][] := array[
    ['public', 'products', 'stock_kg', 'numeric', '10', '2'],
    ['public', 'products', 'price_per_kg_idr', 'integer', '', ''],
    ['public', 'products', 'stock_price_confirmed_at', 'timestamp with time zone', '', ''],
    ['public', 'products', 'is_published', 'boolean', '', ''],
    ['public', 'products', 'updated_at', 'timestamp with time zone', '', ''],
    ['public', 'articles', 'title', 'text', '', ''],
    ['public', 'articles', 'body', 'text', '', ''],
    ['public', 'articles', 'updated_at', 'timestamp with time zone', '', ''],
    ['public', 'site_settings', 'id', 'boolean', '', ''],
    ['public', 'site_settings', 'business_name', 'text', '', ''],
    ['public', 'site_settings', 'updated_at', 'timestamp with time zone', '', ''],
    ['private', 'partner_admins', 'user_id', 'uuid', '', '']
  ];
  item text[];
  found_type text;
  found_precision text;
  found_scale text;
begin
  foreach item slice 1 in array expected loop
    select c.data_type, coalesce(c.numeric_precision::text, ''), coalesce(c.numeric_scale::text, '')
      into found_type, found_precision, found_scale
      from information_schema.columns c
     where c.table_schema = item[1] and c.table_name = item[2] and c.column_name = item[3];
    if found_type is null then
      raise exception 'Rekonsiliasi gagal: kolom %.%.% tidak ada', item[1], item[2], item[3];
    end if;
    if found_type <> item[4]
       or (item[5] <> '' and (found_precision <> item[5] or found_scale <> item[6])) then
      raise exception 'Rekonsiliasi gagal: tipe %.%.% adalah % (%,%), diharapkan % (%,%)',
        item[1], item[2], item[3], found_type, found_precision, found_scale, item[4], item[5], item[6];
    end if;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Batas wajar stok/harga (A-07, §10.5). Constraint `>= 0` peninggalan v0.3 (nama otomatis) diganti.
-- `BETWEEN` dengan batas atas juga menolak NaN/Infinity (NaN dianggap lebih besar dari semua angka).
-- ---------------------------------------------------------------------------------------------

alter table public.products drop constraint if exists products_stock_kg_check;
alter table public.products drop constraint if exists products_price_per_kg_idr_check;
alter table public.products drop constraint if exists products_stock_kg_range;
alter table public.products drop constraint if exists products_price_per_kg_idr_range;

alter table public.products
  add constraint products_stock_kg_range check (stock_kg between 0 and 100000),
  add constraint products_price_per_kg_idr_range check (price_per_kg_idr between 0 and 10000000);

-- ---------------------------------------------------------------------------------------------
-- Trigger updated_at (metadata teknis; TIDAK menyentuh stock_price_confirmed_at)
-- ---------------------------------------------------------------------------------------------

create or replace trigger products_set_updated_at
  before update on public.products
  for each row execute function private.set_updated_at();

create or replace trigger articles_set_updated_at
  before update on public.articles
  for each row execute function private.set_updated_at();

create or replace trigger site_settings_set_updated_at
  before update on public.site_settings
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------------------------
-- RLS aktif di file yang sama dengan pembuatan tabel: tidak ada tabel tanpa RLS.
-- ---------------------------------------------------------------------------------------------

alter table public.products enable row level security;
alter table public.articles enable row level security;
alter table public.site_settings enable row level security;
alter table private.partner_admins enable row level security;

-- Deny by default SEJAK tabel dibuat: default privileges Supabase di schema `public` memberi role API
-- semua hak atas tabel baru, termasuk TRUNCATE yang tidak dibatasi RLS. Hak baca diberikan di #4.
revoke all on table public.products, public.articles, public.site_settings from anon, authenticated;
revoke all on table private.partner_admins from public, anon, authenticated;
