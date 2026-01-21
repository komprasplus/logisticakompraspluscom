-- Create api_credentials table for storing client API keys
CREATE TABLE public.api_credentials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_user_id UUID NOT NULL,
  api_key_hash TEXT NOT NULL,
  api_key_prefix TEXT NOT NULL,
  label TEXT DEFAULT 'Mi Tienda',
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.api_credentials ENABLE ROW LEVEL SECURITY;

-- Clients can view their own credentials
CREATE POLICY "Clients can view their own API credentials"
ON public.api_credentials
FOR SELECT
USING (has_role(auth.uid(), 'cliente') AND client_user_id = auth.uid());

-- Clients can insert their own credentials
CREATE POLICY "Clients can create their own API credentials"
ON public.api_credentials
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'cliente') AND client_user_id = auth.uid());

-- Clients can update their own credentials
CREATE POLICY "Clients can update their own API credentials"
ON public.api_credentials
FOR UPDATE
USING (has_role(auth.uid(), 'cliente') AND client_user_id = auth.uid());

-- Clients can delete their own credentials
CREATE POLICY "Clients can delete their own API credentials"
ON public.api_credentials
FOR DELETE
USING (has_role(auth.uid(), 'cliente') AND client_user_id = auth.uid());

-- Admins full access
CREATE POLICY "Admins full access to api_credentials"
ON public.api_credentials
FOR ALL
USING (is_admin());

-- Add trigger for updated_at
CREATE TRIGGER update_api_credentials_updated_at
BEFORE UPDATE ON public.api_credentials
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster lookups
CREATE INDEX idx_api_credentials_client ON public.api_credentials(client_user_id);
CREATE INDEX idx_api_credentials_prefix ON public.api_credentials(api_key_prefix);