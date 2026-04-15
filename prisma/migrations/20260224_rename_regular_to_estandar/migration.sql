-- Renombrar tipo de plan REGULAR a ESTANDAR en todas las tablas relevantes
UPDATE tbl_planes SET tipo = 'ESTANDAR' WHERE tipo = 'REGULAR';
UPDATE tbl_suscripciones_activas SET tipo_plan = 'ESTANDAR' WHERE tipo_plan = 'REGULAR';
UPDATE tbl_solicitudes_suscripcion SET tipo_plan_solicitado = 'ESTANDAR' WHERE tipo_plan_solicitado = 'REGULAR';
