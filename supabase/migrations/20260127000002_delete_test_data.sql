-- Simplified Deletion Script for TEST Data
-- Based on verification, only these two tables are impacted.

-- 1. Delete matching records from shopping_list first
-- (Using a join to ensure we catch anything tied to the TEST items)
DELETE FROM shopping_list 
WHERE household_code = 'TEST' 
   OR item_id IN (SELECT id FROM items WHERE household_code = 'TEST');

-- 2. Delete the TEST items
DELETE FROM items 
WHERE household_code = 'TEST';
