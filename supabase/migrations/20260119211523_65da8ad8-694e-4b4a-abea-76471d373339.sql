-- Add store_name column to profiles for client users
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS store_name TEXT;