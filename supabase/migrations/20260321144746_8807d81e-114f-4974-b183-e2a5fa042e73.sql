
-- 1. Reconciliation batches table
CREATE TABLE IF NOT EXISTS public.reconciliation_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename TEXT NOT NULL,
  total_records INTEGER NOT NULL DEFAULT 0,
  successful_records INTEGER NOT NULL DEFAULT 0,
  failed_records INTEGER NOT NULL DEFAULT 0,
  uploaded_by UUID REFERENCES auth.users(id),
  organizacion_id UUID DEFAULT 'a0000000-0000-0000-0000-000000000001'::uuid,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.reconciliation_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins full access reconciliation_batches"
  ON public.reconciliation_batches FOR ALL
  USING (public.is_admin());

-- 2. User notifications table
CREATE TABLE IF NOT EXISTS public.user_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info',
  is_read BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB,
  organizacion_id UUID DEFAULT 'a0000000-0000-0000-0000-000000000001'::uuid,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
  ON public.user_notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
  ON public.user_notifications FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins full access user_notifications"
  ON public.user_notifications FOR ALL
  USING (public.is_admin());

CREATE INDEX idx_user_notifications_user ON public.user_notifications(user_id, is_read);
CREATE INDEX idx_reconciliation_batches_created ON public.reconciliation_batches(created_at DESC);

-- 3. RPC function for atomic reconciliation processing
CREATE OR REPLACE FUNCTION public.process_bold_reconciliation(
  p_filename TEXT,
  p_records JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_total INT := 0;
  v_success INT := 0;
  v_failed INT := 0;
  v_record JSONB;
  v_ref TEXT;
  v_status TEXT;
  v_reason TEXT;
  v_withdrawal_id UUID;
  v_withdrawal_user UUID;
  v_batch_id UUID;
BEGIN
  -- Only admins can run this
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acceso denegado: solo administradores';
  END IF;

  -- Iterate through each record in the JSON array
  FOR v_record IN SELECT * FROM jsonb_array_elements(p_records)
  LOOP
    v_total := v_total + 1;
    v_ref := v_record->>'reference_id';
    v_status := UPPER(v_record->>'status');
    v_reason := v_record->>'reason';

    -- Skip if no reference
    IF v_ref IS NULL OR v_ref = '' THEN
      v_failed := v_failed + 1;
      CONTINUE;
    END IF;

    -- Find the withdrawal request by ID (reference_id = withdrawal_requests.id)
    SELECT id, user_id INTO v_withdrawal_id, v_withdrawal_user
    FROM public.withdrawal_requests
    WHERE id::text = v_ref OR id::text = LEFT(v_ref, 36)
    LIMIT 1;

    IF v_withdrawal_id IS NULL THEN
      v_failed := v_failed + 1;
      CONTINUE;
    END IF;

    IF v_status IN ('EXITOSO', 'APROBADO', 'SUCCESSFUL', 'PAID', 'OK') THEN
      -- Mark as paid
      UPDATE public.withdrawal_requests
      SET status = 'Paid', processed_at = NOW(),
          admin_notes = COALESCE(admin_notes, '') || ' | Bold: EXITOSO ' || TO_CHAR(NOW(), 'YYYY-MM-DD')
      WHERE id = v_withdrawal_id AND status = 'Pending';

      v_success := v_success + 1;

    ELSIF v_status IN ('RECHAZADO', 'FALLIDO', 'REJECTED', 'FAILED', 'ERROR') THEN
      -- Mark as rejected
      UPDATE public.withdrawal_requests
      SET status = 'Rejected', processed_at = NOW(),
          admin_notes = COALESCE(admin_notes, '') || ' | Bold: RECHAZADO - ' || COALESCE(v_reason, 'Sin detalle') || ' ' || TO_CHAR(NOW(), 'YYYY-MM-DD')
      WHERE id = v_withdrawal_id;

      -- Create notification for the store owner
      IF v_withdrawal_user IS NOT NULL THEN
        INSERT INTO public.user_notifications (user_id, message, type, metadata)
        VALUES (
          v_withdrawal_user,
          'Tu retiro fue rechazado por el banco: ' || COALESCE(v_reason, 'Cuenta inválida') || '. Por favor actualiza tu método de pago.',
          'warning',
          jsonb_build_object(
            'withdrawal_id', v_withdrawal_id,
            'reason', v_reason,
            'batch_filename', p_filename
          )
        );
      END IF;

      v_failed := v_failed + 1;
    ELSE
      v_failed := v_failed + 1;
    END IF;
  END LOOP;

  -- Insert batch summary
  INSERT INTO public.reconciliation_batches (filename, total_records, successful_records, failed_records, uploaded_by)
  VALUES (p_filename, v_total, v_success, v_failed, auth.uid())
  RETURNING id INTO v_batch_id;

  RETURN jsonb_build_object(
    'batch_id', v_batch_id,
    'total', v_total,
    'successful', v_success,
    'failed', v_failed,
    'timestamp', TO_CHAR(TIMEZONE('America/Bogota', NOW()), 'YYYY-MM-DD HH24:MI:SS')
  );
END;
$$;
