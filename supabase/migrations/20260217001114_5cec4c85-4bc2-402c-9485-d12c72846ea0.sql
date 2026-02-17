
-- Add Bold-compliant columns to user_payment_methods
ALTER TABLE public.user_payment_methods
  ADD COLUMN IF NOT EXISTS recipient_doc_type text,
  ADD COLUMN IF NOT EXISTS recipient_doc_number text,
  ADD COLUMN IF NOT EXISTS recipient_name text,
  ADD COLUMN IF NOT EXISTS payment_mode text NOT NULL DEFAULT 'BANK_ACCOUNT';

-- Migrate existing data: map old method_type to new payment_mode
UPDATE public.user_payment_methods 
SET payment_mode = CASE 
  WHEN method_type = 'bank' THEN 'BANK_ACCOUNT'
  WHEN method_type = 'breb' THEN 'KEY'
  ELSE 'BANK_ACCOUNT'
END;

-- Migrate bre_b_key to a more generic column name approach
-- We'll keep bre_b_key as key_value alias via the app layer
-- No need to rename columns, just use bre_b_key as key_value in the app

-- Update account_number max length constraint is handled at app level (max 17 chars)
-- Update account_type values will be handled at app level ('Cuenta de ahorros', 'Cuenta corriente', 'Depósito electrónico')
