-- Add thumbnail_url column to dreams table for storing extracted video frames
alter table public.dreams
  add column if not exists thumbnail_url text;

