-- ============================================================
-- MARKETPLACE "TE GUIO" - Migracion inicial
-- Generado desde schema.prisma
-- ============================================================

-- ============================================================
-- 1. IDENTIDAD / AUTH / RBAC
-- ============================================================

-- CreateTable
CREATE TABLE "public"."tbl_roles" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR(50) NOT NULL,
    "descripcion" TEXT,
    "id_usuario_registro" INTEGER,
    "fecha_hora_registro" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "id_usuario_modificacion" INTEGER,
    "fecha_hora_modificacion" TIMESTAMPTZ(6),
    "estado" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "tbl_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."tbl_permisos" (
    "id" SERIAL NOT NULL,
    "codigo" VARCHAR(100) NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "descripcion" TEXT,
    "tipo" VARCHAR(50) NOT NULL,
    "recurso" VARCHAR(150),
    "id_usuario_registro" INTEGER,
    "fecha_hora_registro" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "id_usuario_modificacion" INTEGER,
    "fecha_hora_modificacion" TIMESTAMPTZ(6),
    "estado" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "tbl_permisos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."tbl_roles_permisos" (
    "id" SERIAL NOT NULL,
    "id_rol" INTEGER NOT NULL,
    "id_permiso" INTEGER NOT NULL,
    "id_usuario_registro" INTEGER,
    "fecha_hora_registro" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "id_usuario_modificacion" INTEGER,
    "fecha_hora_modificacion" TIMESTAMPTZ(6),
    "estado" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "tbl_roles_permisos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."tbl_usuarios" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR(150) NOT NULL,
    "correo" VARCHAR(150) NOT NULL,
    "telefono" VARCHAR(20),
    "contrasena" VARCHAR(255) NOT NULL,
    "id_rol" INTEGER NOT NULL,
    "id_ciudad" INTEGER,
    "correo_verificado" BOOLEAN NOT NULL DEFAULT false,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "ultimo_login" TIMESTAMPTZ(6),
    "eliminado_en" TIMESTAMPTZ(6),
    "id_usuario_registro" INTEGER,
    "fecha_hora_registro" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "id_usuario_modificacion" INTEGER,
    "fecha_hora_modificacion" TIMESTAMPTZ(6),

    CONSTRAINT "tbl_usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."tbl_tokens_refresco" (
    "id" SERIAL NOT NULL,
    "id_usuario" INTEGER NOT NULL,
    "token_hash" VARCHAR(500) NOT NULL,
    "expira_en" TIMESTAMPTZ(6) NOT NULL,
    "revocado_en" TIMESTAMPTZ(6),
    "user_agent" TEXT,
    "ip" VARCHAR(45),
    "fecha_hora_registro" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tbl_tokens_refresco_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."tbl_codigos_verificacion_email" (
    "id" SERIAL NOT NULL,
    "id_usuario" INTEGER NOT NULL,
    "codigo" CHAR(6) NOT NULL,
    "expira_en" TIMESTAMPTZ(6) NOT NULL,
    "intentos" INTEGER NOT NULL DEFAULT 0,
    "fecha_hora_registro" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tbl_codigos_verificacion_email_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."tbl_tokens_recuperacion" (
    "id" SERIAL NOT NULL,
    "id_usuario" INTEGER NOT NULL,
    "token_hash" VARCHAR(500) NOT NULL,
    "expira_en" TIMESTAMPTZ(6) NOT NULL,
    "usado_en" TIMESTAMPTZ(6),
    "fecha_hora_registro" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tbl_tokens_recuperacion_pkey" PRIMARY KEY ("id")
);

-- ============================================================
-- 2. UBICACION / CATALOGO
-- ============================================================

-- CreateTable
CREATE TABLE "public"."tbl_ciudades" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "eliminado_en" TIMESTAMPTZ(6),
    "id_usuario_registro" INTEGER,
    "fecha_hora_registro" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "id_usuario_modificacion" INTEGER,
    "fecha_hora_modificacion" TIMESTAMPTZ(6),

    CONSTRAINT "tbl_ciudades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."tbl_zonas" (
    "id" SERIAL NOT NULL,
    "id_ciudad" INTEGER NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "eliminado_en" TIMESTAMPTZ(6),
    "id_usuario_registro" INTEGER,
    "fecha_hora_registro" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "id_usuario_modificacion" INTEGER,
    "fecha_hora_modificacion" TIMESTAMPTZ(6),

    CONSTRAINT "tbl_zonas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."tbl_galerias" (
    "id" SERIAL NOT NULL,
    "id_ciudad" INTEGER NOT NULL,
    "id_zona" INTEGER NOT NULL,
    "nombre" VARCHAR(150) NOT NULL,
    "direccion" TEXT,
    "descripcion" TEXT,
    "latitud" DECIMAL(10,7),
    "longitud" DECIMAL(10,7),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "eliminado_en" TIMESTAMPTZ(6),
    "id_usuario_registro" INTEGER,
    "fecha_hora_registro" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "id_usuario_modificacion" INTEGER,
    "fecha_hora_modificacion" TIMESTAMPTZ(6),

    CONSTRAINT "tbl_galerias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."tbl_fotos_galerias" (
    "id" SERIAL NOT NULL,
    "id_galeria" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "posicion" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "tbl_fotos_galerias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."tbl_categorias" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "eliminado_en" TIMESTAMPTZ(6),
    "id_usuario_registro" INTEGER,
    "fecha_hora_registro" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "id_usuario_modificacion" INTEGER,
    "fecha_hora_modificacion" TIMESTAMPTZ(6),

    CONSTRAINT "tbl_categorias_pkey" PRIMARY KEY ("id")
);

-- ============================================================
-- 3. VENDEDOR / TIENDAS / PRODUCTOS
-- ============================================================

-- CreateTable
CREATE TABLE "public"."tbl_perfiles_vendedor" (
    "id" SERIAL NOT NULL,
    "id_usuario" INTEGER NOT NULL,
    "nombre_negocio" VARCHAR(150),
    "ruc" VARCHAR(20),
    "dni" VARCHAR(15),
    "direccion" TEXT,
    "estado_aprobacion" VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE',
    "motivo_rechazo" TEXT,
    "id_usuario_registro" INTEGER,
    "fecha_hora_registro" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "id_usuario_modificacion" INTEGER,
    "fecha_hora_modificacion" TIMESTAMPTZ(6),

    CONSTRAINT "tbl_perfiles_vendedor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."tbl_documentos_vendedor" (
    "id" SERIAL NOT NULL,
    "id_perfil_vendedor" INTEGER NOT NULL,
    "tipo" VARCHAR(20) NOT NULL,
    "url_archivo" TEXT NOT NULL,
    "id_usuario_registro" INTEGER,
    "fecha_hora_registro" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tbl_documentos_vendedor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."tbl_tiendas" (
    "id" SERIAL NOT NULL,
    "id_vendedor" INTEGER NOT NULL,
    "id_galeria" INTEGER NOT NULL,
    "nombre" VARCHAR(150) NOT NULL,
    "descripcion" TEXT,
    "direccion" TEXT,
    "latitud" DECIMAL(10,7),
    "longitud" DECIMAL(10,7),
    "horarios_json" JSONB,
    "redes_sociales_json" JSONB,
    "estado_aprobacion" VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE',
    "motivo_aprobacion" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "eliminado_en" TIMESTAMPTZ(6),
    "id_usuario_registro" INTEGER,
    "fecha_hora_registro" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "id_usuario_modificacion" INTEGER,
    "fecha_hora_modificacion" TIMESTAMPTZ(6),

    CONSTRAINT "tbl_tiendas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."tbl_fotos_tiendas" (
    "id" SERIAL NOT NULL,
    "id_tienda" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "posicion" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "tbl_fotos_tiendas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."tbl_productos" (
    "id" SERIAL NOT NULL,
    "id_tienda" INTEGER NOT NULL,
    "id_categoria" INTEGER NOT NULL,
    "nombre" VARCHAR(200) NOT NULL,
    "descripcion" TEXT,
    "precio" DECIMAL(10,2) NOT NULL,
    "moneda" VARCHAR(5) NOT NULL DEFAULT 'PEN',
    "precio_visible" BOOLEAN NOT NULL DEFAULT true,
    "estado_aprobacion" VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE',
    "motivo_aprobacion" TEXT,
    "estado" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    "eliminado_en" TIMESTAMPTZ(6),
    "id_usuario_registro" INTEGER,
    "fecha_hora_registro" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "id_usuario_modificacion" INTEGER,
    "fecha_hora_modificacion" TIMESTAMPTZ(6),

    CONSTRAINT "tbl_productos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."tbl_fotos_productos" (
    "id" SERIAL NOT NULL,
    "id_producto" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "posicion" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "tbl_fotos_productos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."tbl_historial_precios" (
    "id" SERIAL NOT NULL,
    "id_producto" INTEGER NOT NULL,
    "precio_anterior" DECIMAL(10,2) NOT NULL,
    "precio_nuevo" DECIMAL(10,2) NOT NULL,
    "cambiado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "id_usuario_cambio" INTEGER NOT NULL,

    CONSTRAINT "tbl_historial_precios_pkey" PRIMARY KEY ("id")
);

-- ============================================================
-- 4. FAVORITOS
-- ============================================================

-- CreateTable
CREATE TABLE "public"."tbl_favoritos_productos" (
    "id_comprador" INTEGER NOT NULL,
    "id_producto" INTEGER NOT NULL,
    "fecha_hora_registro" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tbl_favoritos_productos_pkey" PRIMARY KEY ("id_comprador","id_producto")
);

-- CreateTable
CREATE TABLE "public"."tbl_favoritos_tiendas" (
    "id_comprador" INTEGER NOT NULL,
    "id_tienda" INTEGER NOT NULL,
    "fecha_hora_registro" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tbl_favoritos_tiendas_pkey" PRIMARY KEY ("id_comprador","id_tienda")
);

-- ============================================================
-- 5. LISTA DE COMPRAS / HISTORIAL
-- ============================================================

-- CreateTable
CREATE TABLE "public"."tbl_listas_compras" (
    "id" SERIAL NOT NULL,
    "id_comprador" INTEGER NOT NULL,
    "estado" VARCHAR(20) NOT NULL DEFAULT 'OPEN',
    "abierta_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completada_en" TIMESTAMPTZ(6),
    "id_usuario_registro" INTEGER,
    "fecha_hora_registro" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tbl_listas_compras_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."tbl_items_lista_compras" (
    "id" SERIAL NOT NULL,
    "id_lista" INTEGER NOT NULL,
    "tipo" VARCHAR(10) NOT NULL,
    "id_producto" INTEGER,
    "texto_manual" TEXT,
    "cantidad" INTEGER NOT NULL DEFAULT 1,
    "comprado" BOOLEAN NOT NULL DEFAULT false,
    "comprado_en" TIMESTAMPTZ(6),
    "comentario" TEXT,
    "snapshot_precio" DECIMAL(10,2),
    "snapshot_id_tienda" INTEGER,
    "snapshot_id_galeria" INTEGER,
    "snapshot_id_zona" INTEGER,
    "snapshot_id_ciudad" INTEGER,
    "id_usuario_registro" INTEGER,
    "fecha_hora_registro" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tbl_items_lista_compras_pkey" PRIMARY KEY ("id")
);

-- ============================================================
-- 6. CALIFICACIONES
-- ============================================================

-- CreateTable
CREATE TABLE "public"."tbl_calificaciones_productos" (
    "id" SERIAL NOT NULL,
    "id_comprador" INTEGER NOT NULL,
    "id_producto" INTEGER NOT NULL,
    "estrellas" INTEGER NOT NULL,
    "comentario" TEXT,
    "calificado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "id_usuario_registro" INTEGER,
    "fecha_hora_registro" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tbl_calificaciones_productos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."tbl_calificaciones_tiendas" (
    "id" SERIAL NOT NULL,
    "id_comprador" INTEGER NOT NULL,
    "id_tienda" INTEGER NOT NULL,
    "estrellas" INTEGER NOT NULL,
    "comentario" TEXT,
    "calificado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "id_usuario_registro" INTEGER,
    "fecha_hora_registro" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tbl_calificaciones_tiendas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."tbl_agregados_cal_productos" (
    "id" SERIAL NOT NULL,
    "id_producto" INTEGER NOT NULL,
    "promedio" DECIMAL(3,2) NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL DEFAULT 0,
    "actualizado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tbl_agregados_cal_productos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."tbl_agregados_cal_tiendas" (
    "id" SERIAL NOT NULL,
    "id_tienda" INTEGER NOT NULL,
    "promedio" DECIMAL(3,2) NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL DEFAULT 0,
    "actualizado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tbl_agregados_cal_tiendas_pkey" PRIMARY KEY ("id")
);

-- ============================================================
-- 7. TICKETS (QUEJAS / SUGERENCIAS)
-- ============================================================

-- CreateTable
CREATE TABLE "public"."tbl_tickets" (
    "id" SERIAL NOT NULL,
    "tipo" VARCHAR(20) NOT NULL,
    "objetivo" VARCHAR(10) NOT NULL,
    "id_tienda" INTEGER,
    "asunto" VARCHAR(200) NOT NULL,
    "estado" VARCHAR(30) NOT NULL DEFAULT 'PENDIENTE',
    "ultimo_mensaje_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cerrado_por" VARCHAR(10),
    "motivo_cierre" VARCHAR(30),
    "nota_cierre" TEXT,
    "id_creador" INTEGER NOT NULL,
    "id_usuario_registro" INTEGER,
    "fecha_hora_registro" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "id_usuario_modificacion" INTEGER,
    "fecha_hora_modificacion" TIMESTAMPTZ(6),

    CONSTRAINT "tbl_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."tbl_participantes_tickets" (
    "id_ticket" INTEGER NOT NULL,
    "id_usuario" INTEGER NOT NULL,

    CONSTRAINT "tbl_participantes_tickets_pkey" PRIMARY KEY ("id_ticket","id_usuario")
);

-- CreateTable
CREATE TABLE "public"."tbl_mensajes_tickets" (
    "id" SERIAL NOT NULL,
    "id_ticket" INTEGER NOT NULL,
    "id_autor" INTEGER NOT NULL,
    "cuerpo" TEXT NOT NULL,
    "fecha_hora_registro" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tbl_mensajes_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."tbl_estados_lectura_tickets" (
    "id_ticket" INTEGER NOT NULL,
    "id_usuario" INTEGER NOT NULL,
    "ultima_lectura" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tbl_estados_lectura_tickets_pkey" PRIMARY KEY ("id_ticket","id_usuario")
);

-- ============================================================
-- 8. SUSCRIPCIONES / PAGOS
-- ============================================================

-- CreateTable
CREATE TABLE "public"."tbl_planes" (
    "id" SERIAL NOT NULL,
    "tipo" VARCHAR(20) NOT NULL,
    "precio" DECIMAL(10,2) NOT NULL,
    "moneda" VARCHAR(5) NOT NULL DEFAULT 'PEN',
    "duracion_dias" INTEGER NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "id_usuario_registro" INTEGER,
    "fecha_hora_registro" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "id_usuario_modificacion" INTEGER,
    "fecha_hora_modificacion" TIMESTAMPTZ(6),

    CONSTRAINT "tbl_planes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."tbl_metodos_pago" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "banco" VARCHAR(100),
    "titular" VARCHAR(150),
    "numero_cuenta" VARCHAR(50),
    "instrucciones" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "eliminado_en" TIMESTAMPTZ(6),
    "id_usuario_registro" INTEGER,
    "fecha_hora_registro" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "id_usuario_modificacion" INTEGER,
    "fecha_hora_modificacion" TIMESTAMPTZ(6),

    CONSTRAINT "tbl_metodos_pago_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."tbl_solicitudes_suscripcion" (
    "id" SERIAL NOT NULL,
    "id_tienda" INTEGER NOT NULL,
    "tipo_plan_solicitado" VARCHAR(20) NOT NULL,
    "id_metodo_pago" INTEGER NOT NULL,
    "estado" VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE',
    "motivo_rechazo" TEXT,
    "solicitado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidido_en" TIMESTAMPTZ(6),
    "id_vendedor" INTEGER NOT NULL,
    "id_usuario_registro" INTEGER,
    "fecha_hora_registro" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "id_usuario_modificacion" INTEGER,
    "fecha_hora_modificacion" TIMESTAMPTZ(6),

    CONSTRAINT "tbl_solicitudes_suscripcion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."tbl_archivos_solicitudes_suscripcion" (
    "id" SERIAL NOT NULL,
    "id_solicitud" INTEGER NOT NULL,
    "url_archivo" TEXT NOT NULL,
    "tipo_archivo" VARCHAR(10) NOT NULL,
    "tamano_bytes" INTEGER NOT NULL,

    CONSTRAINT "tbl_archivos_solicitudes_suscripcion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."tbl_suscripciones_activas" (
    "id" SERIAL NOT NULL,
    "id_tienda" INTEGER NOT NULL,
    "tipo_plan" VARCHAR(20) NOT NULL,
    "inicio_en" TIMESTAMPTZ(6) NOT NULL,
    "fin_en" TIMESTAMPTZ(6) NOT NULL,
    "estado" VARCHAR(10) NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "tbl_suscripciones_activas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."tbl_transacciones_suscripcion" (
    "id" SERIAL NOT NULL,
    "id_tienda" INTEGER NOT NULL,
    "id_solicitud" INTEGER,
    "monto" DECIMAL(10,2) NOT NULL,
    "id_metodo_pago" INTEGER NOT NULL,
    "pagado_en" TIMESTAMPTZ(6),
    "inicio_en" TIMESTAMPTZ(6) NOT NULL,
    "fin_en" TIMESTAMPTZ(6) NOT NULL,
    "estado" VARCHAR(10) NOT NULL DEFAULT 'ACTIVE',
    "fecha_hora_registro" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tbl_transacciones_suscripcion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."tbl_log_envio_email" (
    "id" SERIAL NOT NULL,
    "tipo" VARCHAR(30) NOT NULL,
    "id_vendedor" INTEGER NOT NULL,
    "fecha_envio" DATE NOT NULL,
    "payload_hash" VARCHAR(64),
    "fecha_hora_registro" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tbl_log_envio_email_pkey" PRIMARY KEY ("id")
);

-- ============================================================
-- 9. CONTENIDO LEGAL Y COMUNICACIONES
-- ============================================================

-- CreateTable
CREATE TABLE "public"."tbl_versiones_terminos" (
    "id" SERIAL NOT NULL,
    "numero_version" INTEGER NOT NULL,
    "titulo" VARCHAR(200) NOT NULL,
    "contenido" TEXT NOT NULL,
    "es_vigente" BOOLEAN NOT NULL DEFAULT false,
    "publicado_en" TIMESTAMPTZ(6),
    "fecha_hora_registro" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tbl_versiones_terminos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."tbl_versiones_privacidad" (
    "id" SERIAL NOT NULL,
    "numero_version" INTEGER NOT NULL,
    "titulo" VARCHAR(200) NOT NULL,
    "contenido" TEXT NOT NULL,
    "es_vigente" BOOLEAN NOT NULL DEFAULT false,
    "publicado_en" TIMESTAMPTZ(6),
    "fecha_hora_registro" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tbl_versiones_privacidad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."tbl_aceptaciones_terminos" (
    "id_usuario" INTEGER NOT NULL,
    "id_version_terminos" INTEGER NOT NULL,
    "aceptado_en" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tbl_aceptaciones_terminos_pkey" PRIMARY KEY ("id_usuario","id_version_terminos")
);

-- CreateTable
CREATE TABLE "public"."tbl_faqs" (
    "id" SERIAL NOT NULL,
    "pregunta" TEXT NOT NULL,
    "respuesta" TEXT NOT NULL,
    "audiencia" VARCHAR(20) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "eliminado_en" TIMESTAMPTZ(6),
    "id_usuario_registro" INTEGER,
    "fecha_hora_registro" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "id_usuario_modificacion" INTEGER,
    "fecha_hora_modificacion" TIMESTAMPTZ(6),

    CONSTRAINT "tbl_faqs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."tbl_plantillas_email" (
    "id" SERIAL NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "asunto_plantilla" VARCHAR(200) NOT NULL,
    "cuerpo_plantilla" TEXT NOT NULL,
    "variables_json" JSONB,
    "id_usuario_registro" INTEGER,
    "fecha_hora_registro" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "id_usuario_modificacion" INTEGER,
    "fecha_hora_modificacion" TIMESTAMPTZ(6),

    CONSTRAINT "tbl_plantillas_email_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."tbl_dispositivos_push" (
    "id" SERIAL NOT NULL,
    "id_usuario" INTEGER NOT NULL,
    "token_dispositivo" VARCHAR(500) NOT NULL,
    "plataforma" VARCHAR(10) NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "ultima_conexion" TIMESTAMPTZ(6),

    CONSTRAINT "tbl_dispositivos_push_pkey" PRIMARY KEY ("id")
);

-- ============================================================
-- 10. AUDITORIA
-- ============================================================

-- CreateTable
CREATE TABLE "public"."tbl_log_auditoria" (
    "id" SERIAL NOT NULL,
    "id_actor" INTEGER NOT NULL,
    "accion" VARCHAR(100) NOT NULL,
    "tipo_entidad" VARCHAR(50) NOT NULL,
    "id_entidad" INTEGER,
    "datos_antes" JSONB,
    "datos_despues" JSONB,
    "fecha_hora_registro" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tbl_log_auditoria_pkey" PRIMARY KEY ("id")
);

-- ============================================================
-- UNIQUE INDEXES
-- ============================================================

-- CreateIndex
CREATE UNIQUE INDEX "tbl_roles_nombre_key" ON "public"."tbl_roles"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "tbl_permisos_codigo_key" ON "public"."tbl_permisos"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "uq_rol_permiso" ON "public"."tbl_roles_permisos"("id_rol", "id_permiso");

-- CreateIndex
CREATE UNIQUE INDEX "tbl_usuarios_correo_key" ON "public"."tbl_usuarios"("correo");

-- CreateIndex
CREATE UNIQUE INDEX "tbl_perfiles_vendedor_id_usuario_key" ON "public"."tbl_perfiles_vendedor"("id_usuario");

-- CreateIndex
CREATE UNIQUE INDEX "tbl_agregados_cal_productos_id_producto_key" ON "public"."tbl_agregados_cal_productos"("id_producto");

-- CreateIndex
CREATE UNIQUE INDEX "tbl_agregados_cal_tiendas_id_tienda_key" ON "public"."tbl_agregados_cal_tiendas"("id_tienda");

-- CreateIndex
CREATE UNIQUE INDEX "tbl_archivos_solicitudes_suscripcion_id_solicitud_key" ON "public"."tbl_archivos_solicitudes_suscripcion"("id_solicitud");

-- CreateIndex
CREATE UNIQUE INDEX "tbl_suscripciones_activas_id_tienda_key" ON "public"."tbl_suscripciones_activas"("id_tienda");

-- CreateIndex
CREATE UNIQUE INDEX "tbl_log_envio_email_id_vendedor_tipo_fecha_envio_key" ON "public"."tbl_log_envio_email"("id_vendedor", "tipo", "fecha_envio");

-- CreateIndex
CREATE UNIQUE INDEX "tbl_plantillas_email_nombre_key" ON "public"."tbl_plantillas_email"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "tbl_dispositivos_push_id_usuario_token_dispositivo_key" ON "public"."tbl_dispositivos_push"("id_usuario", "token_dispositivo");

-- ============================================================
-- PERFORMANCE INDEXES
-- ============================================================

-- tbl_usuarios
CREATE INDEX "tbl_usuarios_correo_idx" ON "public"."tbl_usuarios"("correo");
CREATE INDEX "tbl_usuarios_id_rol_activo_idx" ON "public"."tbl_usuarios"("id_rol", "activo");
CREATE INDEX "tbl_usuarios_id_ciudad_idx" ON "public"."tbl_usuarios"("id_ciudad");

-- tbl_tokens_refresco
CREATE INDEX "tbl_tokens_refresco_id_usuario_idx" ON "public"."tbl_tokens_refresco"("id_usuario");
CREATE INDEX "tbl_tokens_refresco_expira_en_idx" ON "public"."tbl_tokens_refresco"("expira_en");

-- tbl_codigos_verificacion_email
CREATE INDEX "tbl_codigos_verificacion_email_id_usuario_idx" ON "public"."tbl_codigos_verificacion_email"("id_usuario");

-- tbl_tokens_recuperacion
CREATE INDEX "tbl_tokens_recuperacion_id_usuario_idx" ON "public"."tbl_tokens_recuperacion"("id_usuario");

-- tbl_zonas
CREATE INDEX "tbl_zonas_id_ciudad_idx" ON "public"."tbl_zonas"("id_ciudad");

-- tbl_galerias
CREATE INDEX "tbl_galerias_id_ciudad_id_zona_idx" ON "public"."tbl_galerias"("id_ciudad", "id_zona");

-- tbl_fotos_galerias
CREATE INDEX "tbl_fotos_galerias_id_galeria_idx" ON "public"."tbl_fotos_galerias"("id_galeria");

-- tbl_documentos_vendedor
CREATE INDEX "tbl_documentos_vendedor_id_perfil_vendedor_idx" ON "public"."tbl_documentos_vendedor"("id_perfil_vendedor");

-- tbl_tiendas
CREATE INDEX "tbl_tiendas_id_vendedor_idx" ON "public"."tbl_tiendas"("id_vendedor");
CREATE INDEX "tbl_tiendas_id_galeria_idx" ON "public"."tbl_tiendas"("id_galeria");
CREATE INDEX "tbl_tiendas_estado_aprobacion_activo_idx" ON "public"."tbl_tiendas"("estado_aprobacion", "activo");

-- tbl_fotos_tiendas
CREATE INDEX "tbl_fotos_tiendas_id_tienda_idx" ON "public"."tbl_fotos_tiendas"("id_tienda");

-- tbl_productos
CREATE INDEX "tbl_productos_id_tienda_idx" ON "public"."tbl_productos"("id_tienda");
CREATE INDEX "tbl_productos_id_categoria_idx" ON "public"."tbl_productos"("id_categoria");
CREATE INDEX "tbl_productos_estado_aprobacion_estado_idx" ON "public"."tbl_productos"("estado_aprobacion", "estado");
CREATE INDEX "tbl_productos_nombre_idx" ON "public"."tbl_productos"("nombre");

-- tbl_fotos_productos
CREATE INDEX "tbl_fotos_productos_id_producto_idx" ON "public"."tbl_fotos_productos"("id_producto");

-- tbl_historial_precios
CREATE INDEX "tbl_historial_precios_id_producto_cambiado_en_idx" ON "public"."tbl_historial_precios"("id_producto", "cambiado_en" DESC);

-- tbl_listas_compras
CREATE INDEX "tbl_listas_compras_id_comprador_estado_idx" ON "public"."tbl_listas_compras"("id_comprador", "estado");

-- tbl_items_lista_compras
CREATE INDEX "tbl_items_lista_compras_id_lista_idx" ON "public"."tbl_items_lista_compras"("id_lista");
CREATE INDEX "tbl_items_lista_compras_id_producto_idx" ON "public"."tbl_items_lista_compras"("id_producto");
CREATE INDEX "tbl_items_lista_compras_comprado_idx" ON "public"."tbl_items_lista_compras"("comprado");
CREATE INDEX "tbl_items_lista_compras_comprado_en_idx" ON "public"."tbl_items_lista_compras"("comprado_en");

-- tbl_calificaciones_productos
CREATE INDEX "tbl_calificaciones_productos_id_comprador_id_producto_idx" ON "public"."tbl_calificaciones_productos"("id_comprador", "id_producto");
CREATE INDEX "tbl_calificaciones_productos_calificado_en_idx" ON "public"."tbl_calificaciones_productos"("calificado_en");

-- tbl_calificaciones_tiendas
CREATE INDEX "tbl_calificaciones_tiendas_id_comprador_id_tienda_idx" ON "public"."tbl_calificaciones_tiendas"("id_comprador", "id_tienda");
CREATE INDEX "tbl_calificaciones_tiendas_calificado_en_idx" ON "public"."tbl_calificaciones_tiendas"("calificado_en");

-- tbl_tickets
CREATE INDEX "tbl_tickets_estado_ultimo_mensaje_en_idx" ON "public"."tbl_tickets"("estado", "ultimo_mensaje_en");
CREATE INDEX "tbl_tickets_objetivo_id_tienda_idx" ON "public"."tbl_tickets"("objetivo", "id_tienda");

-- tbl_mensajes_tickets
CREATE INDEX "tbl_mensajes_tickets_id_ticket_fecha_hora_registro_idx" ON "public"."tbl_mensajes_tickets"("id_ticket", "fecha_hora_registro");

-- tbl_solicitudes_suscripcion
CREATE INDEX "tbl_solicitudes_suscripcion_id_tienda_idx" ON "public"."tbl_solicitudes_suscripcion"("id_tienda");
CREATE INDEX "tbl_solicitudes_suscripcion_estado_idx" ON "public"."tbl_solicitudes_suscripcion"("estado");

-- tbl_suscripciones_activas
CREATE INDEX "tbl_suscripciones_activas_estado_fin_en_idx" ON "public"."tbl_suscripciones_activas"("estado", "fin_en");

-- tbl_transacciones_suscripcion
CREATE INDEX "tbl_transacciones_suscripcion_id_tienda_idx" ON "public"."tbl_transacciones_suscripcion"("id_tienda");

-- tbl_dispositivos_push
CREATE INDEX "tbl_dispositivos_push_id_usuario_idx" ON "public"."tbl_dispositivos_push"("id_usuario");

-- tbl_log_auditoria
CREATE INDEX "tbl_log_auditoria_id_actor_idx" ON "public"."tbl_log_auditoria"("id_actor");
CREATE INDEX "tbl_log_auditoria_tipo_entidad_id_entidad_idx" ON "public"."tbl_log_auditoria"("tipo_entidad", "id_entidad");

-- ============================================================
-- FOREIGN KEYS
-- ============================================================

-- tbl_roles_permisos
ALTER TABLE "public"."tbl_roles_permisos" ADD CONSTRAINT "tbl_roles_permisos_id_rol_fkey" FOREIGN KEY ("id_rol") REFERENCES "public"."tbl_roles"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "public"."tbl_roles_permisos" ADD CONSTRAINT "tbl_roles_permisos_id_permiso_fkey" FOREIGN KEY ("id_permiso") REFERENCES "public"."tbl_permisos"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- tbl_usuarios
ALTER TABLE "public"."tbl_usuarios" ADD CONSTRAINT "fk_usuarios_roles" FOREIGN KEY ("id_rol") REFERENCES "public"."tbl_roles"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "public"."tbl_usuarios" ADD CONSTRAINT "fk_usuarios_ciudad" FOREIGN KEY ("id_ciudad") REFERENCES "public"."tbl_ciudades"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- tbl_tokens_refresco
ALTER TABLE "public"."tbl_tokens_refresco" ADD CONSTRAINT "tbl_tokens_refresco_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "public"."tbl_usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- tbl_codigos_verificacion_email
ALTER TABLE "public"."tbl_codigos_verificacion_email" ADD CONSTRAINT "tbl_codigos_verificacion_email_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "public"."tbl_usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- tbl_tokens_recuperacion
ALTER TABLE "public"."tbl_tokens_recuperacion" ADD CONSTRAINT "tbl_tokens_recuperacion_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "public"."tbl_usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- tbl_zonas
ALTER TABLE "public"."tbl_zonas" ADD CONSTRAINT "fk_zonas_ciudad" FOREIGN KEY ("id_ciudad") REFERENCES "public"."tbl_ciudades"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- tbl_galerias
ALTER TABLE "public"."tbl_galerias" ADD CONSTRAINT "fk_galerias_ciudad" FOREIGN KEY ("id_ciudad") REFERENCES "public"."tbl_ciudades"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "public"."tbl_galerias" ADD CONSTRAINT "fk_galerias_zona" FOREIGN KEY ("id_zona") REFERENCES "public"."tbl_zonas"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- tbl_fotos_galerias
ALTER TABLE "public"."tbl_fotos_galerias" ADD CONSTRAINT "tbl_fotos_galerias_id_galeria_fkey" FOREIGN KEY ("id_galeria") REFERENCES "public"."tbl_galerias"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- tbl_perfiles_vendedor
ALTER TABLE "public"."tbl_perfiles_vendedor" ADD CONSTRAINT "tbl_perfiles_vendedor_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "public"."tbl_usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- tbl_documentos_vendedor
ALTER TABLE "public"."tbl_documentos_vendedor" ADD CONSTRAINT "tbl_documentos_vendedor_id_perfil_vendedor_fkey" FOREIGN KEY ("id_perfil_vendedor") REFERENCES "public"."tbl_perfiles_vendedor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- tbl_tiendas
ALTER TABLE "public"."tbl_tiendas" ADD CONSTRAINT "fk_tiendas_vendedor" FOREIGN KEY ("id_vendedor") REFERENCES "public"."tbl_usuarios"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "public"."tbl_tiendas" ADD CONSTRAINT "fk_tiendas_galeria" FOREIGN KEY ("id_galeria") REFERENCES "public"."tbl_galerias"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- tbl_fotos_tiendas
ALTER TABLE "public"."tbl_fotos_tiendas" ADD CONSTRAINT "tbl_fotos_tiendas_id_tienda_fkey" FOREIGN KEY ("id_tienda") REFERENCES "public"."tbl_tiendas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- tbl_productos
ALTER TABLE "public"."tbl_productos" ADD CONSTRAINT "fk_productos_tienda" FOREIGN KEY ("id_tienda") REFERENCES "public"."tbl_tiendas"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "public"."tbl_productos" ADD CONSTRAINT "fk_productos_categoria" FOREIGN KEY ("id_categoria") REFERENCES "public"."tbl_categorias"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- tbl_fotos_productos
ALTER TABLE "public"."tbl_fotos_productos" ADD CONSTRAINT "tbl_fotos_productos_id_producto_fkey" FOREIGN KEY ("id_producto") REFERENCES "public"."tbl_productos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- tbl_historial_precios
ALTER TABLE "public"."tbl_historial_precios" ADD CONSTRAINT "tbl_historial_precios_id_producto_fkey" FOREIGN KEY ("id_producto") REFERENCES "public"."tbl_productos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."tbl_historial_precios" ADD CONSTRAINT "tbl_historial_precios_id_usuario_cambio_fkey" FOREIGN KEY ("id_usuario_cambio") REFERENCES "public"."tbl_usuarios"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- tbl_favoritos_productos
ALTER TABLE "public"."tbl_favoritos_productos" ADD CONSTRAINT "tbl_favoritos_productos_id_comprador_fkey" FOREIGN KEY ("id_comprador") REFERENCES "public"."tbl_usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."tbl_favoritos_productos" ADD CONSTRAINT "tbl_favoritos_productos_id_producto_fkey" FOREIGN KEY ("id_producto") REFERENCES "public"."tbl_productos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- tbl_favoritos_tiendas
ALTER TABLE "public"."tbl_favoritos_tiendas" ADD CONSTRAINT "tbl_favoritos_tiendas_id_comprador_fkey" FOREIGN KEY ("id_comprador") REFERENCES "public"."tbl_usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."tbl_favoritos_tiendas" ADD CONSTRAINT "tbl_favoritos_tiendas_id_tienda_fkey" FOREIGN KEY ("id_tienda") REFERENCES "public"."tbl_tiendas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- tbl_listas_compras
ALTER TABLE "public"."tbl_listas_compras" ADD CONSTRAINT "tbl_listas_compras_id_comprador_fkey" FOREIGN KEY ("id_comprador") REFERENCES "public"."tbl_usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- tbl_items_lista_compras
ALTER TABLE "public"."tbl_items_lista_compras" ADD CONSTRAINT "tbl_items_lista_compras_id_lista_fkey" FOREIGN KEY ("id_lista") REFERENCES "public"."tbl_listas_compras"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."tbl_items_lista_compras" ADD CONSTRAINT "tbl_items_lista_compras_id_producto_fkey" FOREIGN KEY ("id_producto") REFERENCES "public"."tbl_productos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- tbl_calificaciones_productos
ALTER TABLE "public"."tbl_calificaciones_productos" ADD CONSTRAINT "tbl_calificaciones_productos_id_comprador_fkey" FOREIGN KEY ("id_comprador") REFERENCES "public"."tbl_usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."tbl_calificaciones_productos" ADD CONSTRAINT "tbl_calificaciones_productos_id_producto_fkey" FOREIGN KEY ("id_producto") REFERENCES "public"."tbl_productos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- tbl_calificaciones_tiendas
ALTER TABLE "public"."tbl_calificaciones_tiendas" ADD CONSTRAINT "tbl_calificaciones_tiendas_id_comprador_fkey" FOREIGN KEY ("id_comprador") REFERENCES "public"."tbl_usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."tbl_calificaciones_tiendas" ADD CONSTRAINT "tbl_calificaciones_tiendas_id_tienda_fkey" FOREIGN KEY ("id_tienda") REFERENCES "public"."tbl_tiendas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- tbl_agregados_cal_productos
ALTER TABLE "public"."tbl_agregados_cal_productos" ADD CONSTRAINT "tbl_agregados_cal_productos_id_producto_fkey" FOREIGN KEY ("id_producto") REFERENCES "public"."tbl_productos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- tbl_agregados_cal_tiendas
ALTER TABLE "public"."tbl_agregados_cal_tiendas" ADD CONSTRAINT "tbl_agregados_cal_tiendas_id_tienda_fkey" FOREIGN KEY ("id_tienda") REFERENCES "public"."tbl_tiendas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- tbl_tickets
ALTER TABLE "public"."tbl_tickets" ADD CONSTRAINT "tbl_tickets_id_creador_fkey" FOREIGN KEY ("id_creador") REFERENCES "public"."tbl_usuarios"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "public"."tbl_tickets" ADD CONSTRAINT "tbl_tickets_id_tienda_fkey" FOREIGN KEY ("id_tienda") REFERENCES "public"."tbl_tiendas"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- tbl_participantes_tickets
ALTER TABLE "public"."tbl_participantes_tickets" ADD CONSTRAINT "tbl_participantes_tickets_id_ticket_fkey" FOREIGN KEY ("id_ticket") REFERENCES "public"."tbl_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."tbl_participantes_tickets" ADD CONSTRAINT "tbl_participantes_tickets_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "public"."tbl_usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- tbl_mensajes_tickets
ALTER TABLE "public"."tbl_mensajes_tickets" ADD CONSTRAINT "tbl_mensajes_tickets_id_ticket_fkey" FOREIGN KEY ("id_ticket") REFERENCES "public"."tbl_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."tbl_mensajes_tickets" ADD CONSTRAINT "tbl_mensajes_tickets_id_autor_fkey" FOREIGN KEY ("id_autor") REFERENCES "public"."tbl_usuarios"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- tbl_estados_lectura_tickets
ALTER TABLE "public"."tbl_estados_lectura_tickets" ADD CONSTRAINT "tbl_estados_lectura_tickets_id_ticket_fkey" FOREIGN KEY ("id_ticket") REFERENCES "public"."tbl_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."tbl_estados_lectura_tickets" ADD CONSTRAINT "tbl_estados_lectura_tickets_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "public"."tbl_usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- tbl_solicitudes_suscripcion
ALTER TABLE "public"."tbl_solicitudes_suscripcion" ADD CONSTRAINT "tbl_solicitudes_suscripcion_id_tienda_fkey" FOREIGN KEY ("id_tienda") REFERENCES "public"."tbl_tiendas"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "public"."tbl_solicitudes_suscripcion" ADD CONSTRAINT "tbl_solicitudes_suscripcion_id_vendedor_fkey" FOREIGN KEY ("id_vendedor") REFERENCES "public"."tbl_usuarios"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- tbl_archivos_solicitudes_suscripcion
ALTER TABLE "public"."tbl_archivos_solicitudes_suscripcion" ADD CONSTRAINT "tbl_archivos_solicitudes_suscripcion_id_solicitud_fkey" FOREIGN KEY ("id_solicitud") REFERENCES "public"."tbl_solicitudes_suscripcion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- tbl_suscripciones_activas
ALTER TABLE "public"."tbl_suscripciones_activas" ADD CONSTRAINT "tbl_suscripciones_activas_id_tienda_fkey" FOREIGN KEY ("id_tienda") REFERENCES "public"."tbl_tiendas"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- tbl_transacciones_suscripcion
ALTER TABLE "public"."tbl_transacciones_suscripcion" ADD CONSTRAINT "tbl_transacciones_suscripcion_id_tienda_fkey" FOREIGN KEY ("id_tienda") REFERENCES "public"."tbl_tiendas"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- tbl_log_envio_email
ALTER TABLE "public"."tbl_log_envio_email" ADD CONSTRAINT "tbl_log_envio_email_id_vendedor_fkey" FOREIGN KEY ("id_vendedor") REFERENCES "public"."tbl_usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- tbl_aceptaciones_terminos
ALTER TABLE "public"."tbl_aceptaciones_terminos" ADD CONSTRAINT "tbl_aceptaciones_terminos_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "public"."tbl_usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."tbl_aceptaciones_terminos" ADD CONSTRAINT "tbl_aceptaciones_terminos_id_version_terminos_fkey" FOREIGN KEY ("id_version_terminos") REFERENCES "public"."tbl_versiones_terminos"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- tbl_dispositivos_push
ALTER TABLE "public"."tbl_dispositivos_push" ADD CONSTRAINT "tbl_dispositivos_push_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "public"."tbl_usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- tbl_log_auditoria
ALTER TABLE "public"."tbl_log_auditoria" ADD CONSTRAINT "tbl_log_auditoria_id_actor_fkey" FOREIGN KEY ("id_actor") REFERENCES "public"."tbl_usuarios"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
