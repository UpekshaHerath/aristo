-- Storage for images a student attaches to a question.
--
-- Private bucket, not public. These are photos of a student's own work - past
-- paper attempts, handwritten notes, sometimes a page with their name on it.
-- Reads go through a signed URL rather than a guessable public path.
--
-- The path convention is `{user_id}/{id}.{ext}`, and every policy below keys off
-- that first segment. Nothing enforces the convention except these policies:
-- an upload to someone else's folder is rejected rather than misfiled.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chat-images',
  'chat-images',
  false,
  -- 10 MB. A phone photo is 2-5 MB before the client downscales it, and the
  -- client sends a re-encoded JPEG well under 1 MB - this only catches an
  -- upload that skipped that path.
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "read own chat images" on storage.objects;
create policy "read own chat images"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'chat-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "upload own chat images" on storage.objects;
create policy "upload own chat images"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'chat-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "delete own chat images" on storage.objects;
create policy "delete own chat images"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'chat-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
