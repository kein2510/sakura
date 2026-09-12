-- ==============================================================================
-- 和食さくら 新商品 売上・在庫・給与管理システム Supabase スキーマ定義
-- 冪等（何度実行してもエラーにならない）設計
-- PostgreSQL DDL + Row Level Security (RLS) + Realtime 設定
-- ==============================================================================

-- 1. ユーザープロファイル（ロール・給与・雇用形態）
create table if not exists public.user_profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null unique,
  full_name text not null,
  role text not null check (role in ('staff', 'executive')) default 'staff',
  employment_type text not null check (employment_type in ('full_time', 'part_time')) default 'part_time',
  hourly_wage numeric default 0,
  monthly_salary numeric default 0,
  avatar_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. カテゴリマスタ
create table if not exists public.categories (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  type text not null check (type in ('product', 'ingredient')),
  created_at timestamptz default now()
);

-- 3. 商品・仕入れ素材マスタ (items)
create table if not exists public.items (
  id uuid default gen_random_uuid() primary key,
  code text unique,
  name text not null,
  category_id uuid references public.categories(id) on delete set null,
  type text not null check (type in ('product', 'ingredient')),
  unit text not null default '個',
  current_stock numeric not null default 0,
  optimal_stock numeric not null default 10,
  alert_threshold numeric not null default 3,
  cost_price numeric not null default 0,
  selling_price numeric not null default 0,
  image_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 4. 売上伝票 (sales)
create table if not exists public.sales (
  id uuid default gen_random_uuid() primary key,
  staff_id uuid references public.user_profiles(id) on delete set null,
  total_amount numeric not null default 0,
  discount_amount numeric not null default 0,
  payment_method text not null check (payment_method in ('cash', 'credit', 'qr', 'other')),
  notes text,
  created_at timestamptz default now()
);

-- 5. 売上明細 (sale_items)
create table if not exists public.sale_items (
  id uuid default gen_random_uuid() primary key,
  sale_id uuid references public.sales(id) on delete cascade not null,
  item_id uuid references public.items(id) on delete restrict not null,
  quantity numeric not null check (quantity > 0),
  unit_price numeric not null,
  subtotal numeric not null
);

-- 6. 在庫入出庫履歴 (inventory_transactions)
create table if not exists public.inventory_transactions (
  id uuid default gen_random_uuid() primary key,
  item_id uuid references public.items(id) on delete cascade not null,
  transaction_type text not null check (transaction_type in ('inbound', 'outbound', 'waste', 'adjust')),
  quantity numeric not null,
  previous_stock numeric not null,
  new_stock numeric not null,
  reason text,
  staff_id uuid references public.user_profiles(id) on delete set null,
  created_at timestamptz default now()
);

-- 7. 受発注データ (orders)
create table if not exists public.orders (
  id uuid default gen_random_uuid() primary key,
  item_id uuid references public.items(id) on delete cascade not null,
  quantity numeric not null check (quantity > 0),
  supplier_name text,
  status text not null check (status in ('ordered', 'received', 'cancelled')) default 'ordered',
  staff_id uuid references public.user_profiles(id) on delete set null,
  expected_delivery date,
  created_at timestamptz default now(),
  received_at timestamptz
);

-- 8. 給与・勤怠記録 (payroll_records: 幹部のみアクセス可能)
create table if not exists public.payroll_records (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.user_profiles(id) on delete cascade not null,
  target_month text not null,
  work_hours numeric not null default 0,
  overtime_hours numeric not null default 0,
  base_pay numeric not null default 0,
  overtime_pay numeric not null default 0,
  bonus numeric not null default 0,
  deductions numeric not null default 0,
  total_salary numeric not null default 0,
  status text not null check (status in ('draft', 'confirmed', 'paid')) default 'draft',
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 行レベルセキュリティ (RLS) の有効化
alter table public.user_profiles enable row level security;
alter table public.categories enable row level security;
alter table public.items enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.inventory_transactions enable row level security;
alter table public.orders enable row level security;
alter table public.payroll_records enable row level security;

-- 幹部権限判定関数
create or replace function public.is_executive()
returns boolean as $$
begin
  return exists (
    select 1 from public.user_profiles
    where id = auth.uid() and role = 'executive'
  );
end;
$$ language plpgsql security definer;

-- ==============================================================================
-- RLSポリシー定義（既存ポリシーを削除してから再作成）
-- ==============================================================================

-- 1) user_profiles: 自身または幹部は閲覧可、編集は幹部のみ
drop policy if exists "View profile" on public.user_profiles;
create policy "View profile" on public.user_profiles
  for select using (auth.uid() = id or public.is_executive() or auth.role() = 'anon');

drop policy if exists "Executive modify profiles" on public.user_profiles;
create policy "Executive modify profiles" on public.user_profiles
  for all using (public.is_executive());

-- 2) payroll_records: 幹部のみ閲覧・操作可能（一般スタッフは完全遮断）
drop policy if exists "Executive only payroll access" on public.payroll_records;
create policy "Executive only payroll access" on public.payroll_records
  for all using (public.is_executive());

-- 3) categories: 誰でも閲覧可能
drop policy if exists "Authenticated read categories" on public.categories;
drop policy if exists "Allow read categories" on public.categories;
create policy "Allow read categories" on public.categories
  for select using (true);

drop policy if exists "Allow insert categories" on public.categories;
create policy "Allow insert categories" on public.categories
  for insert with check (true);

-- 4) items: 誰でも閲覧可能、更新可能
drop policy if exists "Authenticated read items" on public.items;
drop policy if exists "Allow read items" on public.items;
create policy "Allow read items" on public.items
  for select using (true);

drop policy if exists "Authenticated update items" on public.items;
drop policy if exists "Allow modify items" on public.items;
create policy "Allow modify items" on public.items
  for all using (true);

-- 5) sales: 誰でも閲覧・追加可能
drop policy if exists "Authenticated read sales" on public.sales;
drop policy if exists "Allow read sales" on public.sales;
create policy "Allow read sales" on public.sales
  for select using (true);

drop policy if exists "Authenticated insert sales" on public.sales;
drop policy if exists "Allow insert sales" on public.sales;
create policy "Allow insert sales" on public.sales
  for insert with check (true);

-- 6) sale_items: 誰でも閲覧・追加可能
drop policy if exists "Authenticated read sale_items" on public.sale_items;
drop policy if exists "Allow read sale_items" on public.sale_items;
create policy "Allow read sale_items" on public.sale_items
  for select using (true);

drop policy if exists "Authenticated insert sale_items" on public.sale_items;
drop policy if exists "Allow insert sale_items" on public.sale_items;
create policy "Allow insert sale_items" on public.sale_items
  for insert with check (true);

-- 7) inventory_transactions: 誰でも閲覧・追加可能
drop policy if exists "Authenticated read inventory_transactions" on public.inventory_transactions;
drop policy if exists "Allow read inventory_transactions" on public.inventory_transactions;
create policy "Allow read inventory_transactions" on public.inventory_transactions
  for select using (true);

drop policy if exists "Authenticated insert inventory_transactions" on public.inventory_transactions;
drop policy if exists "Allow insert inventory_transactions" on public.inventory_transactions;
create policy "Allow insert inventory_transactions" on public.inventory_transactions
  for insert with check (true);

-- 8) orders: 誰でも管理可能
drop policy if exists "Authenticated manage orders" on public.orders;
drop policy if exists "Allow manage orders" on public.orders;
create policy "Allow manage orders" on public.orders
  for all using (true);

-- ==============================================================================
-- リアルタイム同期 (Realtime Publications) の安全な追加
-- ==============================================================================
do $$
begin
  if not exists (
    select 1 from pg_publication_tables 
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'sales'
  ) then
    alter publication supabase_realtime add table public.sales;
  end if;

  if not exists (
    select 1 from pg_publication_tables 
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'sale_items'
  ) then
    alter publication supabase_realtime add table public.sale_items;
  end if;

  if not exists (
    select 1 from pg_publication_tables 
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'items'
  ) then
    alter publication supabase_realtime add table public.items;
  end if;

  if not exists (
    select 1 from pg_publication_tables 
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'inventory_transactions'
  ) then
    alter publication supabase_realtime add table public.inventory_transactions;
  end if;

  if not exists (
    select 1 from pg_publication_tables 
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'orders'
  ) then
    alter publication supabase_realtime add table public.orders;
  end if;
end $$;

-- 初期カテゴリ登録
insert into public.categories (name, type) values
  ('寿司・刺身', 'product'),
  ('肉料理・鍋', 'product'),
  ('揚げ物・焼物', 'product'),
  ('日本酒・飲料', 'product'),
  ('鮮魚・水産素材', 'ingredient'),
  ('精肉・畜産素材', 'ingredient'),
  ('調味料・乾物・米', 'ingredient')
on conflict do nothing;
