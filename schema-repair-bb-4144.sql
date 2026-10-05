-- Repair BB-4144: add 2 missing Lilac drinks (GH₵40 each = GH₵80)
-- Run in Supabase SQL editor: https://supabase.com/dashboard/project/mbiondfdctmivfvpdpzo/sql
--
-- Before: 3 items, GH₵140 line total, order total GH₵220, 2 cups
-- After:  5 items, GH₵220 line total, order total GH₵220, 4 cups

INSERT INTO order_items (
  order_id,
  product_id,
  variant_id,
  product_name,
  variant_label,
  unit_pesewas,
  quantity,
  sugar_level
)
VALUES
  (4144, 8, NULL, 'Lilac', NULL, 4000, 1, '50%'),
  (4144, 8, NULL, 'Lilac', NULL, 4000, 1, '50%');

-- Verify repair
SELECT
  o.order_number,
  o.total_pesewas / 100.0 AS total_ghs,
  COALESCE(SUM(oi.unit_pesewas * oi.quantity), 0) / 100.0 AS items_ghs,
  COUNT(oi.id) AS item_count
FROM orders o
JOIN order_items oi ON oi.order_id = o.id
WHERE o.id = 4144
GROUP BY o.id, o.order_number, o.total_pesewas;
