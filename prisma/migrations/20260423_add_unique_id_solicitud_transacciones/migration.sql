-- Idempotencia en aprobacion de suscripciones (Opcion A).
-- Garantiza que cada solicitud aprobada produzca una unica transaccion,
-- impidiendo duplicados por doble click u otras condiciones de carrera.
--
-- Pre-requisito: ejecutar la limpieza de duplicados antes de aplicar este constraint.
-- Auditoria 2026-04-23: 0 duplicados, 0 NULLs en id_solicitud (3 filas totales).
--
-- Usa IF NOT EXISTS para que sea idempotente en cualquier entorno
-- (dev, staging, produccion) y no falle al re-aplicarse.

CREATE UNIQUE INDEX IF NOT EXISTS "tbl_transacciones_suscripcion_id_solicitud_key"
  ON "public"."tbl_transacciones_suscripcion" ("id_solicitud");
