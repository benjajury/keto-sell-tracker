-- Remove the old trigger that's causing the error
DROP TRIGGER IF EXISTS update_stock_on_sale_trigger ON public.sales;