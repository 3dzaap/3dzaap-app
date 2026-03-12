-- 3DZAAP foundation sprint
-- Multi-tenant core + plans + subscriptions + settings

create extension if not exists pgcrypto;

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  logo_url text,
  primary_color text,
  created_at timestamptz not null default now()
);

create table if not exists public.memberships (
  user_id uuid not null,
  company_id uuid not null references public.companies(id) on delete cascade,
  role text not null check (role in ('owner','admin','member')),
  created_at timestamptz not null default now(),
  primary key (user_id, company_id)
);

create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug in ('trial','starter','pro','business')),
  name text not null,
  monthly_price_cents integer not null default 0,
  currency text not null default 'eur',
  created_at timestamptz not null default now()
);

create table if not exists public.plan_features (
  plan_slug text not null references public.plans(slug) on delete cascade,
  feature_key text not null check (feature_key in ('calculator','filaments','orders','financial','branding')),
  primary key (plan_slug, feature_key)
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null unique references public.companies(id) on delete cascade,
  plan_slug text not null references public.plans(slug),
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  status text not null default 'trialing',
  trial_ends_at timestamptz,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.settings (
  company_id uuid primary key references public.companies(id) on delete cascade,
  company_display_name text,
  logo_url text,
  theme_primary_color text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_subscriptions_updated_at
before update on public.subscriptions
for each row execute function public.set_updated_at();

create trigger set_settings_updated_at
before update on public.settings
for each row execute function public.set_updated_at();

insert into public.plans (slug, name, monthly_price_cents, currency)
values
  ('trial', 'Teste', 0, 'eur'),
  ('starter', 'Starter', 1900, 'eur'),
  ('pro', 'Pro', 3900, 'eur'),
  ('business', 'Business', 7900, 'eur')
on conflict (slug) do update set
  name = excluded.name,
  monthly_price_cents = excluded.monthly_price_cents,
  currency = excluded.currency;

insert into public.plan_features (plan_slug, feature_key)
values
  ('trial', 'calculator'),
  ('trial', 'filaments'),
  ('trial', 'orders'),
  ('trial', 'financial'),
  ('trial', 'branding'),
  ('starter', 'calculator'),
  ('starter', 'filaments'),
  ('pro', 'calculator'),
  ('pro', 'filaments'),
  ('pro', 'orders'),
  ('business', 'calculator'),
  ('business', 'filaments'),
  ('business', 'orders'),
  ('business', 'financial'),
  ('business', 'branding')
on conflict do nothing;

alter table public.companies enable row level security;
alter table public.memberships enable row level security;
alter table public.subscriptions enable row level security;
alter table public.settings enable row level security;

create or replace function public.current_company_ids()
returns setof uuid
language sql
security definer
set search_path = public
as $$
  select m.company_id
  from public.memberships m
  where m.user_id = auth.uid();
$$;

create policy "members can read their companies"
on public.companies
for select
using (id in (select public.current_company_ids()));

create policy "members can read memberships"
on public.memberships
for select
using (company_id in (select public.current_company_ids()));

create policy "members can read subscriptions"
on public.subscriptions
for select
using (company_id in (select public.current_company_ids()));

create policy "members can read settings"
on public.settings
for select
using (company_id in (select public.current_company_ids()));

create policy "owners and admins can update settings"
on public.settings
for update
using (
  company_id in (
    select company_id from public.memberships where user_id = auth.uid() and role in ('owner', 'admin')
  )
)
with check (
  company_id in (
    select company_id from public.memberships where user_id = auth.uid() and role in ('owner', 'admin')
  )
);
