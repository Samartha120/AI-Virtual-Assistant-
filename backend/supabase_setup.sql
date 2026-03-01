-- ─────────────────────────────────────────────────────────────────
-- NexusAI Enterprise OS — Supabase Database Schema v2
-- Run this in your Supabase project SQL Editor
-- ─────────────────────────────────────────────────────────────────

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ─── 1. Profiles (linked to Supabase Auth) ───────────────────────
create table if not exists public.profiles (
  id uuid references auth.users not null primary key,
  email text,
  full_name text,
  avatar_url text,
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- ─── 2. Chat Messages ────────────────────────────────────────────
create table if not exists public.chat_messages (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users not null,
  role text check (role in ('user', 'assistant', 'system')) not null,
  content text not null,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- ─── 3. Settings ─────────────────────────────────────────────────
create table if not exists public.settings (
  user_id uuid references auth.users not null primary key,
  theme text default 'dark',
  ai_mode text default 'gemini',
  ai_model text default 'gemini-1.5-flash',
  notifications boolean default true,
  language text default 'en',
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- ─── 4. Tasks (Task Board) ────────────────────────────────────────
create table if not exists public.tasks (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users not null,
  title text not null,
  description text default '',
  status text default 'todo' check (status in ('todo', 'in_progress', 'done')),
  priority text default 'medium' check (priority in ('low', 'medium', 'high')),
  due_date date,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- ─── 5. Knowledge Base ───────────────────────────────────────────
create table if not exists public.knowledge_base (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users not null,
  title text not null,
  content text not null,
  tags text[] default '{}',
  created_at timestamp with time zone default timezone('utc'::text, now()),
  updated_at timestamp with time zone default timezone('utc'::text, now())
);

-- ─── Row Level Security (RLS) ────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.chat_messages enable row level security;
alter table public.settings enable row level security;
alter table public.tasks enable row level security;
alter table public.knowledge_base enable row level security;

-- Profiles
create policy "Users can view own profile" on public.profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);
create policy "Users can insert own profile" on public.profiles for insert with check (auth.uid() = id);

-- Chat Messages
create policy "Users can view own messages" on public.chat_messages for select using (auth.uid() = user_id);
create policy "Users can insert own messages" on public.chat_messages for insert with check (auth.uid() = user_id);
create policy "Users can delete own messages" on public.chat_messages for delete using (auth.uid() = user_id);

-- Settings
create policy "Users can view own settings" on public.settings for select using (auth.uid() = user_id);
create policy "Users can upsert own settings" on public.settings for all using (auth.uid() = user_id);

-- Tasks
create policy "Users can manage own tasks" on public.tasks for all using (auth.uid() = user_id);

-- Knowledge Base
create policy "Users can manage own knowledge" on public.knowledge_base for all using (auth.uid() = user_id);

-- ─── Storage Buckets ─────────────────────────────────────────────
-- Run in Supabase Dashboard > Storage > New Bucket (name: "documents", public: false)
-- OR uncomment below:
-- insert into storage.buckets (id, name, public) values ('documents', 'documents', false);
-- create policy "Auth users can upload documents" on storage.objects
--   for insert with check (bucket_id = 'documents' and auth.role() = 'authenticated');
-- create policy "Users can view own documents" on storage.objects
--   for select using (bucket_id = 'documents' and auth.uid()::text = (storage.foldername(name))[1]);
