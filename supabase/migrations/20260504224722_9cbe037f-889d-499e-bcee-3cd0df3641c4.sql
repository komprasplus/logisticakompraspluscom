-- Add estado_aprobacion column to profiles for the approval gate
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS estado_aprobacion TEXT NOT NULL DEFAULT 'pendiente';

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_estado_aprobacion_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_estado_aprobacion_check
  CHECK (estado_aprobacion IN ('pendiente','aprobado','rechazado'));

-- Backfill existing users as approved so we don't lock current users out
UPDATE public.profiles
  SET estado_aprobacion = 'aprobado'
  WHERE estado_aprobacion = 'pendiente'
    AND created_at < NOW();

CREATE INDEX IF NOT EXISTS idx_profiles_estado_aprobacion
  ON public.profiles(estado_aprobacion);