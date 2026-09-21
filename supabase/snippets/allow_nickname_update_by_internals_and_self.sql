-- ==============================================================================
-- SCRIPT DE SEGURIDAD RLS EN SUPABASE / POSTGRESQL
-- ACTUALIZACIÓN DE NICKNAMES Y PERFILES
-- ==============================================================================
-- Objetivo:
-- Permitir que el nickname (y datos de perfil) pueda ser modificado por:
-- 1. Un usuario interno (is_internal = true) sobre cualquier perfil.
-- 2. El propio usuario autenticado sobre su propio registro (auth.uid() = id).
-- ==============================================================================

-- 1. Función para validar si el usuario autenticado es interno de forma segura
CREATE OR REPLACE FUNCTION public.check_is_internal()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN (
    SELECT COALESCE(is_internal, false)
    FROM public.profiles 
    WHERE id = auth.uid()
  );
END;
$$;

-- 2. Otorgar permisos de ejecución para la función
GRANT EXECUTE ON FUNCTION public.check_is_internal() TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_is_internal() TO service_role;

-- 3. Reemplazar la política de UPDATE en public.profiles
DROP POLICY IF EXISTS "Internal users can update profiles" ON "public"."profiles";
DROP POLICY IF EXISTS "Users and internals can update profiles" ON "public"."profiles";

CREATE POLICY "Users and internals can update profiles" ON "public"."profiles"
FOR UPDATE TO "authenticated"
USING (
  (auth.uid() = id) OR public.check_is_internal()
)
WITH CHECK (
  (
    -- Los usuarios internos pueden actualizar cualquier perfil
    public.check_is_internal()
  )
  OR
  (
    -- El propio usuario puede actualizar su propio perfil (sin auto-otorgarse permisos de interno)
    (auth.uid() = id) AND (is_internal = false)
  )
);
