-- ============================================================
-- Run this in your Supabase SQL editor
-- ============================================================

-- 1. Add payment_method to orders
--    Values: 'hubtel' | 'cash' | 'momo'
--    Defaults to 'hubtel' for all existing + new online orders.
--    POS can override to 'cash' or 'momo' when locking in payment.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_method text NOT NULL DEFAULT 'hubtel';

-- 2. Create tellers table
CREATE TABLE public.tellers (
  id         serial PRIMARY KEY,
  email      text NOT NULL UNIQUE,
  name       text NOT NULL,
  branch_id  integer NOT NULL REFERENCES public.branches (id),
  is_active  boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);

-- 3. Add teller_id to orders (nullable — online orders won't have one)
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS teller_id integer REFERENCES public.tellers (id);
