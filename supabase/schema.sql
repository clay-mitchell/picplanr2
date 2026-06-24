
create extension if not exists pgcrypto;

create table if not exists public.social_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  provider text not null check (provider in ('instagram','linkedin','tiktok')),
  provider_account_id text,
  provider_account_name text,
  encrypted_access_token text,
  token_expires_at timestamptz,
  status text not null default 'connected',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.scheduled_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  local_id text,
  social_connection_id uuid references public.social_connections(id) on delete set null,
  platform text not null,
  title text,
  caption text not null,
  media_url text not null,
  post_format text,
  media_type text not null default 'image' check (media_type in ('image','video','carousel')),
  scheduled_for timestamptz not null,
  status text not null default 'draft'
    check (status in ('draft','approved','scheduled','publishing','published','needs_attention','cancelled')),
  provider_post_id text,
  published_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.publish_attempts (
  id uuid primary key default gen_random_uuid(),
  scheduled_post_id uuid not null references public.scheduled_posts(id) on delete cascade,
  attempted_at timestamptz not null default now(),
  successful boolean not null default false,
  provider_response jsonb,
  error_message text
);

alter table public.social_connections enable row level security;
alter table public.scheduled_posts enable row level security;
alter table public.publish_attempts enable row level security;

-- Add authenticated-user policies after Supabase Auth is connected.

create index if not exists social_connections_provider_idx on public.social_connections(provider);
