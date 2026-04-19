-- ============================================================
-- Run this in your Supabase SQL editor
-- ============================================================

-- 1. Add email column to branches
ALTER TABLE public.branches
  ADD COLUMN IF NOT EXISTS email text;

-- Set branch emails (update these to your real addresses)
UPDATE public.branches SET email = 'accra@bubbleblisscafe.com'     WHERE slug = 'accra';
UPDATE public.branches SET email = 'capecoast@bubbleblisscafe.com' WHERE slug = 'cape-coast';

-- ============================================================
-- 2. POS Users table
-- ============================================================

CREATE TABLE public.pos_users (
  id        serial PRIMARY KEY,
  email     text NOT NULL UNIQUE,
  name      text,
  branch_id integer NOT NULL REFERENCES public.branches (id),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);

-- Seed the two branch POS accounts
INSERT INTO public.pos_users (email, name, branch_id) VALUES
  ('pos.accra@bubbleblisscafe.com',      'Accra POS',      1),
  ('pos.capecoast@bubbleblisscafe.com',  'Cape Coast POS', 2);
