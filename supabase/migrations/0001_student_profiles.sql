-- Student profiles: which Cambridge syllabuses each student is enrolled in.
--
-- This table IS protected by RLS, unlike Mastra's own tables. Mastra connects
-- as the owning role via DATABASE_URL and would bypass RLS anyway; this table
-- is read and written through the Supabase client using the user's JWT, so the
-- policies below are the real access control.

create extension if not exists vector;

create table if not exists public.student_profiles (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  -- Cambridge syllabus codes the student is taking, e.g. {'0625','9709'}.
  -- Retrieval is filtered to these, so an empty array means unrestricted search.
  syllabus_codes text[] not null default '{}',
  qualification  text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.student_profiles enable row level security;

-- Each student sees and edits only their own row.
drop policy if exists "read own profile" on public.student_profiles;
create policy "read own profile"
  on public.student_profiles for select
  using ((select auth.uid()) = user_id);

drop policy if exists "insert own profile" on public.student_profiles;
create policy "insert own profile"
  on public.student_profiles for insert
  with check ((select auth.uid()) = user_id);

drop policy if exists "update own profile" on public.student_profiles;
create policy "update own profile"
  on public.student_profiles for update
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Create the profile row automatically on signup so the app never has to
-- handle a missing profile for a valid session.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.student_profiles (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
