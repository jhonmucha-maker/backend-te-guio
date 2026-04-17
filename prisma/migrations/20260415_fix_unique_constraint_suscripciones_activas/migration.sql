-- Fix: Restaurar constraint UNIQUE en id_tienda de tbl_suscripciones_activas
-- Requerido por el upsert de aprobación de suscripciones (adminController.js)

-- Primero eliminar duplicados si existen (conservar el más reciente por tienda)
DELETE FROM "public"."tbl_suscripciones_activas" a
USING "public"."tbl_suscripciones_activas" b
WHERE a.id_tienda = b.id_tienda
  AND a.id < b.id;

-- Crear el índice único solo si no existe
CREATE UNIQUE INDEX IF NOT EXISTS "tbl_suscripciones_activas_id_tienda_key"
ON "public"."tbl_suscripciones_activas"("id_tienda");
