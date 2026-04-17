-- Asegurar que el UNIQUE INDEX en tbl_dispositivos_push exista.
-- La migración inicial lo incluía, pero en producción no se aplicó
-- (causaba error 42P10 en prisma.upsert con clave compuesta).
-- Usamos IF NOT EXISTS para que sea idempotente en cualquier entorno.

CREATE UNIQUE INDEX IF NOT EXISTS "tbl_dispositivos_push_id_usuario_token_dispositivo_key"
  ON "public"."tbl_dispositivos_push" ("id_usuario", "token_dispositivo");
