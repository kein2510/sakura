-- ==============================================================================
-- 和食さくら 新商品 売上・在庫・給与管理システム
-- Supabase リアルタイム同期 & 全履歴永続化 スキーマ
-- ==============================================================================

-- 1. 全商品・素材マスタ (sakura_items)
create table if not exists public.sakura_items (
  id text primary key,
  code text,
  name text not null,
  type text not null check (type in ('product', 'ingredient')),
  shop_id text default 'sakura',
  unit text not null default '個',
  current_stock numeric not null default 0,
  optimal_stock numeric default 10,
  alert_threshold numeric default 3,
  cost_price numeric default 0,
  selling_price numeric not null default 0,
  category_id text,
  category_name text,
  image_url text,
  recipe jsonb default '[]'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. 売上伝票 (sakura_sales)
create table if not exists public.sakura_sales (
  id text primary key,
  shop_id text not null default 'sakura',
  staff_name text not null,
  staff_user_id text,
  total_amount numeric not null default 0,
  items jsonb not null default '[]'::jsonb,
  payment_method text default 'cash',
  notes text,
  created_at timestamptz default now()
);

-- 3. 全操作履歴・監査ログ (sakura_action_logs)
create table if not exists public.sakura_action_logs (
  id text primary key,
  user_name text not null,
  user_role text not null default 'staff',
  category text not null,
  title text not null,
  detail text not null,
  created_at timestamptz default now()
);

-- 4. システム共通状態 (sakura_system_state) - 金庫残高、週次ボーナス、役職、ユーザー等
create table if not exists public.sakura_system_state (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz default now()
);

-- ==============================================================================
-- 行レベルセキュリティ (RLS) の有効化 & 全権限ポリシー
-- ==============================================================================
alter table public.sakura_items enable row level security;
alter table public.sakura_sales enable row level security;
alter table public.sakura_action_logs enable row level security;
alter table public.sakura_system_state enable row level security;

-- 全操作（SELECT, INSERT, UPDATE, DELETE）を anon キーでも許可
drop policy if exists "Allow all on sakura_items" on public.sakura_items;
create policy "Allow all on sakura_items" on public.sakura_items for all using (true) with check (true);

drop policy if exists "Allow all on sakura_sales" on public.sakura_sales;
create policy "Allow all on sakura_sales" on public.sakura_sales for all using (true) with check (true);

drop policy if exists "Allow all on sakura_action_logs" on public.sakura_action_logs;
create policy "Allow all on sakura_action_logs" on public.sakura_action_logs for all using (true) with check (true);

drop policy if exists "Allow all on sakura_system_state" on public.sakura_system_state;
create policy "Allow all on sakura_system_state" on public.sakura_system_state for all using (true) with check (true);

-- ==============================================================================
-- リアルタイム同期 (Realtime Publications) & レプリカアイデンティティ
-- ==============================================================================
alter table public.sakura_items replica identity full;
alter table public.sakura_sales replica identity full;
alter table public.sakura_action_logs replica identity full;
alter table public.sakura_system_state replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables 
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'sakura_items'
  ) then
    alter publication supabase_realtime add table public.sakura_items;
  end if;

  if not exists (
    select 1 from pg_publication_tables 
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'sakura_sales'
  ) then
    alter publication supabase_realtime add table public.sakura_sales;
  end if;

  if not exists (
    select 1 from pg_publication_tables 
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'sakura_action_logs'
  ) then
    alter publication supabase_realtime add table public.sakura_action_logs;
  end if;

  if not exists (
    select 1 from pg_publication_tables 
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'sakura_system_state'
  ) then
    alter publication supabase_realtime add table public.sakura_system_state;
  end if;
end $$;
