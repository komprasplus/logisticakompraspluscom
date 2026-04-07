
-- ╔══════════════════════════════════════════════════════════════════╗
-- ║  Multi-tenant isolation for secondary modules                   ║
-- ╚══════════════════════════════════════════════════════════════════╝

-- ─── 1. INVENTORY ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins full access to inventory" ON public.inventory;

CREATE POLICY "Super admins full access to inventory"
  ON public.inventory FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE POLICY "Admins can manage own org inventory"
  ON public.inventory FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    AND organizacion_id = public.get_user_org_id()
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    AND organizacion_id = public.get_user_org_id()
  );

-- ─── 2. WITHDRAWAL_REQUESTS ──────────────────────────────────────
DROP POLICY IF EXISTS "Admins full access to withdrawal_requests" ON public.withdrawal_requests;

CREATE POLICY "Super admins full access to withdrawal_requests"
  ON public.withdrawal_requests FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE POLICY "Admins can manage own org withdrawal_requests"
  ON public.withdrawal_requests FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    AND organizacion_id = public.get_user_org_id()
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    AND organizacion_id = public.get_user_org_id()
  );

-- ─── 3. ADMIN_WALLET_LEDGER ──────────────────────────────────────
DROP POLICY IF EXISTS "Admins can view admin_wallet_ledger" ON public.admin_wallet_ledger;

CREATE POLICY "Super admins can view all admin_wallet_ledger"
  ON public.admin_wallet_ledger FOR SELECT TO authenticated
  USING (public.is_super_admin());

CREATE POLICY "Admins can view own org admin_wallet_ledger"
  ON public.admin_wallet_ledger FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    AND organizacion_id = public.get_user_org_id()
  );

-- ─── 4. API_CREDENTIALS ──────────────────────────────────────────
DROP POLICY IF EXISTS "Admins full access to api_credentials" ON public.api_credentials;

CREATE POLICY "Super admins full access to api_credentials"
  ON public.api_credentials FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE POLICY "Admins can manage own org api_credentials"
  ON public.api_credentials FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    AND organizacion_id = public.get_user_org_id()
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    AND organizacion_id = public.get_user_org_id()
  );

-- ─── 5. WEBHOOK_ENDPOINTS ────────────────────────────────────────
DROP POLICY IF EXISTS "Admins full access to webhook_endpoints" ON public.webhook_endpoints;

CREATE POLICY "Super admins full access to webhook_endpoints"
  ON public.webhook_endpoints FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE POLICY "Admins can manage own org webhook_endpoints"
  ON public.webhook_endpoints FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    AND organizacion_id = public.get_user_org_id()
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    AND organizacion_id = public.get_user_org_id()
  );

-- ─── 6. API_LOGS ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins can view all api logs" ON public.api_logs;

CREATE POLICY "Super admins can view all api_logs"
  ON public.api_logs FOR ALL TO authenticated
  USING (public.is_super_admin());

CREATE POLICY "Admins can view own org api_logs"
  ON public.api_logs FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    AND (credential_id IN (
      SELECT id FROM public.api_credentials
      WHERE organizacion_id = public.get_user_org_id()
    ))
  );
