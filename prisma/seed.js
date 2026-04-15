const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();
const { EMAIL_TEMPLATE_DEFAULTS } = require('../config/emailTemplateDefaults');
const { PUSH_NOTIFICATION_DEFAULTS } = require('../config/pushNotificationDefaults');

async function main() {
  // =============================================
  // 1. ROLES (sin CRUD desde frontend)
  // =============================================
  await prisma.tbl_roles.createMany({
    data: [
      { nombre: 'COMPRADOR', descripcion: 'Comprador del marketplace. Busca productos, arma listas de compras, califica.', id_usuario_registro: 1 },
      { nombre: 'VENDEDOR', descripcion: 'Vendedor que publica tiendas y productos bajo aprobacion administrativa.', id_usuario_registro: 1 },
      { nombre: 'ADMINISTRADOR', descripcion: 'Control total: aprobaciones, soporte, configuracion, finanzas y reportes.', id_usuario_registro: 1 },
    ],
    skipDuplicates: true,
  });

  // =============================================
  // 2. PERMISOS (sin CRUD desde frontend)
  // =============================================
  await prisma.tbl_permisos.createMany({
    data: [
      // --- COMPRADOR ---
      { codigo: 'buyer.dashboard', nombre: 'Dashboard Comprador', tipo: 'ruta', recurso: '/comprador/dashboard', id_usuario_registro: 1 },
      { codigo: 'buyer.catalog.read', nombre: 'Ver Catalogo', tipo: 'accion', recurso: 'catalogo', id_usuario_registro: 1 },
      { codigo: 'buyer.favorites', nombre: 'Gestionar Favoritos', tipo: 'accion', recurso: 'favoritos', id_usuario_registro: 1 },
      { codigo: 'buyer.shopping_list', nombre: 'Lista de Compras', tipo: 'accion', recurso: 'lista_compras', id_usuario_registro: 1 },
      { codigo: 'buyer.ratings', nombre: 'Calificaciones', tipo: 'accion', recurso: 'calificaciones', id_usuario_registro: 1 },
      { codigo: 'buyer.tickets', nombre: 'Tickets Comprador', tipo: 'accion', recurso: 'tickets', id_usuario_registro: 1 },
      { codigo: 'buyer.profile', nombre: 'Perfil Comprador', tipo: 'ruta', recurso: '/comprador/perfil', id_usuario_registro: 1 },

      // --- VENDEDOR ---
      { codigo: 'seller.dashboard', nombre: 'Dashboard Vendedor', tipo: 'ruta', recurso: '/vendedor/dashboard', id_usuario_registro: 1 },
      { codigo: 'seller.stores', nombre: 'Gestionar Tiendas', tipo: 'accion', recurso: 'tiendas', id_usuario_registro: 1 },
      { codigo: 'seller.products', nombre: 'Gestionar Productos', tipo: 'accion', recurso: 'productos', id_usuario_registro: 1 },
      { codigo: 'seller.subscriptions', nombre: 'Suscripciones', tipo: 'accion', recurso: 'suscripciones', id_usuario_registro: 1 },
      { codigo: 'seller.tickets', nombre: 'Tickets Vendedor', tipo: 'accion', recurso: 'tickets', id_usuario_registro: 1 },
      { codigo: 'seller.profile', nombre: 'Perfil Vendedor', tipo: 'ruta', recurso: '/vendedor/perfil', id_usuario_registro: 1 },

      // --- ADMINISTRADOR ---
      { codigo: 'admin.dashboard', nombre: 'Dashboard Admin', tipo: 'ruta', recurso: '/admin/dashboard', id_usuario_registro: 1 },
      { codigo: 'admin.users', nombre: 'Gestion Usuarios', tipo: 'accion', recurso: 'usuarios', id_usuario_registro: 1 },
      { codigo: 'admin.approvals', nombre: 'Aprobaciones', tipo: 'accion', recurso: 'aprobaciones', id_usuario_registro: 1 },
      { codigo: 'admin.catalog', nombre: 'CRUD Catalogo', tipo: 'accion', recurso: 'catalogo_admin', id_usuario_registro: 1 },
      { codigo: 'admin.subscriptions', nombre: 'Gestion Suscripciones', tipo: 'accion', recurso: 'suscripciones_admin', id_usuario_registro: 1 },
      { codigo: 'admin.finance', nombre: 'Finanzas', tipo: 'accion', recurso: 'finanzas', id_usuario_registro: 1 },
      { codigo: 'admin.reports', nombre: 'Reportes', tipo: 'accion', recurso: 'reportes', id_usuario_registro: 1 },
      { codigo: 'admin.tickets', nombre: 'Tickets Admin', tipo: 'accion', recurso: 'tickets_admin', id_usuario_registro: 1 },
      { codigo: 'admin.config', nombre: 'Configuracion', tipo: 'accion', recurso: 'configuracion', id_usuario_registro: 1 },
      { codigo: 'admin.admins', nombre: 'Gestion Administradores', tipo: 'accion', recurso: 'administradores', id_usuario_registro: 1 },
      { codigo: 'admin.payment_methods', nombre: 'Metodos de Pago', tipo: 'accion', recurso: 'metodos_pago', id_usuario_registro: 1 },
    ],
    skipDuplicates: true,
  });

  // =============================================
  // 3. ROLES-PERMISOS (sin CRUD desde frontend)
  // =============================================
  const permisos = await prisma.tbl_permisos.findMany();
  const dataRolesPermisos = [];

  // ADMINISTRADOR (id_rol: 3) -> todos los permisos
  permisos.forEach((p) => {
    dataRolesPermisos.push({ id_rol: 3, id_permiso: p.id, id_usuario_registro: 1 });
  });

  // COMPRADOR (id_rol: 1) -> permisos buyer.*
  permisos.filter(p => p.codigo.startsWith('buyer.')).forEach((p) => {
    dataRolesPermisos.push({ id_rol: 1, id_permiso: p.id, id_usuario_registro: 1 });
  });

  // VENDEDOR (id_rol: 2) -> permisos seller.*
  permisos.filter(p => p.codigo.startsWith('seller.')).forEach((p) => {
    dataRolesPermisos.push({ id_rol: 2, id_permiso: p.id, id_usuario_registro: 1 });
  });

  await prisma.tbl_roles_permisos.createMany({
    data: dataRolesPermisos,
    skipDuplicates: true,
  });

  // =============================================
  // 4. USUARIO ADMINISTRADOR (unico usuario inicial)
  // =============================================
  const passwordHash = await bcrypt.hash('123456', 10);

  await prisma.tbl_usuarios.createMany({
    data: [
      {
        nombre: 'Admin Principal',
        correo: 'admin@marketplace.pe',
        telefono: '999000001',
        contrasena: passwordHash,
        id_rol: 3,
        correo_verificado: true,
        activo: true,
        id_usuario_registro: 1,
      },
    ],
    skipDuplicates: true,
  });

  // =============================================
  // 5. PLANES DE SUSCRIPCION (admin solo puede UPDATE, no CREATE)
  // =============================================
  const existingPlans = await prisma.tbl_planes.count();
  if (existingPlans === 0) {
    await prisma.tbl_planes.createMany({
      data: [
        { tipo: 'ESTANDAR', nombre: 'Plan Estándar', precio: 10, duracion_dias: 30, id_usuario_registro: 1 },
        { tipo: 'PREMIUM', nombre: 'Plan Premium', precio: 15, duracion_dias: 30, id_usuario_registro: 1 },
      ],
    });

    // Caracteristicas del Plan Estandar
    const planEstandar = await prisma.tbl_planes.findFirst({ where: { tipo: 'ESTANDAR' } });
    if (planEstandar) {
      await prisma.tbl_caracteristicas_plan.createMany({
        data: [
          { id_plan: planEstandar.id, texto: 'Tus productos serán visibles para compradores', orden: 1 },
          { id_plan: planEstandar.id, texto: 'Aparecer en resultados de búsqueda', orden: 2 },
          { id_plan: planEstandar.id, texto: 'Acceso a estadísticas básicas', orden: 3 },
        ],
      });
    }

    // Caracteristicas del Plan Premium
    const planPremium = await prisma.tbl_planes.findFirst({ where: { tipo: 'PREMIUM' } });
    if (planPremium) {
      await prisma.tbl_caracteristicas_plan.createMany({
        data: [
          { id_plan: planPremium.id, texto: 'Todo lo del Plan Estándar', orden: 1 },
          { id_plan: planPremium.id, texto: 'Aparecer PRIMERO en búsquedas', orden: 2 },
          { id_plan: planPremium.id, texto: 'Badge Premium en tu tienda', orden: 3 },
          { id_plan: planPremium.id, texto: 'Mayor visibilidad para compradores', orden: 4 },
          { id_plan: planPremium.id, texto: 'Soporte prioritario', orden: 5 },
        ],
      });
    }
  }

  // =============================================
  // 6. CONFIGURACION DEL SISTEMA (admin solo puede UPDATE valores, no CREATE claves)
  // =============================================
  await prisma.tbl_configuracion_sistema.createMany({
    data: [
      {
        clave: 'dias_alerta_vencimiento_suscripcion',
        valor: '7',
        descripcion: 'Dias de anticipacion para enviar alerta de vencimiento de suscripcion',
        id_usuario_registro: 1,
      },
      {
        clave: 'dias_filtro_por_vencer_suscripcion',
        valor: '15',
        descripcion: 'Dias de anticipacion para mostrar suscripciones como "por vencer" en el panel admin',
        id_usuario_registro: 1,
      },
    ],
    skipDuplicates: true,
  });

  // =============================================
  // 7. PLANTILLAS DE EMAIL (admin solo puede UPDATE/RESET, no CREATE)
  // =============================================
  await prisma.tbl_plantillas_email.createMany({
    data: EMAIL_TEMPLATE_DEFAULTS.map(tmpl => ({
      ...tmpl,
      id_usuario_registro: 1,
    })),
    skipDuplicates: true,
  });

  // =============================================
  // 8. CONFIGURACION NOTIFICACIONES PUSH (admin solo puede UPDATE/RESET, no CREATE)
  // =============================================
  await prisma.tbl_config_notificaciones_push.createMany({
    data: PUSH_NOTIFICATION_DEFAULTS.map(tmpl => ({
      ...tmpl,
      id_usuario_registro: 1,
    })),
    skipDuplicates: true,
  });

  console.log('Seed de produccion ejecutado correctamente (8 tablas de configuracion)');
}

main()
  .catch((e) => {
    console.error('Error en el seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
