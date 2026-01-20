-- Add motorizado_id column for proper UUID-based assignment
ALTER TABLE public.pedidos 
ADD COLUMN IF NOT EXISTS motorizado_id uuid REFERENCES auth.users(id);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_pedidos_motorizado_id ON public.pedidos(motorizado_id);

-- Drop old RLS policies for motorizados
DROP POLICY IF EXISTS "Motorizados view assigned orders" ON public.pedidos;
DROP POLICY IF EXISTS "Motorizados update assigned orders" ON public.pedidos;

-- Create new RLS policy for motorizados to VIEW their orders (no date restriction)
CREATE POLICY "Motorizados view assigned orders" 
ON public.pedidos 
FOR SELECT 
USING (
  has_role(auth.uid(), 'motorizado') 
  AND motorizado_id = auth.uid()
);

-- Create new RLS policy for motorizados to UPDATE their orders
CREATE POLICY "Motorizados update assigned orders" 
ON public.pedidos 
FOR UPDATE 
USING (
  has_role(auth.uid(), 'motorizado') 
  AND motorizado_id = auth.uid()
)
WITH CHECK (
  has_role(auth.uid(), 'motorizado') 
  AND motorizado_id = auth.uid()
);

-- Migrate existing data: Update motorizado_id based on motorizado_asignado name
UPDATE public.pedidos p
SET motorizado_id = pr.user_id
FROM public.profiles pr
WHERE p.motorizado_asignado = pr.full_name
  AND p.motorizado_id IS NULL;