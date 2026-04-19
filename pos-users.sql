-- ============================================================
-- POS Users table
-- Run this in your Supabase SQL editor
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
