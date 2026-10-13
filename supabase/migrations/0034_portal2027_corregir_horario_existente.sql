-- Portal2027: compatibilidad de horario antiguo con las etapas 2 y 3.
-- Ejecutar DESPUÉS de 0032 y 0033. No borra registros.
BEGIN;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='portal2027_horario' AND column_name='dia_semana')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='portal2027_horario' AND column_name='dia') THEN
    ALTER TABLE public.portal2027_horario RENAME COLUMN dia_semana TO dia;
  END IF;
END $$;
ALTER TABLE public.portal2027_horario ADD COLUMN IF NOT EXISTS anio_id uuid;
UPDATE public.portal2027_horario h SET anio_id = a.id
FROM public.portal2027_anios a WHERE a.anio = 2027 AND h.anio_id IS NULL;
-- Solo imponer NOT NULL si no quedan registros sin año.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.portal2027_horario WHERE anio_id IS NULL) THEN
    ALTER TABLE public.portal2027_horario ALTER COLUMN anio_id SET NOT NULL;
  END IF;
END $$;
ALTER TABLE public.portal2027_horario ALTER COLUMN bloque SET DEFAULT 1;
UPDATE public.portal2027_horario SET bloque=1 WHERE bloque IS NULL;
ALTER TABLE public.portal2027_horario ALTER COLUMN bloque SET NOT NULL;
COMMIT;
-- Ejecutar nuevamente el archivo 0032_portal2027_horario.sql para instalar
-- funciones, políticas y validaciones que faltaran en la tabla antigua.
-- Si 0032 devuelve un error de restricción existente, detenerse y compartirlo.
