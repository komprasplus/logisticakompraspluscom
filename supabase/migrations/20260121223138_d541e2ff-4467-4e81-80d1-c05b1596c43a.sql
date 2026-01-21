-- Create table for motorizado location history
CREATE TABLE public.location_history (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    motorizado_id UUID NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    accuracy DOUBLE PRECISION,
    speed DOUBLE PRECISION,
    heading DOUBLE PRECISION,
    recorded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for efficient querying
CREATE INDEX idx_location_history_motorizado_id ON public.location_history(motorizado_id);
CREATE INDEX idx_location_history_recorded_at ON public.location_history(recorded_at DESC);
CREATE INDEX idx_location_history_motorizado_date ON public.location_history(motorizado_id, recorded_at);

-- Enable Row Level Security
ALTER TABLE public.location_history ENABLE ROW LEVEL SECURITY;

-- Admins can view all location history
CREATE POLICY "Admins can view all location history"
ON public.location_history
FOR SELECT
USING (is_admin());

-- Admins can insert location history
CREATE POLICY "Admins can manage location history"
ON public.location_history
FOR ALL
USING (is_admin());

-- Motorizados can view their own location history
CREATE POLICY "Motorizados can view own location history"
ON public.location_history
FOR SELECT
USING (has_role(auth.uid(), 'motorizado') AND motorizado_id = auth.uid());

-- Motorizados can insert their own location history
CREATE POLICY "Motorizados can insert own location history"
ON public.location_history
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'motorizado') AND motorizado_id = auth.uid());

-- Add comment for documentation
COMMENT ON TABLE public.location_history IS 'Stores GPS location history for motorizados for route tracking and auditing';