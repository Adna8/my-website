-- Smart Shelf: Database upgrade script
-- Safe to run multiple times (uses IF NOT EXISTS)

-- Extensions for performance and search
create extension if not exists pg_trgm;
create extension if not exists pgcrypto;

-- Profiles: basic user profile linked by user_id (uuid)
create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique,
  full_name text,
  created_at timestamp with time zone default now()
);

-- Books: core catalog
create table if not exists public.books (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  author text,
  isbn text,
  shelf_location text,
  tags text[],
  created_at timestamp with time zone default now()
);
-- Ensure 'tags' column exists if the table pre-existed without it
alter table public.books add column if not exists tags text[];

-- Loans: track borrowing
create table if not exists public.loans (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books(id) on delete cascade,
  user_id uuid not null,
  status text default 'borrowed', -- borrowed | returned | late
  due_date date,
  returned_at timestamp with time zone,
  created_at timestamp with time zone default now()
);

-- Conversations: chat threads
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  language text check (language in ('ar','en')) default 'ar',
  created_at timestamp with time zone default now()
);

-- Messages: chat messages
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  role text check (role in ('system','user','assistant')) not null,
  content text not null,
  created_at timestamp with time zone default now()
);

-- Chat logs: edge function logging (optional)
create table if not exists public.chat_logs (
  id bigint generated always as identity primary key,
  conversation_id uuid,
  user_id uuid,
  language text,
  request jsonb,
  response jsonb,
  created_at timestamp with time zone default now()
);

-- Voice logs: store transcription stubs (optional)
create table if not exists public.voice_logs (
  id bigint generated always as identity primary key,
  audio_url text,
  transcript text,
  language text,
  created_at timestamp with time zone default now()
);

-- Indexes for performance
create index if not exists idx_books_title_trgm on public.books using gin (title gin_trgm_ops);
create index if not exists idx_books_author_trgm on public.books using gin (author gin_trgm_ops);
create index if not exists idx_books_tags_gin on public.books using gin (tags);

create index if not exists idx_messages_conv_created_at on public.messages (conversation_id, created_at);
create index if not exists idx_loans_user_status on public.loans (user_id, status);

-- Simple search function (speed + relevance)
create or replace function public.search_books(q text)
returns setof public.books
language sql stable
as $$
  select *
  from public.books
  where q is null
     or title ilike '%' || q || '%'
     or author ilike '%' || q || '%'
     or (tags is not null and array_to_string(tags, ',') ilike '%' || q || '%')
  order by
    greatest(
      similarity(title, q),
      similarity(author, q)
    ) desc nulls last,
    created_at desc
  limit 50;
$$;

-- RLS (keep it simple)
alter table public.books enable row level security;
alter table public.loans enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.chat_logs enable row level security;
alter table public.voice_logs enable row level security;

-- Policies (Postgres does not support IF NOT EXISTS for CREATE POLICY)
-- We use DO blocks to create policies only when missing.

-- Books: readable by everyone (anon)
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'books' and policyname = 'books_read_all'
  ) then
    create policy books_read_all on public.books
      for select using (true);
  end if;
end $$;

-- Loans: users can see their own and insert new
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'loans' and policyname = 'loans_select_own'
  ) then
    create policy loans_select_own on public.loans
      for select using (auth.uid() = user_id);
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'loans' and policyname = 'loans_insert_own'
  ) then
    create policy loans_insert_own on public.loans
      for insert with check (auth.uid() = user_id);
  end if;
end $$;

-- Conversations: user-owned
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'conversations' and policyname = 'conv_select_own'
  ) then
    create policy conv_select_own on public.conversations
      for select using (auth.uid() = user_id);
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'conversations' and policyname = 'conv_insert_own'
  ) then
    create policy conv_insert_own on public.conversations
      for insert with check (auth.uid() = user_id);
  end if;
end $$;

-- Messages: tied to owned conversations
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'messages' and policyname = 'messages_select_own'
  ) then
    create policy messages_select_own on public.messages
      for select using (
        exists (
          select 1 from public.conversations c
          where c.id = conversation_id and c.user_id = auth.uid()
        )
      );
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'messages' and policyname = 'messages_insert_own'
  ) then
    create policy messages_insert_own on public.messages
      for insert with check (
        exists (
          select 1 from public.conversations c
          where c.id = conversation_id and c.user_id = auth.uid()
        )
      );
  end if;
end $$;

-- Logs: readable by authenticated; inserts from edge function via service role (bypass RLS)
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'chat_logs' and policyname = 'chat_logs_read_auth'
  ) then
    create policy chat_logs_read_auth on public.chat_logs
      for select using (auth.uid() is not null);
  end if;
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'voice_logs' and policyname = 'voice_logs_read_auth'
  ) then
    create policy voice_logs_read_auth on public.voice_logs
      for select using (auth.uid() is not null);
  end if;
end $$;

-- Grants (keep simple)
grant select on public.books to anon, authenticated;
grant select on public.conversations to authenticated;
grant select on public.messages to authenticated;
grant select on public.loans to authenticated;
grant select on public.chat_logs to authenticated;
grant select on public.voice_logs to authenticated;

-- End of upgrade