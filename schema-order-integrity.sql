-- Optional integrity hardening for order totals.
-- Run in Supabase SQL editor after reviewing on staging.
--
-- Confirms CASCADE deletes for checkout rollback safety.
ALTER TABLE public.order_items
  DROP CONSTRAINT IF EXISTS order_items_order_id_fkey;

ALTER TABLE public.order_items
  ADD CONSTRAINT order_items_order_id_fkey
  FOREIGN KEY (order_id) REFERENCES public.orders (id) ON DELETE CASCADE;

ALTER TABLE public.order_item_toppings
  DROP CONSTRAINT IF EXISTS order_item_toppings_order_item_id_fkey;

ALTER TABLE public.order_item_toppings
  ADD CONSTRAINT order_item_toppings_order_item_id_fkey
  FOREIGN KEY (order_item_id) REFERENCES public.order_items (id) ON DELETE CASCADE;

-- Daily integrity check (run manually or via cron):
-- SELECT order_number, total_pesewas,
--   (SELECT COALESCE(SUM(oi.unit_pesewas * oi.quantity), 0)
--      + COALESCE(SUM(
--          (SELECT COALESCE(SUM(t.price_applied_pesewas), 0)
--           FROM order_item_toppings t WHERE t.order_item_id = oi.id) * oi.quantity
--        ), 0)
--    FROM order_items oi WHERE oi.order_id = o.id) AS computed_total
-- FROM orders o
-- WHERE total_pesewas <> computed_total;
