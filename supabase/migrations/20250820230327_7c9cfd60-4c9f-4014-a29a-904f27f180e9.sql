-- Clear existing data
DELETE FROM sales;
DELETE FROM products;

-- Modify sales table to support multiple products and fulfillment
ALTER TABLE sales 
DROP COLUMN product_id,
DROP COLUMN quantity,
DROP COLUMN unit_price,
DROP COLUMN total_amount;

ALTER TABLE sales 
ADD COLUMN customer_name TEXT NOT NULL DEFAULT '',
ADD COLUMN status TEXT NOT NULL DEFAULT 'not_fulfilled' CHECK (status IN ('not_fulfilled', 'fulfilled')),
ADD COLUMN total_amount NUMERIC NOT NULL DEFAULT 0;

-- Create sale_items table for multiple products per sale
CREATE TABLE public.sale_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL,
  unit_price NUMERIC NOT NULL,
  subtotal NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on sale_items
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for sale_items
CREATE POLICY "Allow all operations on sale_items" 
ON public.sale_items 
FOR ALL 
USING (true);

-- Re-insert products
INSERT INTO products (name, price, cost, stock) VALUES
('Keto Molde', 6900, 4050, 20),
('Keto Redondito', 6900, 4050, 20);

-- Update stock function to work with sale_items
CREATE OR REPLACE FUNCTION public.update_stock_on_sale_item()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Update stock by subtracting the sold quantity
  UPDATE public.products 
  SET stock = stock - NEW.quantity,
      updated_at = now()
  WHERE id = NEW.product_id;
  
  -- Check if stock goes negative
  IF (SELECT stock FROM public.products WHERE id = NEW.product_id) < 0 THEN
    RAISE EXCEPTION 'Insufficient stock for product';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for sale_items
CREATE TRIGGER update_stock_on_sale_item_trigger
  AFTER INSERT ON public.sale_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_stock_on_sale_item();