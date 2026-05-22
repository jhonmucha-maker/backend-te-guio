-- Configuracion del sistema de actualizacion forzada del aplicativo Android.
-- Idempotente: ON CONFLICT (clave) DO NOTHING permite reejecuciones seguras.
-- IMPORTANTE: android_min_version_code arranca en '1' para NO bloquear a la
-- version 1.0 (versionCode 1) ya publicada en Play Store. El admin debera
-- subir este valor manualmente cuando quiera forzar la actualizacion.

INSERT INTO tbl_configuracion_sistema (clave, valor, descripcion, id_usuario_registro)
VALUES
  ('android_min_version_code', '1', 'versionCode minimo permitido. APKs con versionCode menor seran bloqueados al abrir la app.', 1),
  ('android_latest_version_code', '1', 'Ultimo versionCode disponible en Play Store (informativo, no bloqueante).', 1),
  ('android_latest_version_name', '1.0', 'Ultimo versionName disponible en Play Store (ej: 1.1, 1.2, 2.0), mostrado al usuario.', 1),
  ('android_force_update_enabled', 'true', 'Activa o desactiva el sistema de actualizacion forzada. Poner "false" en emergencias para desbloquear instantaneamente a todos los usuarios.', 1),
  ('android_play_store_url', 'https://play.google.com/store/apps/details?id=com.teguio.app', 'URL de la app en Play Store que abre el boton "Actualizar ahora".', 1),
  ('android_update_title', 'Actualizacion requerida', 'Titulo mostrado en el modal de actualizacion forzada.', 1),
  ('android_update_message', 'Hay una nueva version disponible. Para seguir usando Te Guio, por favor actualizala desde Play Store.', 'Mensaje mostrado en el modal de actualizacion forzada.', 1)
ON CONFLICT (clave) DO NOTHING;
