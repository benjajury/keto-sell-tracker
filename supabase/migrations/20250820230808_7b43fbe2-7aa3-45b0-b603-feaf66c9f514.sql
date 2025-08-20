-- Check if the old function is still being used and remove it
DROP FUNCTION IF EXISTS public.update_stock_on_sale() CASCADE;

-- Also check for any remaining triggers on the sales table
SELECT trigger_name, event_object_table, action_statement 
FROM information_schema.triggers 
WHERE event_object_table = 'sales' AND trigger_schema = 'public';