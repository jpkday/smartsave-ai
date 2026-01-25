-- Add Snacks category with ID 11
INSERT INTO categories (id, name, color, sort_order) 
VALUES (11, 'Snacks', 'bg-purple-50 border-purple-200 text-purple-700', 100)
ON CONFLICT (id) DO UPDATE SET 
  name = EXCLUDED.name, 
  color = EXCLUDED.color, 
  sort_order = EXCLUDED.sort_order;
