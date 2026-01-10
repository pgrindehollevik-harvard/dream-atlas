-- Profiles table extends Supabase auth.users
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  display_name text,
  bio text,
  is_public_profile boolean not null default false,
  created_at timestamptz not null default now()
);

-- Dreams table
create type public.dream_visibility as enum ('private', 'unlisted', 'public');

create table if not exists public.dreams (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  slug text not null unique,
  title text not null,
  description text,
  dream_date date not null,
  visibility public.dream_visibility not null default 'private',
  image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists dreams_user_id_idx on public.dreams (user_id, dream_date desc);

-- Per-dream summaries
create table if not exists public.dream_summaries (
  id uuid primary key default gen_random_uuid(),
  dream_id uuid not null references public.dreams(id) on delete cascade,
  summary_text text not null,
  interpretation_notes text,
  created_at timestamptz not null default now()
);

create index if not exists dream_summaries_dream_id_idx on public.dream_summaries (dream_id);

-- Aggregate summaries over a period
create table if not exists public.user_aggregate_summaries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  summary_text text not null,
  created_at timestamptz not null default now()
);

create index if not exists user_aggregate_summaries_user_id_idx
  on public.user_aggregate_summaries (user_id, period_start, period_end);

-- Enable Row Level Security
alter table public.profiles enable row level security;
alter table public.dreams enable row level security;
alter table public.dream_summaries enable row level security;
alter table public.user_aggregate_summaries enable row level security;

-- Profiles policies
create policy "profiles_select_own_or_public"
  on public.profiles
  for select
  using (
    auth.uid() = id
    or is_public_profile = true
  );

create policy "profiles_insert_own"
  on public.profiles
  for insert
  with check (auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Dreams policies
create policy "dreams_owner_full_access"
  on public.dreams
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "dreams_public_read"
  on public.dreams
  for select
  using (visibility = 'public');

create policy "dreams_unlisted_read_by_slug"
  on public.dreams
  for select
  using (visibility = 'unlisted');

-- Dream summaries: only owners and AI processes (service role) should touch
create policy "dream_summaries_owner_read"
  on public.dream_summaries
  for select
  using (
    exists (
      select 1
      from public.dreams d
      where d.id = dream_id
        and d.user_id = auth.uid()
    )
  );

create policy "dream_summaries_owner_write"
  on public.dream_summaries
  for all
  using (
    exists (
      select 1
      from public.dreams d
      where d.id = dream_id
        and d.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.dreams d
      where d.id = dream_id
        and d.user_id = auth.uid()
    )
  );

-- Aggregate summaries: owner only
create policy "aggregate_summaries_owner_only"
  on public.user_aggregate_summaries
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Chat sessions for dream pattern conversations
create table if not exists public.dream_chat_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  period_start date,
  period_end date,
  created_at timestamptz not null default now()
);

create table if not exists public.dream_chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.dream_chat_sessions(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

alter table public.dream_chat_sessions enable row level security;
alter table public.dream_chat_messages enable row level security;

create policy "chat_sessions_owner_only"
  on public.dream_chat_sessions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "chat_messages_owner_only"
  on public.dream_chat_messages
  for all
  using (
    exists (
      select 1
      from public.dream_chat_sessions s
      where s.id = session_id
        and s.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.dream_chat_sessions s
      where s.id = session_id
        and s.user_id = auth.uid()
    )
  );


