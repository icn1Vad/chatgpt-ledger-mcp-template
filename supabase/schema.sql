create table if not exists public.transactions (
  id text primary key
);

alter table public.transactions
  alter column id drop identity if exists,
  alter column id drop default;

alter table public.transactions
  alter column id type text using id::text;

alter table public.transactions
  add column if not exists occurred_at date,
  add column if not exists amount numeric,
  add column if not exists currency text default 'CNY',
  add column if not exists type text default 'expense',
  add column if not exists category text default '未分类',
  add column if not exists merchant text default '',
  add column if not exists account text default '',
  add column if not exists payment_method text default '',
  add column if not exists note text default '',
  add column if not exists raw_text text default '',
  add column if not exists source text default 'chatgpt',
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now(),
  add column if not exists deleted_at timestamptz,
  add column if not exists deleted_reason text default '';

update public.transactions
set
  occurred_at = coalesce(occurred_at, current_date),
  amount = coalesce(amount, 0),
  currency = coalesce(currency, 'CNY'),
  type = coalesce(type, 'expense'),
  category = coalesce(category, '未分类'),
  merchant = coalesce(merchant, ''),
  account = coalesce(account, ''),
  payment_method = coalesce(payment_method, ''),
  note = coalesce(note, ''),
  raw_text = coalesce(raw_text, ''),
  source = coalesce(source, 'chatgpt'),
  created_at = coalesce(created_at, now()),
  updated_at = coalesce(updated_at, now()),
  deleted_reason = coalesce(deleted_reason, '');

alter table public.transactions
  alter column occurred_at set not null,
  alter column amount set not null,
  alter column currency set not null,
  alter column currency set default 'CNY',
  alter column type set not null,
  alter column type set default 'expense',
  alter column category set not null,
  alter column category set default '未分类',
  alter column merchant set not null,
  alter column merchant set default '',
  alter column account set not null,
  alter column account set default '',
  alter column payment_method set not null,
  alter column payment_method set default '',
  alter column note set not null,
  alter column note set default '',
  alter column raw_text set not null,
  alter column raw_text set default '',
  alter column source set not null,
  alter column source set default 'chatgpt',
  alter column created_at set not null,
  alter column created_at set default now(),
  alter column updated_at set not null,
  alter column updated_at set default now(),
  alter column deleted_reason set default '';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'transactions_type_check'
      and conrelid = 'public.transactions'::regclass
  ) then
    alter table public.transactions
      add constraint transactions_type_check
      check (type in ('expense', 'income', 'transfer'));
  end if;
end $$;

create index if not exists transactions_occurred_at_idx
  on public.transactions (occurred_at desc, created_at desc);

create index if not exists transactions_deleted_at_idx
  on public.transactions (deleted_at);

alter table public.transactions enable row level security;

drop policy if exists "ledger anon can read transactions" on public.transactions;
create policy "ledger anon can read transactions"
  on public.transactions
  for select
  to anon
  using (true);

drop policy if exists "ledger anon can insert transactions" on public.transactions;
create policy "ledger anon can insert transactions"
  on public.transactions
  for insert
  to anon
  with check (source = 'chatgpt');

drop policy if exists "ledger anon can update transactions" on public.transactions;
create policy "ledger anon can update transactions"
  on public.transactions
  for update
  to anon
  using (source = 'chatgpt')
  with check (source = 'chatgpt');
