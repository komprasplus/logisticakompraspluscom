
-- Table: user_payment_methods
CREATE TABLE public.user_payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  bank_name text,
  account_type text CHECK (account_type IN ('Ahorros', 'Corriente')),
  account_number text,
  bre_b_key text,
  key_type text CHECK (key_type IN ('Celular', 'Email', 'NIT')),
  is_primary boolean NOT NULL DEFAULT false,
  method_type text NOT NULL DEFAULT 'bank' CHECK (method_type IN ('bank', 'breb')),
  organizacion_id uuid DEFAULT 'a0000000-0000-0000-0000-000000000001'::uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_payment_methods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own payment methods"
  ON public.user_payment_methods FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own payment methods"
  ON public.user_payment_methods FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own payment methods"
  ON public.user_payment_methods FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own payment methods"
  ON public.user_payment_methods FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins full access to user_payment_methods"
  ON public.user_payment_methods FOR ALL
  USING (is_admin());

CREATE TRIGGER update_user_payment_methods_updated_at
  BEFORE UPDATE ON public.user_payment_methods
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Table: withdrawal_requests
CREATE TABLE public.withdrawal_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  payment_method_id uuid REFERENCES public.user_payment_methods(id) ON DELETE SET NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  status text NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Rejected')),
  requested_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  admin_notes text,
  organizacion_id uuid DEFAULT 'a0000000-0000-0000-0000-000000000001'::uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own withdrawal requests"
  ON public.withdrawal_requests FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own withdrawal requests"
  ON public.withdrawal_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins full access to withdrawal_requests"
  ON public.withdrawal_requests FOR ALL
  USING (is_admin());
