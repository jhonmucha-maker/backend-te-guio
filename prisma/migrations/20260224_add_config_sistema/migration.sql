CREATE TABLE tbl_configuracion_sistema (
  id SERIAL PRIMARY KEY,
  clave VARCHAR(100) UNIQUE NOT NULL,
  valor VARCHAR(500) NOT NULL,
  descripcion VARCHAR(500),
  id_usuario_registro INT,
  fecha_hora_registro TIMESTAMPTZ DEFAULT NOW(),
  id_usuario_modificacion INT,
  fecha_hora_modificacion TIMESTAMPTZ
);

INSERT INTO tbl_configuracion_sistema (clave, valor, descripcion, id_usuario_registro)
VALUES ('dias_alerta_vencimiento_suscripcion', '7', 'Dias de anticipacion para enviar alerta de vencimiento de suscripcion', 1);
