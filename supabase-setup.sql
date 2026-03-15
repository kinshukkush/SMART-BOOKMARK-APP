-- Run this in Supabase SQL Editor

create table bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  url text not null,
  created_at timestamptz default now() not null
);

alter table bookmarks enable row level security;

create policy "Users can view own bookmarks"
  on bookmarks for select
  using (auth.uid() = user_id);

create policy "Users can insert own bookmarks"
  on bookmarks for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own bookmarks"
  on bookmarks for delete
  using (auth.uid() = user_id);

create policy "Users can update own bookmarks"
  on bookmarks for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- UI OVERHAUL & PINNING AND CATEGORIES MIGRATIONS
ALTER TABLE bookmarks ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT '';
ALTER TABLE bookmarks ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'General';
ALTER TABLE bookmarks ADD COLUMN IF NOT EXISTS pinned BOOLEAN DEFAULT FALSE;
ALTER TABLE bookmarks ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE bookmarks ALTER COLUMN url DROP NOT NULL;
