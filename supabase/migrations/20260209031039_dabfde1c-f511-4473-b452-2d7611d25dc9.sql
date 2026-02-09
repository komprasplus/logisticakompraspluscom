
-- Agregar super_admin al enum app_role
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'super_admin';
