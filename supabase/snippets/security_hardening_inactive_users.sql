-- ==============================================================================
-- SCRIPT DE SEGURIDAD EN BASE DE DATOS Y AUTENTICACIÓN (SUPABASE / POSTGRESQL)
-- FREIGHT TRACKING SUITE — BLINDAJE DE CUENTAS Y EMPRESAS INACTIVAS
-- ==============================================================================
-- Este script se ejecuta en el SQL Editor del panel de Supabase.
-- Realiza 3 acciones críticas de seguridad:
-- 1. Triggers automáticos para suspender/reactivar cuentas en auth.users (banned_until)
--    al cambiar el estado en public.profiles o public.companies.
-- 2. Función de seguridad RLS: public.is_active_user()
-- 3. Actualización de políticas RLS en shipments, documents y updates.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. FUNCIÓN Y TRIGGER: Sincronizar estado de PERFILES con auth.users
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_profile_status_to_auth()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- Si el perfil pasa a inactivo, suspender en auth.users (revoca tokens y bloquea login)
  IF NEW.status = 'inactive' AND (OLD.status IS DISTINCT FROM 'inactive') THEN
    UPDATE auth.users
    SET banned_until = '2099-12-31 23:59:59+00'
    WHERE id = NEW.id;
  
  -- Si el perfil se reactiva (restauración desde papelera), levantar suspensión
  ELSIF NEW.status = 'active' AND (OLD.status IS DISTINCT FROM 'active') THEN
    -- Solo reactivar si no pertenece a una empresa inactiva
    IF NEW.company_id IS NULL OR EXISTS (
      SELECT 1 FROM public.companies WHERE id = NEW.company_id AND (status IS NULL OR status = 'active')
    ) THEN
      UPDATE auth.users
      SET banned_until = NULL
      WHERE id = NEW.id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_profile_status_to_auth ON public.profiles;
CREATE TRIGGER trg_sync_profile_status_to_auth
AFTER UPDATE OF status ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.sync_profile_status_to_auth();


-- ------------------------------------------------------------------------------
-- 2. FUNCIÓN Y TRIGGER: Sincronizar estado de EMPRESAS con auth.users
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_company_status_to_auth()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- Si la empresa pasa a inactiva (papelera), suspender a todos sus miembros en auth.users
  IF NEW.status = 'inactive' AND (OLD.status IS DISTINCT FROM 'inactive') THEN
    UPDATE auth.users
    SET banned_until = '2099-12-31 23:59:59+00'
    WHERE id IN (
      SELECT id FROM public.profiles WHERE company_id = NEW.id
    );

  -- Si la empresa se reactiva, levantar suspensión solo a los miembros que tengan status = 'active'
  ELSIF NEW.status = 'active' AND (OLD.status IS DISTINCT FROM 'active') THEN
    UPDATE auth.users
    SET banned_until = NULL
    WHERE id IN (
      SELECT id FROM public.profiles WHERE company_id = NEW.id AND (status IS NULL OR status = 'active')
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_company_status_to_auth ON public.companies;
CREATE TRIGGER trg_sync_company_status_to_auth
AFTER UPDATE OF status ON public.companies
FOR EACH ROW
EXECUTE FUNCTION public.sync_company_status_to_auth();


-- ------------------------------------------------------------------------------
-- 3. FUNCIÓN DE SEGURIDAD RLS: is_active_user()
-- ------------------------------------------------------------------------------
-- Permite verificar a nivel de política si el usuario actual que realiza la
-- petición está activo y si la empresa a la que pertenece también está activa.
CREATE OR REPLACE FUNCTION public.is_active_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.profiles p
    LEFT JOIN public.companies c ON c.id = p.company_id
    WHERE p.id = auth.uid()
      AND (p.status IS NULL OR p.status = 'active')
      AND (p.company_id IS NULL OR c.status IS NULL OR c.status = 'active')
  );
$$;


-- ------------------------------------------------------------------------------
-- 4. REFORZAR POLÍTICAS RLS EN SHIPMENTS (CARGAS)
-- ------------------------------------------------------------------------------
-- Cargas asignadas por empresa: exige que el usuario y su empresa estén activos
ALTER POLICY "client_can_read_company_shipments" ON "public"."shipments"
  USING (
    public.is_active_user() AND
    EXISTS (
      SELECT 1 
      FROM public.company_shipment cs
      JOIN public.profiles p ON p.company_id = cs.company_id
      WHERE p.id = auth.uid() AND cs.shipment_id = shipments.id
    )
  );

-- Cargas asignadas directamente por perfil: exige que el usuario esté activo
ALTER POLICY "client_can_read_shipments" ON "public"."shipments"
  USING (
    public.is_active_user() AND
    EXISTS (
      SELECT 1 
      FROM public.profile_shipment ps
      WHERE ps.shipment_id = shipments.id AND ps.client_id = auth.uid()
    )
  );


-- ------------------------------------------------------------------------------
-- 5. REFORZAR POLÍTICAS RLS EN DOCUMENTS (DOCUMENTOS)
-- ------------------------------------------------------------------------------
ALTER POLICY "client_can_read_company_documents" ON "public"."documents"
  USING (
    public.is_active_user() AND
    ((is_deleted = false) OR (is_deleted IS NULL)) AND
    EXISTS (
      SELECT 1 
      FROM public.company_shipment cs
      JOIN public.profiles p ON p.company_id = cs.company_id
      WHERE p.id = auth.uid() AND cs.shipment_id = documents.shipment_id
    )
  );

ALTER POLICY "Users can see their shipments' documents" ON "public"."documents"
  USING (
    public.is_active_user() AND
    EXISTS (
      SELECT 1 
      FROM public.profile_shipment ps
      WHERE ps.shipment_id = documents.shipment_id 
        AND (ps.client_id = auth.uid() OR public.check_is_internal())
    )
  );


-- ------------------------------------------------------------------------------
-- 6. REFORZAR POLÍTICAS RLS EN SHIPMENT_UPDATES (NOVEDADES)
-- ------------------------------------------------------------------------------
ALTER POLICY "client_can_read_company_shipment_updates" ON "public"."shipment_updates"
  USING (
    public.is_active_user() AND
    EXISTS (
      SELECT 1 
      FROM public.company_shipment cs
      JOIN public.profiles p ON p.company_id = cs.company_id
      WHERE p.id = auth.uid() AND cs.shipment_id = shipment_updates.shipment_id
    )
  );

ALTER POLICY "User can see theri shipments' updates" ON "public"."shipment_updates"
  USING (
    public.is_active_user() AND
    EXISTS (
      SELECT 1 
      FROM public.profile_shipment ps
      WHERE ps.shipment_id = shipment_updates.shipment_id 
        AND (ps.client_id = auth.uid() OR public.check_is_internal())
    )
  );
