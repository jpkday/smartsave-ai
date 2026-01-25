-- Add/Update Snacks category with ID 11
-- Using Pink to distinguish it from Dairy (Purple)
INSERT INTO categories (id, name, color, sort_order) 
VALUES (11, 'Snacks', 'bg-pink-50 border-pink-200 text-pink-700', 100)
ON CONFLICT (id) DO UPDATE SET 
  name = EXCLUDED.name, 
  color = EXCLUDED.color, 
  sort_order = EXCLUDED.sort_order;
