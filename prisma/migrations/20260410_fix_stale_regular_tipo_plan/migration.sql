-- Fix: Corregir valores residuales 'REGULAR' que no fueron alcanzados por la migración 20260224
-- Causa raíz: Solicitudes/suscripciones con tipo_plan='REGULAR' (valor legacy pre-rename)
-- Afectadas: 8 solicitudes y sus suscripciones activas correspondientes
UPDATE tbl_suscripciones_activas SET tipo_plan = 'ESTANDAR' WHERE tipo_plan = 'REGULAR';
UPDATE tbl_solicitudes_suscripcion SET tipo_plan_solicitado = 'ESTANDAR' WHERE tipo_plan_solicitado = 'REGULAR';
