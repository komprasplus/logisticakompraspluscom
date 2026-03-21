
-- 1. Add transaction_pin to profiles (hashed PIN for P2P transfers)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS transaction_pin TEXT DEFAULT NULL;

-- 2. Create RPC for atomic P2P transfers
CREATE OR REPLACE FUNCTION public.transfer_store_balance(
  p_sender_id UUID,
  p_receiver_email TEXT,
  p_transfer_amount NUMERIC,
  p_provided_pin TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_sender_pin TEXT;
  v_sender_org UUID;
  v_receiver_id UUID;
  v_receiver_org UUID;
  v_receiver_name TEXT;
  v_sender_name TEXT;
  v_sender_balance NUMERIC;
  v_creditos NUMERIC;
  v_pagos NUMERIC;
  v_retiros NUMERIC;
  v_transfers_out NUMERIC;
BEGIN
  -- Validate caller is the sender
  IF auth.uid() != p_sender_id THEN
    RAISE EXCEPTION 'No autorizado: solo puedes transferir desde tu propia cuenta';
  END IF;

  -- Validate amount
  IF p_transfer_amount <= 0 THEN
    RAISE EXCEPTION 'El monto debe ser mayor a 0';
  END IF;

  IF p_transfer_amount < 1000 THEN
    RAISE EXCEPTION 'El monto mínimo de transferencia es $1,000';
  END IF;

  -- Get sender info and PIN
  SELECT transaction_pin, organizacion_id, full_name
  INTO v_sender_pin, v_sender_org, v_sender_name
  FROM profiles WHERE user_id = p_sender_id;

  IF v_sender_pin IS NULL THEN
    RAISE EXCEPTION 'Debes configurar tu PIN de seguridad antes de transferir';
  END IF;

  -- Verify PIN (stored as plain text hash comparison via crypt would be ideal,
  -- but for simplicity we compare directly - PIN is already hashed client-side with SHA-256)
  IF v_sender_pin != p_provided_pin THEN
    RAISE EXCEPTION 'PIN incorrecto';
  END IF;

  -- Find receiver by email
  SELECT p.user_id, p.organizacion_id, p.full_name
  INTO v_receiver_id, v_receiver_org, v_receiver_name
  FROM profiles p
  INNER JOIN user_roles ur ON ur.user_id = p.user_id AND ur.role = 'cliente'
  WHERE p.email = LOWER(TRIM(p_receiver_email))
    AND p.organizacion_id = v_sender_org
  LIMIT 1;

  IF v_receiver_id IS NULL THEN
    RAISE EXCEPTION 'No se encontró una tienda con ese correo en tu organización';
  END IF;

  IF v_receiver_id = p_sender_id THEN
    RAISE EXCEPTION 'No puedes transferir a tu propia cuenta';
  END IF;

  -- Calculate sender balance
  SELECT COALESCE(SUM(monto), 0) INTO v_creditos
  FROM transacciones_billetera
  WHERE client_user_id = p_sender_id
    AND organizacion_id = v_sender_org
    AND tipo = 'CREDITO_ENTREGA';

  SELECT COALESCE(SUM(monto), 0) INTO v_pagos
  FROM transacciones_billetera
  WHERE client_user_id = p_sender_id
    AND organizacion_id = v_sender_org
    AND tipo = 'PAGO_TIENDA';

  SELECT COALESCE(SUM(amount), 0) INTO v_retiros
  FROM withdrawal_requests
  WHERE user_id = p_sender_id
    AND status IN ('Approved', 'Pending');

  SELECT COALESCE(SUM(monto), 0) INTO v_transfers_out
  FROM transacciones_billetera
  WHERE client_user_id = p_sender_id
    AND organizacion_id = v_sender_org
    AND tipo = 'TRANSFER_OUT';

  v_sender_balance := v_creditos - v_pagos - v_retiros - v_transfers_out;

  -- Also add incoming transfers
  v_sender_balance := v_sender_balance + COALESCE((
    SELECT SUM(monto) FROM transacciones_billetera
    WHERE client_user_id = p_sender_id
      AND organizacion_id = v_sender_org
      AND tipo = 'TRANSFER_IN'
  ), 0);

  IF v_sender_balance < p_transfer_amount THEN
    RAISE EXCEPTION 'Fondos insuficientes. Saldo disponible: $%', TRIM(TO_CHAR(v_sender_balance, '999,999,999'));
  END IF;

  -- ATOMIC: Insert both ledger entries
  INSERT INTO transacciones_billetera (
    client_user_id, organizacion_id, pedido_id, tipo, monto, concepto,
    metadata, saldo_anterior, saldo_nuevo, notas
  ) VALUES (
    p_sender_id, v_sender_org, NULL, 'TRANSFER_OUT', p_transfer_amount,
    'Transferencia a ' || v_receiver_name || ' (' || p_receiver_email || ')',
    jsonb_build_object(
      'transfer_type', 'P2P',
      'receiver_id', v_receiver_id,
      'receiver_email', p_receiver_email,
      'receiver_name', v_receiver_name,
      'timestamp_colombia', TO_CHAR(TIMEZONE('America/Bogota', NOW()), 'YYYY-MM-DD HH24:MI:SS')
    ),
    0, 0, 'Transferencia P2P enviada'
  );

  INSERT INTO transacciones_billetera (
    client_user_id, organizacion_id, pedido_id, tipo, monto, concepto,
    metadata, saldo_anterior, saldo_nuevo, notas
  ) VALUES (
    v_receiver_id, v_receiver_org, NULL, 'TRANSFER_IN', p_transfer_amount,
    'Transferencia de ' || v_sender_name,
    jsonb_build_object(
      'transfer_type', 'P2P',
      'sender_id', p_sender_id,
      'sender_name', v_sender_name,
      'timestamp_colombia', TO_CHAR(TIMEZONE('America/Bogota', NOW()), 'YYYY-MM-DD HH24:MI:SS')
    ),
    0, 0, 'Transferencia P2P recibida'
  );

  -- Notify receiver
  INSERT INTO user_notifications (user_id, message, type, metadata, organizacion_id)
  VALUES (
    v_receiver_id,
    'Recibiste una transferencia de $' || TRIM(TO_CHAR(p_transfer_amount, '999,999,999')) || ' de ' || v_sender_name,
    'info',
    jsonb_build_object('sender_id', p_sender_id, 'amount', p_transfer_amount),
    v_receiver_org
  );

  RETURN jsonb_build_object(
    'success', true,
    'receiver_name', v_receiver_name,
    'amount', p_transfer_amount,
    'timestamp', TO_CHAR(TIMEZONE('America/Bogota', NOW()), 'YYYY-MM-DD HH24:MI:SS')
  );
END;
$$;
