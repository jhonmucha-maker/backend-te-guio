const prisma = require('../config/db');
const { APPROVAL_STATUS, PRODUCT_STATE, ROLES, SUBSCRIPTION_REQUEST_STATUS, SUBSCRIPTION_STATUS, PLAN_TYPE, TICKET_STATUS, TICKET_CLOSE_REASON, AUTH_ERROR_CODES, AUTH_MESSAGES, ACCOUNT_STATUS_LABELS, deriveAccountStatus, countByAccountStatus } = require('../config/constants');
const notificationService = require('../services/notificationService');
const { revokeRefreshTokensByUser } = require('../models/authModel');
const { ACCOUNT_DISABLED, SUBSCRIPTION_REQUEST_UPDATED } = require('../config/eventNames');
const emailService = require('../services/emailService');
const { EMAIL_TEMPLATE_DEFAULTS, TEMPLATE_SECTIONS, SAMPLE_DATA, buildHtmlFromSections } = require('../config/emailTemplateDefaults');
const { PUSH_NOTIFICATION_DEFAULTS, PUSH_VARIABLE_MAP } = require('../config/pushNotificationDefaults');
const pushService = require('../services/pushService');

// Filtro reutilizable para excluir transacciones de tiendas o vendedores eliminados (soft-delete).
// Usado por finanzas, dashboard y reportes para mantener Single Source of Truth.
const VALID_TRANSACTION_WHERE = {
  tbl_tiendas: {
    eliminado_en: null,
    tbl_usuarios: { eliminado_en: null },
  },
};

// Filtros reutilizables para excluir rastros de vendedores eliminados.
// Single Source of Truth para garantizar que NINGUN endpoint muestre datos
// asociados a vendedores con eliminado_en != null.
//
// Uso esperado:
//   prisma.<tabla>.findMany({ where: { ...WHERE_ACTIVE_STORE } })
const WHERE_ACTIVE_STORE = {
  tbl_tiendas: {
    eliminado_en: null,
    tbl_usuarios: { eliminado_en: null },
  },
};
// Versión sin prefijo de relación (cuando el query ya está en tbl_tiendas).
const WHERE_STORE_NOT_DELETED = {
  eliminado_en: null,
  tbl_usuarios: { eliminado_en: null },
};

// ==================== DASHBOARD ====================
const getDashboard = async (req, res) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const activeSubWhere = { estado: SUBSCRIPTION_STATUS.ACTIVE, fin_en: { gte: now } };

    const [totalBuyers, totalSellers, totalStores, totalProducts,
      pendingStores, pendingProducts, pendingSubscriptions,
      activeSubscriptions, openTickets, premiumStores, standardStores, monthlyAgg, totalAgg] = await Promise.all([
      prisma.tbl_usuarios.count({ where: { tbl_roles: { nombre: ROLES.COMPRADOR }, activo: true, eliminado_en: null } }),
      prisma.tbl_usuarios.count({ where: { tbl_roles: { nombre: ROLES.VENDEDOR }, activo: true, eliminado_en: null } }),
      prisma.tbl_tiendas.count({ where: { estado_aprobacion: APPROVAL_STATUS.APROBADO, eliminado_en: null } }),
      prisma.tbl_productos.count({ where: { estado_aprobacion: APPROVAL_STATUS.APROBADO, eliminado_en: null } }),
      prisma.tbl_tiendas.count({ where: { estado_aprobacion: APPROVAL_STATUS.PENDIENTE, eliminado_en: null } }),
      prisma.tbl_productos.count({ where: { estado_aprobacion: APPROVAL_STATUS.PENDIENTE, eliminado_en: null } }),
      prisma.tbl_solicitudes_suscripcion.count({ where: { estado: SUBSCRIPTION_REQUEST_STATUS.PENDIENTE } }),
      prisma.tbl_suscripciones_activas.count({ where: activeSubWhere }),
      prisma.tbl_tickets.count({ where: { estado: { not: TICKET_STATUS.ATENDIDO } } }),
      // Tiendas Premium: tiendas con suscripción PREMIUM activa
      prisma.tbl_tiendas.count({
        where: { eliminado_en: null, suscripcion_activa: { ...activeSubWhere, tipo_plan: PLAN_TYPE.PREMIUM } },
      }),
      // Tiendas Estándar: tiendas con suscripción ESTANDAR activa
      prisma.tbl_tiendas.count({
        where: { eliminado_en: null, suscripcion_activa: { ...activeSubWhere, tipo_plan: PLAN_TYPE.ESTANDAR } },
      }),
      // Ingresos del mes: usa pagado_en (criterio temporal unificado) y excluye tiendas/vendedores eliminados
      prisma.tbl_transacciones_suscripcion.aggregate({
        _sum: { monto: true },
        where: { ...VALID_TRANSACTION_WHERE, pagado_en: { gte: startOfMonth } },
      }),
      // Ingresos totales: excluye transacciones de tiendas o vendedores eliminados
      prisma.tbl_transacciones_suscripcion.aggregate({
        _sum: { monto: true },
        where: { ...VALID_TRANSACTION_WHERE },
      }),
    ]);

    res.json({
      totalBuyers, totalSellers, totalStores, totalProducts,
      pendingStores, pendingProducts, pendingSubscriptions,
      activeSubscriptions, openTickets,
      premiumSellers: premiumStores,
      standardSellers: standardStores,
      subscribedSellers: premiumStores + standardStores,
      monthlyRevenue: parseFloat(monthlyAgg._sum.monto || 0),
      totalRevenue: parseFloat(totalAgg._sum.monto || 0),
    });
  } catch (error) {
    console.error('Error al obtener dashboard:', error);
    res.status(500).json({ error: 'Error al obtener dashboard' });
  }
};

// ==================== APROBACIONES TIENDA ====================
const getPendingStores = async (req, res) => {
  try {
    const tiendas = await prisma.tbl_tiendas.findMany({
      where: { eliminado_en: null },
      include: {
        tbl_usuarios: { select: { id: true, nombre: true, correo: true, telefono: true } },
        tbl_galerias: {
          select: {
            nombre: true,
            direccion: true,
            latitud: true,
            longitud: true,
            tbl_zonas: { select: { nombre: true } },
            tbl_ciudades: { select: { nombre: true } },
            fotos: { select: { id: true, url: true, posicion: true }, orderBy: { posicion: 'asc' } },
          },
        },
        fotos: { orderBy: { posicion: 'asc' } },
        _count: { select: { productos: { where: { eliminado_en: null } } } },
        suscripcion_activa: { select: { tipo_plan: true, estado: true, fin_en: true } },
      },
      orderBy: { fecha_hora_registro: 'asc' },
    });
    const result = tiendas.map(t => ({
      id: t.id,
      nombre: t.nombre,
      descripcion: t.descripcion,
      numero_local: t.numero_local,
      direccion: t.direccion,
      observacion: t.observacion,
      estado_aprobacion: t.estado_aprobacion,
      motivo_aprobacion: t.motivo_aprobacion,
      activo: t.activo,
      fecha_hora_registro: t.fecha_hora_registro,
      fotos: t.fotos,
      productos_count: t._count?.productos || 0,
      es_premium: t.suscripcion_activa?.estado === SUBSCRIPTION_STATUS.ACTIVE && t.suscripcion_activa?.fin_en && new Date(t.suscripcion_activa.fin_en) > new Date(),
      vendedor: t.tbl_usuarios ? {
        id: t.tbl_usuarios.id,
        nombre: t.tbl_usuarios.nombre,
        correo: t.tbl_usuarios.correo,
        telefono: t.tbl_usuarios.telefono || null,
      } : null,
      galeria: t.tbl_galerias ? {
        nombre: t.tbl_galerias.nombre,
        direccion: t.tbl_galerias.direccion || null,
        zona: t.tbl_galerias.tbl_zonas?.nombre || null,
        ciudad: t.tbl_galerias.tbl_ciudades?.nombre || null,
        latitud: t.tbl_galerias.latitud ? parseFloat(t.tbl_galerias.latitud) : null,
        longitud: t.tbl_galerias.longitud ? parseFloat(t.tbl_galerias.longitud) : null,
        fotos: t.tbl_galerias.fotos || [],
      } : null,
    }));
    res.json(result);
  } catch (error) {
    console.error('[getPendingStores] Error:', error);
    res.status(500).json({ error: 'Error al obtener tiendas pendientes' });
  }
};

const approveStore = async (req, res) => {
  const { id } = req.params;

  try {
    // Toggle activo/inactivo para tiendas ya aprobadas
    if (req.body.toggle_active) {
      const tienda = await prisma.tbl_tiendas.findFirst({
        where: { id: parseInt(id), estado_aprobacion: APPROVAL_STATUS.APROBADO, eliminado_en: null },
        include: { tbl_usuarios: { select: { nombre: true } } },
      });
      if (!tienda) return res.status(400).json({ error: 'Tienda no encontrada o no aprobada' });

      const nuevoEstado = !tienda.activo;
      await prisma.tbl_tiendas.update({
        where: { id: parseInt(id) },
        data: {
          activo: nuevoEstado,
          id_usuario_modificacion: req.user.id,
          fecha_hora_modificacion: new Date(),
        },
      });

      // Cascada: desactivar/reactivar productos aprobados
      if (!nuevoEstado) {
        await prisma.tbl_productos.updateMany({
          where: {
            id_tienda: parseInt(id),
            estado_aprobacion: APPROVAL_STATUS.APROBADO,
            estado: PRODUCT_STATE.ACTIVE,
            eliminado_en: null,
          },
          data: { estado: PRODUCT_STATE.INACTIVE },
        });
      } else {
        await prisma.tbl_productos.updateMany({
          where: {
            id_tienda: parseInt(id),
            estado_aprobacion: APPROVAL_STATUS.APROBADO,
            estado: PRODUCT_STATE.INACTIVE,
            eliminado_en: null,
          },
          data: { estado: PRODUCT_STATE.ACTIVE },
        });
      }

      await prisma.tbl_log_auditoria.create({
        data: {
          id_actor: req.user.id,
          accion: nuevoEstado ? 'TIENDA_HABILITADA' : 'TIENDA_DESHABILITADA',
          tipo_entidad: 'tbl_tiendas',
          id_entidad: parseInt(id),
          datos_despues: { activo: nuevoEstado },
        },
      });

      const estadoTexto = nuevoEstado ? 'HABILITADA' : 'DESHABILITADA';
      notificationService.approvalUpdated(tienda.id_vendedor, 'store', parseInt(id), estadoTexto, {
        nombre_tienda: tienda.nombre,
        nombre_vendedor: tienda.tbl_usuarios?.nombre || '',
        estado: estadoTexto,
      });

      // Sincronización en tiempo real: avisar a compradores con favoritos/lista para que refresquen.
      notificationService.notifyBuyersStoreVisibilityChanged(parseInt(id));

      return res.json({ mensaje: `Tienda ${nuevoEstado ? 'habilitada' : 'deshabilitada'}` });
    }

    // Flujo normal: aprobar/rechazar tiendas pendientes
    const accion = req.body.estado || req.body.accion;
    const motivo = req.body.motivo_rechazo || req.body.motivo;

    const tienda = await prisma.tbl_tiendas.findFirst({
      where: { id: parseInt(id), estado_aprobacion: APPROVAL_STATUS.PENDIENTE, eliminado_en: null },
      include: { tbl_usuarios: { select: { correo: true, nombre: true, eliminado_en: true } } },
    });
    if (!tienda) return res.status(400).json({ error: 'Tienda no encontrada o no pendiente' });
    if (tienda.tbl_usuarios?.eliminado_en) {
      return res.status(400).json({ error: 'El vendedor asociado fue eliminado' });
    }

    const data = {
      estado_aprobacion: accion,
      id_usuario_modificacion: req.user.id,
      fecha_hora_modificacion: new Date(),
    };

    if (accion === APPROVAL_STATUS.APROBADO) {
      data.activo = true;
      data.motivo_aprobacion = null;
    } else {
      data.activo = false;
      data.motivo_aprobacion = motivo || null;
    }

    await prisma.tbl_tiendas.update({ where: { id: parseInt(id) }, data });

    // Cascada: si aprobamos la tienda, reactivar productos que estaban aprobados pero inactivos por cascada
    if (accion === APPROVAL_STATUS.APROBADO) {
      await prisma.tbl_productos.updateMany({
        where: {
          id_tienda: parseInt(id),
          estado_aprobacion: APPROVAL_STATUS.APROBADO,
          estado: PRODUCT_STATE.INACTIVE,
          eliminado_en: null,
        },
        data: { estado: PRODUCT_STATE.ACTIVE },
      });
    }

    await prisma.tbl_log_auditoria.create({
      data: {
        id_actor: req.user.id,
        accion: `TIENDA_${accion}`,
        tipo_entidad: 'tbl_tiendas',
        id_entidad: parseInt(id),
        datos_despues: { estado_aprobacion: accion, motivo },
      },
    });

    // Notificar al vendedor con datos extra para modal en tiempo real
    notificationService.approvalUpdated(tienda.id_vendedor, 'store', parseInt(id), accion, {
      nombre_tienda: tienda.nombre,
      nombre_vendedor: tienda.tbl_usuarios?.nombre || '',
      estado: accion,
      motivo: motivo || null,
    });
    // Notificar a admins para actualizar listas en tiempo real


    // Enviar email de aprobacion
    if (accion === APPROVAL_STATUS.APROBADO && tienda.tbl_usuarios?.correo) {
      const storeName = tienda.nombre || '';
      const sellerName = tienda.tbl_usuarios.nombre || '';
      emailService.sendStoreApprovalEmail(tienda.tbl_usuarios.correo, storeName, sellerName)
        .catch(err => console.error('[EMAIL] Error enviando email aprobacion tienda:', err));
    }

    res.json({ mensaje: `Tienda ${accion.toLowerCase()}a` });
  } catch (error) {
    res.status(500).json({ error: 'Error al procesar aprobacion de tienda' });
  }
};

// ==================== APROBACIONES PRODUCTO ====================
const getPendingProducts = async (req, res) => {
  try {
    const productos = await prisma.tbl_productos.findMany({
      where: { eliminado_en: null },
      include: {
        tbl_tiendas: {
          select: {
            id: true,
            nombre: true,
            numero_local: true,
            estado_aprobacion: true,
            tbl_usuarios: { select: { nombre: true, correo: true } },
            tbl_galerias: {
              select: {
                nombre: true,
                tbl_zonas: { select: { nombre: true } },
                tbl_ciudades: { select: { nombre: true } },
              },
            },
            suscripcion_activa: {
              select: { tipo_plan: true, estado: true, fin_en: true },
            },
          },
        },
        tbl_categorias: { select: { nombre: true } },
        fotos: { orderBy: { posicion: 'asc' } },
      },
      orderBy: { fecha_hora_registro: 'asc' },
    });

    const result = productos.map(p => {
      const tienda = p.tbl_tiendas;
      const sub = tienda?.suscripcion_activa;
      const subActiva = sub && sub.estado === SUBSCRIPTION_STATUS.ACTIVE && new Date(sub.fin_en) > new Date();

      return {
        id: p.id,
        nombre: p.nombre,
        descripcion: p.descripcion,
        precio: p.precio,
        moneda: p.moneda,
        precio_visible: p.precio_visible,
        estado_aprobacion: p.estado_aprobacion,
        estado: p.estado,
        fecha_hora_registro: p.fecha_hora_registro,
        fotos: p.fotos,
        categoria: p.tbl_categorias?.nombre || null,
        tienda: tienda ? {
          id: tienda.id,
          nombre: tienda.nombre,
          numero_local: tienda.numero_local,
          estado_aprobacion: tienda.estado_aprobacion,
          vendedor_nombre: tienda.tbl_usuarios?.nombre || null,
          vendedor_correo: tienda.tbl_usuarios?.correo || null,
          galeria: tienda.tbl_galerias?.nombre || null,
          zona: tienda.tbl_galerias?.tbl_zonas?.nombre || null,
          ciudad: tienda.tbl_galerias?.tbl_ciudades?.nombre || null,
          suscripcion: subActiva ? sub.tipo_plan : null,
        } : null,
      };
    });

    res.json(result);
  } catch (error) {
    console.error('Error al obtener productos:', error);
    res.status(500).json({ error: 'Error al obtener productos pendientes' });
  }
};

const approveProduct = async (req, res) => {
  const { id } = req.params;
  const { toggle_active } = req.body;
  const accion = req.body.estado || req.body.accion;
  const motivo = req.body.motivo_rechazo || req.body.motivo;

  try {
    // Toggle activo/inactivo para productos ya aprobados
    if (toggle_active) {
      const producto = await prisma.tbl_productos.findFirst({
        where: { id: parseInt(id), estado_aprobacion: APPROVAL_STATUS.APROBADO, eliminado_en: null },
        include: { tbl_tiendas: { select: { id_vendedor: true, nombre: true } } },
      });
      if (!producto) return res.status(400).json({ error: 'Producto no encontrado o no aprobado' });

      const nuevoEstado = producto.estado === PRODUCT_STATE.ACTIVE ? PRODUCT_STATE.INACTIVE : PRODUCT_STATE.ACTIVE;

      await prisma.tbl_productos.update({
        where: { id: parseInt(id) },
        data: {
          estado: nuevoEstado,
          id_usuario_modificacion: req.user.id,
          fecha_hora_modificacion: new Date(),
        },
      });

      await prisma.tbl_log_auditoria.create({
        data: {
          id_actor: req.user.id,
          accion: `PRODUCTO_${nuevoEstado === PRODUCT_STATE.ACTIVE ? 'ACTIVADO' : 'DESACTIVADO'}`,
          tipo_entidad: 'tbl_productos',
          id_entidad: parseInt(id),
          datos_despues: { estado: nuevoEstado },
        },
      });

      const fotoToggle = await prisma.tbl_fotos_productos.findFirst({ where: { id_producto: parseInt(id) }, orderBy: { posicion: 'asc' }, select: { url: true } });
      const estadoTextoProducto = nuevoEstado === PRODUCT_STATE.ACTIVE ? 'activado' : 'desactivado';
      notificationService.approvalUpdated(producto.tbl_tiendas.id_vendedor, 'product', parseInt(id), nuevoEstado, {
        nombre_producto: producto.nombre,
        nombre_tienda: producto.tbl_tiendas?.nombre || '',
        estado: estadoTextoProducto,
        imagen_producto: fotoToggle?.url || null,
      });

      return res.json({ mensaje: `Producto ${nuevoEstado === PRODUCT_STATE.ACTIVE ? 'activado' : 'desactivado'}` });
    }

    // Flujo original: aprobar/rechazar productos pendientes
    const producto = await prisma.tbl_productos.findFirst({
      where: { id: parseInt(id), estado_aprobacion: APPROVAL_STATUS.PENDIENTE, eliminado_en: null },
      include: { tbl_tiendas: { select: { id_vendedor: true, nombre: true } } },
    });
    if (!producto) return res.status(400).json({ error: 'Producto no encontrado o no pendiente' });

    const data = {
      estado_aprobacion: accion,
      id_usuario_modificacion: req.user.id,
      fecha_hora_modificacion: new Date(),
    };

    if (accion === APPROVAL_STATUS.APROBADO) {
      data.estado = PRODUCT_STATE.ACTIVE;
    } else {
      data.estado = PRODUCT_STATE.INACTIVE;
      data.motivo_aprobacion = motivo || null;
    }

    await prisma.tbl_productos.update({ where: { id: parseInt(id) }, data });

    await prisma.tbl_log_auditoria.create({
      data: {
        id_actor: req.user.id,
        accion: `PRODUCTO_${accion}`,
        tipo_entidad: 'tbl_productos',
        id_entidad: parseInt(id),
        datos_despues: { estado_aprobacion: accion, motivo },
      },
    });

    // Notificar al vendedor con imagen del producto
    const fotoProducto = await prisma.tbl_fotos_productos.findFirst({ where: { id_producto: parseInt(id) }, orderBy: { posicion: 'asc' }, select: { url: true } });
    notificationService.approvalUpdated(producto.tbl_tiendas.id_vendedor, 'product', parseInt(id), accion, {
      nombre_producto: producto.nombre,
      nombre_tienda: producto.tbl_tiendas?.nombre || '',
      estado: accion,
      imagen_producto: fotoProducto?.url || null,
    });


    res.json({ mensaje: `Producto ${accion.toLowerCase()}` });
  } catch (error) {
    res.status(500).json({ error: 'Error al procesar aprobacion de producto' });
  }
};

// ==================== SUSCRIPCIONES ====================
const getSubscriptionRequests = async (req, res) => {
  try {
    // Excluir solicitudes de vendedores/tiendas eliminados (no deben aparecer en panel admin).
    // El filtro a nivel de tbl_tiendas excluye tanto tiendas con eliminado_en como
    // tiendas cuyo vendedor (tbl_usuarios) tiene eliminado_en.
    const baseWhere = {
      ...WHERE_ACTIVE_STORE,
      tbl_usuarios: { eliminado_en: null },
    };
    const where = req.query.status
      ? { ...baseWhere, estado: req.query.status }
      : { ...baseWhere, estado: { not: SUBSCRIPTION_REQUEST_STATUS.ELIMINADO } };
    const solicitudes = await prisma.tbl_solicitudes_suscripcion.findMany({
      where,
      include: {
        tbl_tiendas: {
          select: {
            id: true,
            nombre: true,
            suscripcion_activa: true,
            tbl_galerias: {
              select: {
                nombre: true,
                tbl_ciudades: { select: { nombre: true } },
              },
            },
          },
        },
        tbl_usuarios: { select: { id: true, nombre: true, correo: true } },
        plan: { select: { id: true, tipo: true, nombre: true, precio: true, duracion_dias: true } },
        archivos: true,
      },
      orderBy: { solicitado_en: 'desc' },
    });
    res.json(solicitudes);
  } catch (error) {
    console.error('Error al obtener solicitudes:', error);
    res.status(500).json({ error: 'Error al obtener solicitudes' });
  }
};

const approveSubscription = async (req, res) => {
  const { id } = req.params;
  const accion = req.body.estado || req.body.accion;
  const motivo = req.body.motivo_rechazo || req.body.motivo;

  try {
    const solicitud = await prisma.tbl_solicitudes_suscripcion.findFirst({
      where: { id: parseInt(id), estado: SUBSCRIPTION_REQUEST_STATUS.PENDIENTE },
      include: {
        plan: true,
        tbl_tiendas: { select: { nombre: true } },
        tbl_usuarios: { select: { nombre: true } },
      },
    });
    if (!solicitud) return res.status(400).json({ error: 'Solicitud no encontrada o no pendiente' });

    const now = new Date();

    if (accion === SUBSCRIPTION_REQUEST_STATUS.APROBADO) {
      const plan = solicitud.plan;
      if (!plan) return res.status(400).json({ error: 'Plan no encontrado' });

      const finEn = new Date(now.getTime() + plan.duracion_dias * 24 * 60 * 60 * 1000);

      await prisma.$transaction(async (tx) => {
        await tx.tbl_solicitudes_suscripcion.update({
          where: { id: parseInt(id) },
          data: { estado: SUBSCRIPTION_REQUEST_STATUS.APROBADO, decidido_en: now, id_usuario_modificacion: req.user.id, fecha_hora_modificacion: now },
        });

        const tipoPlanNormalizado = solicitud.tipo_plan_solicitado === 'REGULAR' ? PLAN_TYPE.ESTANDAR : solicitud.tipo_plan_solicitado;

        await tx.tbl_suscripciones_activas.upsert({
          where: { id_tienda: solicitud.id_tienda },
          create: {
            id_tienda: solicitud.id_tienda,
            tipo_plan: tipoPlanNormalizado,
            inicio_en: now,
            fin_en: finEn,
            estado: SUBSCRIPTION_STATUS.ACTIVE,
          },
          update: {
            tipo_plan: tipoPlanNormalizado,
            inicio_en: now,
            fin_en: finEn,
            estado: SUBSCRIPTION_STATUS.ACTIVE,
          },
        });

        // Idempotente: si la solicitud se aprueba dos veces (doble click u otra carrera),
        // no se crean transacciones duplicadas. id_solicitud es UNIQUE.
        await tx.tbl_transacciones_suscripcion.upsert({
          where: { id_solicitud: parseInt(id) },
          create: {
            id_tienda: solicitud.id_tienda,
            id_solicitud: parseInt(id),
            monto: plan.precio,
            id_metodo_pago: solicitud.id_metodo_pago,
            pagado_en: now,
            inicio_en: now,
            fin_en: finEn,
            estado: SUBSCRIPTION_STATUS.ACTIVE,
          },
          update: {
            id_tienda: solicitud.id_tienda,
            monto: plan.precio,
            id_metodo_pago: solicitud.id_metodo_pago,
            pagado_en: now,
            inicio_en: now,
            fin_en: finEn,
            estado: SUBSCRIPTION_STATUS.ACTIVE,
          },
        });
      });
    } else {
      await prisma.tbl_solicitudes_suscripcion.update({
        where: { id: parseInt(id) },
        data: {
          estado: SUBSCRIPTION_REQUEST_STATUS.RECHAZADO,
          motivo_rechazo: motivo || null,
          decidido_en: now,
          id_usuario_modificacion: req.user.id,
          fecha_hora_modificacion: now,
        },
      });
    }

    await prisma.tbl_log_auditoria.create({
      data: {
        id_actor: req.user.id,
        accion: `SUSCRIPCION_${accion}`,
        tipo_entidad: 'tbl_solicitudes_suscripcion',
        id_entidad: parseInt(id),
        datos_despues: { estado: accion, motivo },
      },
    });

    // Notificar con datos enriquecidos
    const subVars = {
      nombre_vendedor: solicitud.tbl_usuarios?.nombre || '',
      nombre_tienda: solicitud.tbl_tiendas?.nombre || '',
      nombre_plan: solicitud.plan?.nombre || solicitud.tipo_plan_solicitado || '',
      precio_plan: solicitud.plan ? `S/ ${parseFloat(solicitud.plan.precio).toFixed(2)}` : '',
      duracion_plan: solicitud.plan ? `${solicitud.plan.duracion_dias} dias` : '',
      estado: accion,
    };
    if (accion === SUBSCRIPTION_REQUEST_STATUS.APROBADO) {
      // Notificar al vendedor (SSE + push) solo cuando se aprueba
      notificationService.subscriptionRequestUpdated(solicitud.id_vendedor, parseInt(id), accion, subVars);
      notificationService.subscriptionActiveUpdated(solicitud.id_vendedor, solicitud.id_tienda, SUBSCRIPTION_STATUS.ACTIVE, subVars);
    } else {
      // Rechazo: solo SSE a admins para refresh de UI, sin notificar al vendedor
      notificationService.emitSSEToRole('ADMINISTRADOR', 'subscription.request.updated', { id: parseInt(id), status: accion, ...subVars });
    }

    res.json({ mensaje: `Suscripcion ${accion.toLowerCase()}a` });
  } catch (error) {
    console.error('Error aprobando suscripcion:', error);
    res.status(500).json({ error: 'Error al procesar suscripcion' });
  }
};

const updateSubscriptionEndDate = async (req, res) => {
  const { id } = req.params;
  const fecha = req.body.fecha_fin || req.body.fin_en;

  if (!fecha) return res.status(400).json({ error: 'Fecha de fin es requerida' });

  try {
    const antes = await prisma.tbl_suscripciones_activas.findUnique({ where: { id: parseInt(id) } });
    if (!antes) return res.status(404).json({ error: 'Suscripción no encontrada' });

    await prisma.tbl_suscripciones_activas.update({
      where: { id: parseInt(id) },
      data: { fin_en: fecha.includes('T') ? new Date(fecha) : new Date(fecha + 'T12:00:00.000Z') },
    });

    await prisma.tbl_log_auditoria.create({
      data: {
        id_actor: req.user.id,
        accion: 'SUSCRIPCION_EDITAR_VENCIMIENTO',
        tipo_entidad: 'tbl_suscripciones_activas',
        id_entidad: parseInt(id),
        datos_antes: { fin_en: antes.fin_en },
        datos_despues: { fin_en: fecha },
      },
    });

    res.json({ mensaje: 'Fecha de vencimiento actualizada' });
  } catch (error) {
    console.error('Error al actualizar vencimiento:', error);
    res.status(500).json({ error: 'Error al actualizar vencimiento' });
  }
};

// ==================== FINANZAS ====================
const getFinanceSummary = async (req, res) => {
  try {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [totalIngresos, monthlyIngresos, activeSubsAgg, premiumPlan] = await Promise.all([
      // Total: excluir transacciones de tiendas o vendedores eliminados
      prisma.tbl_transacciones_suscripcion.aggregate({
        _sum: { monto: true },
        where: { ...VALID_TRANSACTION_WHERE },
      }),
      // Mensual: criterio temporal unificado a pagado_en, mismo filtro de validez
      prisma.tbl_transacciones_suscripcion.aggregate({
        _sum: { monto: true },
        where: { ...VALID_TRANSACTION_WHERE, pagado_en: { gte: startOfMonth } },
      }),
      // Activas: solo transacciones ACTIVE en tiendas/vendedores no eliminados
      prisma.tbl_transacciones_suscripcion.aggregate({
        _sum: { monto: true },
        _count: true,
        where: { ...VALID_TRANSACTION_WHERE, estado: SUBSCRIPTION_STATUS.ACTIVE },
      }),
      prisma.tbl_planes.findFirst({
        where: { tipo: PLAN_TYPE.PREMIUM, activo: true },
        select: { precio: true, duracion_dias: true },
      }),
    ]);

    res.json({
      totalRevenue: totalIngresos._sum.monto || 0,
      monthlyRevenue: monthlyIngresos._sum.monto || 0,
      activeSubscriptionsRevenue: activeSubsAgg._sum.monto || 0,
      activeSubscriptionsCount: activeSubsAgg._count || 0,
      premiumPrice: premiumPlan?.precio || 0,
      premiumDays: premiumPlan?.duracion_dias || 30,
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener resumen financiero' });
  }
};

const getTransactions = async (req, res) => {
  try {
    const [transactions, metodosPago] = await Promise.all([
      prisma.tbl_transacciones_suscripcion.findMany({
        // Excluir transacciones de tiendas o vendedores eliminados
        where: { ...VALID_TRANSACTION_WHERE },
        include: {
          tbl_tiendas: {
            select: {
              id: true,
              nombre: true,
              tbl_usuarios: { select: { nombre: true } },
              tbl_galerias: { select: { nombre: true } },
            },
          },
        },
        orderBy: { fecha_hora_registro: 'desc' },
      }),
      prisma.tbl_metodos_pago.findMany({ select: { id: true, tipo: true, nombre_banco: true } }),
    ]);

    const metodosMap = Object.fromEntries(metodosPago.map(m => [m.id, m.tipo === 'BANCO' ? `${m.tipo} - ${m.nombre_banco}` : m.tipo]));

    const result = transactions.map(tx => ({
      id: tx.id,
      monto: tx.monto,
      pagado_en: tx.pagado_en,
      inicio_en: tx.inicio_en,
      fin_en: tx.fin_en,
      estado: tx.estado,
      tienda_nombre: tx.tbl_tiendas?.nombre || null,
      vendedor_nombre: tx.tbl_tiendas?.tbl_usuarios?.nombre || null,
      galeria_nombre: tx.tbl_tiendas?.tbl_galerias?.nombre || null,
      metodo_pago: metodosMap[tx.id_metodo_pago] || null,
    }));

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener transacciones' });
  }
};

// ==================== GESTION USUARIOS ====================
const getBuyers = async (req, res) => {
  try {
    const buyers = await prisma.tbl_usuarios.findMany({
      where: { tbl_roles: { nombre: ROLES.COMPRADOR }, eliminado_en: null },
      select: { id: true, nombre: true, correo: true, telefono: true, activo: true, correo_verificado: true, fecha_hora_registro: true, tbl_ciudades: { select: { nombre: true } } },
      orderBy: { fecha_hora_registro: 'desc' },
    });
    const result = buyers.map(b => ({ ...b, estado_cuenta: deriveAccountStatus(b) }));
    res.json({
      compradores: result,
      total: result.length,
      ...countByAccountStatus(result),
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener compradores' });
  }
};

const getSellers = async (req, res) => {
  try {
    const sellers = await prisma.tbl_usuarios.findMany({
      where: { tbl_roles: { nombre: ROLES.VENDEDOR }, eliminado_en: null },
      select: {
        id: true, nombre: true, correo: true, telefono: true, activo: true,
        correo_verificado: true, fecha_hora_registro: true,
        tbl_perfil_vendedor: { select: { estado_aprobacion: true, nombre_negocio: true, ruc: true, dni: true, tipo_comprobante: true, razon_social: true } },
        tiendas: {
          where: { eliminado_en: null },
          select: {
            id: true,
            nombre: true,
            tbl_galerias: {
              select: {
                nombre: true,
                tbl_ciudades: { select: { nombre: true } },
                tbl_zonas: { select: { nombre: true } },
              },
            },
            suscripcion_activa: {
              select: { tipo_plan: true, estado: true },
            },
          },
        },
      },
      orderBy: { fecha_hora_registro: 'desc' },
    });

    const result = sellers.map(s => ({
      ...s,
      estado_cuenta: deriveAccountStatus(s),
      tiendas: s.tiendas.map(t => ({
        id: t.id,
        nombre: t.nombre,
        galeria: t.tbl_galerias?.nombre || null,
        ciudad: t.tbl_galerias?.tbl_ciudades?.nombre || null,
        zona: t.tbl_galerias?.tbl_zonas?.nombre || null,
        tipo_plan: t.suscripcion_activa?.estado === SUBSCRIPTION_STATUS.ACTIVE
          ? (t.suscripcion_activa.tipo_plan === 'REGULAR' ? PLAN_TYPE.ESTANDAR : t.suscripcion_activa.tipo_plan)
          : null,
      })),
      es_premium: s.tiendas.some(t => t.suscripcion_activa?.estado === SUBSCRIPTION_STATUS.ACTIVE && t.suscripcion_activa?.tipo_plan === PLAN_TYPE.PREMIUM),
      datos_facturacion: s.tbl_perfil_vendedor ? {
        tipo_documento: s.tbl_perfil_vendedor.tipo_comprobante,
        ruc: s.tbl_perfil_vendedor.ruc,
        dni: s.tbl_perfil_vendedor.dni,
        razon_social: s.tbl_perfil_vendedor.razon_social,
        nombre_negocio: s.tbl_perfil_vendedor.nombre_negocio,
      } : null,
    }));

    const premium = result.filter(s => s.es_premium).length;
    res.json({
      vendedores: result,
      total: result.length,
      ...countByAccountStatus(result),
      premium,
    });
  } catch (error) {
    console.error('Error al obtener vendedores:', error);
    res.status(500).json({ error: 'Error al obtener vendedores' });
  }
};

const toggleUserActive = async (req, res) => {
  const { id } = req.params;
  const userId = parseInt(id);

  try {
    const user = await prisma.tbl_usuarios.findUnique({
      where: { id: userId },
      select: { activo: true, correo_verificado: true, tbl_roles: { select: { nombre: true } } },
    });

    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const nuevoEstado = !user.activo;
    const esVendedor = user.tbl_roles.nombre === ROLES.VENDEDOR;

    await prisma.$transaction(async (tx) => {
      // 1. Cambiar estado del usuario
      await tx.tbl_usuarios.update({
        where: { id: userId },
        data: {
          activo: nuevoEstado,
          id_usuario_modificacion: req.user.id,
          fecha_hora_modificacion: new Date(),
        },
      });

      // 2. Cascada de tiendas si es vendedor
      if (esVendedor) {
        if (!nuevoEstado) {
          // Deshabilitando vendedor: marcar tiendas activas y desactivarlas
          await tx.tbl_tiendas.updateMany({
            where: { id_vendedor: userId, activo: true, eliminado_en: null },
            data: {
              activo: false,
              desactivada_por_vendedor: true,
              id_usuario_modificacion: req.user.id,
              fecha_hora_modificacion: new Date(),
            },
          });
        } else {
          // Rehabilitando vendedor: restaurar solo las tiendas que fueron desactivadas por cascada
          await tx.tbl_tiendas.updateMany({
            where: { id_vendedor: userId, desactivada_por_vendedor: true, eliminado_en: null },
            data: {
              activo: true,
              desactivada_por_vendedor: false,
              id_usuario_modificacion: req.user.id,
              fecha_hora_modificacion: new Date(),
            },
          });
        }
      }

      // 3. Auditoría
      await tx.tbl_log_auditoria.create({
        data: {
          id_actor: req.user.id,
          accion: nuevoEstado ? 'USUARIO_ACTIVADO' : 'USUARIO_DESACTIVADO',
          tipo_entidad: 'tbl_usuarios',
          id_entidad: userId,
        },
      });
    });

    // Si se desactiva: revocar refresh tokens y notificar al usuario via SSE
    if (!nuevoEstado) {
      await revokeRefreshTokensByUser(userId);
      notificationService.emitSSEOnly(userId, ACCOUNT_DISABLED, {
        error: AUTH_ERROR_CODES.ACCOUNT_DISABLED,
        message: AUTH_MESSAGES.ACCOUNT_DISABLED,
      });
    }

    // Si la cascada afectó tiendas del vendedor, notificar a compradores con favoritos / lista
    // para que su UI refleje al instante el cambio de visibilidad de cada tienda.
    if (esVendedor) {
      const tiendasAfectadas = await prisma.tbl_tiendas.findMany({
        where: { id_vendedor: userId, eliminado_en: null },
        select: { id: true },
      });
      tiendasAfectadas.forEach(t =>
        notificationService.notifyBuyersStoreVisibilityChanged(t.id),
      );
    }

    // Se devuelve el estado ya derivado para que el admin no reimplemente la regla.
    res.json({
      mensaje: nuevoEstado ? 'Usuario activado' : 'Usuario desactivado',
      activo: nuevoEstado,
      estado_cuenta: deriveAccountStatus({
        activo: nuevoEstado,
        correo_verificado: user.correo_verificado,
      }),
    });
  } catch (error) {
    console.error('Error toggleUserActive:', error);
    res.status(500).json({ error: 'Error al cambiar estado del usuario' });
  }
};

const softDeleteUser = async (req, res) => {
  try {
    // No permitir auto-eliminacion
    if (parseInt(req.params.id) === req.user.id) {
      return res.status(400).json({ error: 'No puedes eliminarte a ti mismo' });
    }

    const userId = parseInt(req.params.id);
    const now = new Date();

    // Detectar si es vendedor para aplicar cascada completa (si lo es)
    const userToDelete = await prisma.tbl_usuarios.findUnique({
      where: { id: userId },
      select: { tbl_roles: { select: { nombre: true } } },
    });
    if (!userToDelete) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    const esVendedor = userToDelete.tbl_roles.nombre === ROLES.VENDEDOR;

    await prisma.$transaction(async (tx) => {
      // Si es vendedor, aplicar cascada completa para eliminar todos los rastros:
      // suscripciones, solicitudes, tickets, productos, tiendas.
      if (esVendedor) {
        await cascadeDeleteSellerData(tx, userId, req.user.id, now);
      }

      // Soft delete del usuario y liberar correo para re-registro
      await tx.tbl_usuarios.update({
        where: { id: userId },
        data: {
          correo: `deleted_${now.getTime()}_${userId}@removed`,
          eliminado_en: now,
          activo: false,
          id_usuario_modificacion: req.user.id,
          fecha_hora_modificacion: now,
        },
      });
    });

    await prisma.tbl_log_auditoria.create({
      data: {
        id_actor: req.user.id,
        accion: esVendedor ? 'VENDEDOR_ELIMINADO_CASCADE' : 'USUARIO_ELIMINADO',
        tipo_entidad: 'tbl_usuarios',
        id_entidad: userId,
      },
    });

    // Refrescar pantalla de Finanzas (Web/APK) para que admins vean los nuevos totales
    // sin transacciones del usuario eliminado. Reutiliza el evento al que ya estan suscritos.
    notificationService.emitSSEToRole('ADMINISTRADOR', SUBSCRIPTION_REQUEST_UPDATED, {
      reason: esVendedor ? 'seller_cascade_deleted' : 'user_deleted',
      id_usuario: userId,
    });

    res.json({ mensaje: 'Usuario eliminado' });
  } catch (error) {
    console.error('Error en softDeleteUser:', error);
    res.status(500).json({ error: 'Error al eliminar usuario' });
  }
};

// ==================== CRUD CONFIG ====================
const crudFactory = (model, entityName, allowedFields = [], options = {}) => ({
  getAll: async (req, res) => {
    try {
      const where = options.noSoftDelete ? {} : { eliminado_en: null };
      const data = await prisma[model].findMany({
        where,
        orderBy: { id: 'desc' },
      });
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: `Error al obtener ${entityName}` });
    }
  },
  create: async (req, res) => {
    try {
      const sanitized = {};
      allowedFields.forEach(f => { if (req.body[f] !== undefined) sanitized[f] = req.body[f]; });
      if (!options.noAuditFields) sanitized.id_usuario_registro = req.user.id;
      const item = await prisma[model].create({ data: sanitized });

      await prisma.tbl_log_auditoria.create({
        data: {
          id_actor: req.user.id,
          accion: `${entityName.toUpperCase()}_CREADO`,
          tipo_entidad: model,
          id_entidad: item.id,
          datos_despues: sanitized,
        },
      });

      res.status(201).json({ data: item });
    } catch (error) {
      res.status(500).json({ error: `Error al crear ${entityName}` });
    }
  },
  update: async (req, res) => {
    try {
      const antes = await prisma[model].findUnique({ where: { id: parseInt(req.params.id) } });
      if (!antes) return res.status(404).json({ error: `${entityName} no encontrado` });

      const sanitized = {};
      allowedFields.forEach(f => { if (req.body[f] !== undefined) sanitized[f] = req.body[f]; });
      if (!options.noAuditFields) {
        sanitized.id_usuario_modificacion = req.user.id;
        sanitized.fecha_hora_modificacion = new Date();
      }
      const item = await prisma[model].update({
        where: { id: parseInt(req.params.id) },
        data: sanitized,
      });

      await prisma.tbl_log_auditoria.create({
        data: {
          id_actor: req.user.id,
          accion: `${entityName.toUpperCase()}_ACTUALIZADO`,
          tipo_entidad: model,
          id_entidad: parseInt(req.params.id),
          datos_antes: antes,
          datos_despues: sanitized,
        },
      });

      res.json({ data: item });
    } catch (error) {
      res.status(500).json({ error: `Error al actualizar ${entityName}` });
    }
  },
  softDelete: async (req, res) => {
    try {
      await prisma[model].update({
        where: { id: parseInt(req.params.id) },
        data: { eliminado_en: new Date(), id_usuario_modificacion: req.user.id, fecha_hora_modificacion: new Date() },
      });

      await prisma.tbl_log_auditoria.create({
        data: {
          id_actor: req.user.id,
          accion: `${entityName.toUpperCase()}_ELIMINADO`,
          tipo_entidad: model,
          id_entidad: parseInt(req.params.id),
        },
      });

      res.json({ mensaje: `${entityName} eliminado` });
    } catch (error) {
      res.status(500).json({ error: `Error al eliminar ${entityName}` });
    }
  },
});

const citiesCrud = crudFactory('tbl_ciudades', 'Ciudad', ['nombre', 'activo']);
const zonesCrudBase = crudFactory('tbl_zonas', 'Zona', ['id_ciudad', 'nombre', 'activo']);
const zonesCrud = {
  ...zonesCrudBase,
  getAll: async (req, res) => {
    try {
      const data = await prisma.tbl_zonas.findMany({
        where: { eliminado_en: null },
        include: {
          tbl_ciudades: { select: { id: true, nombre: true } },
        },
        orderBy: { nombre: 'asc' },
      });
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: 'Error al obtener zonas' });
    }
  },
};
const categoriesCrud = crudFactory('tbl_categorias', 'Categoria', ['nombre', 'descripcion', 'activo']);
const galleriesCrudBase = crudFactory('tbl_galerias', 'Galeria', ['id_ciudad', 'id_zona', 'nombre', 'direccion', 'descripcion', 'latitud', 'longitud', 'activo']);
const galleriesCrud = {
  ...galleriesCrudBase,
  getAll: async (req, res) => {
    try {
      const data = await prisma.tbl_galerias.findMany({
        where: { eliminado_en: null },
        include: {
          fotos: { orderBy: { posicion: 'asc' } },
          tbl_zonas: { select: { id: true, nombre: true, id_ciudad: true } },
          tbl_ciudades: { select: { id: true, nombre: true } },
        },
        orderBy: { id: 'desc' },
      });
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: 'Error al obtener galerias' });
    }
  },
};
const faqsCrudBase = crudFactory('tbl_faqs', 'FAQ', ['pregunta', 'respuesta', 'audiencia', 'activo']);
const faqsCrud = {
  ...faqsCrudBase,
  getAll: async (req, res) => {
    try {
      const data = await prisma.tbl_faqs.findMany({
        where: { eliminado_en: null },
        orderBy: { id: 'asc' },
      });
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: 'Error al obtener FAQs' });
    }
  },
};
const paymentMethodsCrud = crudFactory('tbl_metodos_pago', 'Metodo de Pago', ['tipo', 'titular', 'nombre_banco', 'numero_cuenta', 'cci', 'numero_celular', 'activo']);

// Terms & Privacy CRUD
const termsCrud = crudFactory('tbl_versiones_terminos', 'Terminos', ['numero_version', 'titulo', 'contenido', 'es_vigente', 'publicado_en'], { noSoftDelete: true, noAuditFields: true });
const privacyCrud = crudFactory('tbl_versiones_privacidad', 'Privacidad', ['numero_version', 'titulo', 'contenido', 'es_vigente', 'publicado_en'], { noSoftDelete: true, noAuditFields: true });
// Email Templates - handlers dedicados (sin create/delete generico)
const emailTemplatesHandler = {
  getAll: async (req, res) => {
    try {
      const expectedNames = EMAIL_TEMPLATE_DEFAULTS.map(t => t.nombre);
      let templates = await prisma.tbl_plantillas_email.findMany({
        where: { nombre: { in: expectedNames } },
        orderBy: { id: 'asc' },
      });

      // Auto-crear plantillas faltantes si no existen
      if (templates.length < expectedNames.length) {
        const existingNames = templates.map(t => t.nombre);
        const missing = EMAIL_TEMPLATE_DEFAULTS.filter(t => !existingNames.includes(t.nombre));
        for (const tmpl of missing) {
          await prisma.tbl_plantillas_email.create({
            data: { ...tmpl, id_usuario_registro: req.user.id },
          });
        }
        templates = await prisma.tbl_plantillas_email.findMany({
          where: { nombre: { in: expectedNames } },
          orderBy: { id: 'asc' },
        });
      }

      res.json(templates);
    } catch (error) {
      console.error('[EmailTemplates] Error:', error);
      res.status(500).json({ error: 'Error al obtener plantillas' });
    }
  },

  update: async (req, res) => {
    try {
      const { id } = req.params;
      const { asunto_plantilla, sections, cuerpo_plantilla } = req.body;

      const template = await prisma.tbl_plantillas_email.findUnique({ where: { id: parseInt(id) } });
      if (!template) return res.status(404).json({ error: 'Plantilla no encontrada' });

      const updateData = {
        asunto_plantilla,
        id_usuario_modificacion: req.user.id,
        fecha_hora_modificacion: new Date(),
      };

      if (sections && Array.isArray(sections)) {
        // New section-based flow: build HTML from sections
        updateData.cuerpo_plantilla = buildHtmlFromSections(template.nombre, sections);
        updateData.variables_json = {
          ...template.variables_json,
          sections,
        };
      } else if (cuerpo_plantilla) {
        // Legacy raw HTML flow
        updateData.cuerpo_plantilla = cuerpo_plantilla;
      }

      const updated = await prisma.tbl_plantillas_email.update({
        where: { id: parseInt(id) },
        data: updateData,
      });

      await prisma.tbl_log_auditoria.create({
        data: {
          id_actor: req.user.id,
          accion: 'PLANTILLA_EMAIL_ACTUALIZADA',
          tipo_entidad: 'tbl_plantillas_email',
          id_entidad: parseInt(id),
          datos_antes: { asunto_plantilla: template.asunto_plantilla },
          datos_despues: { asunto_plantilla },
        },
      });

      res.json({ data: updated });
    } catch (error) {
      console.error('[EmailTemplates] Update error:', error);
      res.status(500).json({ error: 'Error al actualizar plantilla' });
    }
  },

  preview: async (req, res) => {
    try {
      const { templateName, sections } = req.body;
      if (!templateName || !sections) {
        return res.status(400).json({ error: 'templateName y sections son requeridos' });
      }

      let html = buildHtmlFromSections(templateName, sections);

      // Replace variables with sample data (logo_url must be absolute for iframe preview)
      const baseUrl = process.env.BACKEND_URL
        || (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : null)
        || `http://localhost:${process.env.PORT || 4002}`;
      const sampleData = { ...SAMPLE_DATA, logo_url: `${baseUrl}/api/catalog/files/assets/logo.png` };
      for (const [key, value] of Object.entries(sampleData)) {
        html = html.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value || '');
      }

      res.json({ html });
    } catch (error) {
      console.error('[EmailTemplates] Preview error:', error);
      res.status(500).json({ error: 'Error al generar vista previa' });
    }
  },

  reset: async (req, res) => {
    try {
      for (const tmpl of EMAIL_TEMPLATE_DEFAULTS) {
        await prisma.tbl_plantillas_email.upsert({
          where: { nombre: tmpl.nombre },
          create: { ...tmpl, id_usuario_registro: req.user.id },
          update: {
            asunto_plantilla: tmpl.asunto_plantilla,
            cuerpo_plantilla: tmpl.cuerpo_plantilla,
            variables_json: tmpl.variables_json,
            id_usuario_modificacion: req.user.id,
            fecha_hora_modificacion: new Date(),
          },
        });
      }

      await prisma.tbl_log_auditoria.create({
        data: {
          id_actor: req.user.id,
          accion: 'PLANTILLAS_EMAIL_RESTAURADAS',
          tipo_entidad: 'tbl_plantillas_email',
          id_entidad: 0,
        },
      });

      res.json({ mensaje: 'Plantillas restauradas a valores predeterminados' });
    } catch (error) {
      console.error('[EmailTemplates] Reset error:', error);
      res.status(500).json({ error: 'Error al restaurar plantillas' });
    }
  },
};
const plansCrud = crudFactory('tbl_planes', 'Plan', ['nombre', 'precio', 'duracion_dias'], { noSoftDelete: true });

// Override getAll to include features
plansCrud.getAll = async (req, res) => {
  try {
    let data;
    try {
      data = await prisma.tbl_planes.findMany({
        orderBy: { id: 'desc' },
        include: {
          caracteristicas: { orderBy: { orden: 'asc' } },
        },
      });
    } catch {
      // Fallback: tabla caracteristicas no existe aun (migracion pendiente)
      data = await prisma.tbl_planes.findMany({ orderBy: { id: 'desc' } });
      data = data.map(p => ({ ...p, caracteristicas: [] }));
    }
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener planes' });
  }
};

// ---- Plan Features CRUD ----
const getPlanFeatures = async (req, res) => {
  try {
    const id_plan = parseInt(req.params.id);
    const plan = await prisma.tbl_planes.findUnique({ where: { id: id_plan } });
    if (!plan) return res.status(404).json({ error: 'Plan no encontrado' });

    try {
      const features = await prisma.tbl_caracteristicas_plan.findMany({
        where: { id_plan },
        orderBy: { orden: 'asc' },
      });
      res.json(features);
    } catch {
      res.json([]);
    }
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener caracteristicas' });
  }
};

const createPlanFeature = async (req, res) => {
  try {
    const id_plan = parseInt(req.params.id);
    const { texto } = req.body;

    if (!texto || texto.trim().length < 3) {
      return res.status(400).json({ error: 'El texto debe tener al menos 3 caracteres' });
    }
    if (texto.trim().length > 200) {
      return res.status(400).json({ error: 'El texto no puede exceder 200 caracteres' });
    }

    const plan = await prisma.tbl_planes.findUnique({ where: { id: id_plan } });
    if (!plan) return res.status(404).json({ error: 'Plan no encontrado' });

    const maxOrden = await prisma.tbl_caracteristicas_plan.aggregate({
      where: { id_plan },
      _max: { orden: true },
    });

    const feature = await prisma.tbl_caracteristicas_plan.create({
      data: {
        id_plan,
        texto: texto.trim(),
        orden: (maxOrden._max.orden || 0) + 1,
      },
    });
    res.status(201).json(feature);
  } catch (error) {
    res.status(500).json({ error: 'Error al crear caracteristica' });
  }
};

const updatePlanFeature = async (req, res) => {
  try {
    const id_plan = parseInt(req.params.id);
    const featureId = parseInt(req.params.featureId);
    const { texto } = req.body;

    if (!texto || texto.trim().length < 3) {
      return res.status(400).json({ error: 'El texto debe tener al menos 3 caracteres' });
    }
    if (texto.trim().length > 200) {
      return res.status(400).json({ error: 'El texto no puede exceder 200 caracteres' });
    }

    const feature = await prisma.tbl_caracteristicas_plan.findFirst({
      where: { id: featureId, id_plan },
    });
    if (!feature) return res.status(404).json({ error: 'Caracteristica no encontrada' });

    const updated = await prisma.tbl_caracteristicas_plan.update({
      where: { id: featureId },
      data: { texto: texto.trim() },
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Error al actualizar caracteristica' });
  }
};

const deletePlanFeature = async (req, res) => {
  try {
    const id_plan = parseInt(req.params.id);
    const featureId = parseInt(req.params.featureId);

    const feature = await prisma.tbl_caracteristicas_plan.findFirst({
      where: { id: featureId, id_plan },
    });
    if (!feature) return res.status(404).json({ error: 'Caracteristica no encontrada' });

    await prisma.tbl_caracteristicas_plan.delete({ where: { id: featureId } });
    res.json({ message: 'ok' });
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar caracteristica' });
  }
};

const reorderPlanFeatures = async (req, res) => {
  try {
    const id_plan = parseInt(req.params.id);
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Se requiere un array de ids' });
    }

    const features = await prisma.tbl_caracteristicas_plan.findMany({
      where: { id_plan },
    });
    const validIds = new Set(features.map((f) => f.id));
    const allValid = ids.every((id) => validIds.has(id));
    if (!allValid) {
      return res.status(400).json({ error: 'Algunos ids no pertenecen a este plan' });
    }

    await prisma.$transaction(
      ids.map((id, index) =>
        prisma.tbl_caracteristicas_plan.update({
          where: { id },
          data: { orden: index + 1 },
        })
      )
    );

    const updated = await prisma.tbl_caracteristicas_plan.findMany({
      where: { id_plan },
      orderBy: { orden: 'asc' },
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Error al reordenar caracteristicas' });
  }
};

const systemConfigCrud = crudFactory('tbl_configuracion_sistema', 'Configuracion', ['valor'], { noSoftDelete: true });

// ==================== REPORTES ====================
const getReports = async (req, res) => {
  try {
    const { period } = req.query; // week, month, all
    const now = new Date();
    let since = null;

    if (period === 'week') {
      since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    } else if (period === 'month') {
      since = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    const dateFilter = since ? { fecha_hora_registro: { gte: since } } : {};

    // === RESUMEN GENERAL (4 cards) ===
    const [totalBuyers, totalSellers, totalActiveSubs, totalIngresos] = await Promise.all([
      prisma.tbl_usuarios.count({ where: { tbl_roles: { nombre: ROLES.COMPRADOR }, activo: true, eliminado_en: null } }),
      prisma.tbl_usuarios.count({ where: { tbl_roles: { nombre: ROLES.VENDEDOR }, activo: true, eliminado_en: null } }),
      prisma.tbl_suscripciones_activas.count({ where: { estado: SUBSCRIPTION_STATUS.ACTIVE, fin_en: { gte: now } } }),
      // Ingresos del periodo: usa pagado_en (criterio temporal unificado) y excluye tiendas/vendedores eliminados
      prisma.tbl_transacciones_suscripcion.aggregate({
        _sum: { monto: true },
        where: {
          ...VALID_TRANSACTION_WHERE,
          ...(since ? { pagado_en: { gte: since } } : {}),
        },
      }),
    ]);

    // === PRODUCTOS (barras) ===
    const [productosAprobados, productosPendientes, productosTotal] = await Promise.all([
      prisma.tbl_productos.count({ where: { estado_aprobacion: APPROVAL_STATUS.APROBADO, eliminado_en: null, ...dateFilter } }),
      prisma.tbl_productos.count({ where: { estado_aprobacion: APPROVAL_STATUS.PENDIENTE, eliminado_en: null, ...dateFilter } }),
      prisma.tbl_productos.count({ where: { eliminado_en: null, ...dateFilter } }),
    ]);

    // === ACTIVIDAD DEL PERIODO ===
    const [nuevosUsuarios, nuevosProductos, sesionesActivas] = await Promise.all([
      prisma.tbl_usuarios.count({ where: { eliminado_en: null, ...dateFilter } }),
      prisma.tbl_productos.count({ where: { eliminado_en: null, ...dateFilter } }),
      prisma.tbl_tokens_refresco.count({
        where: {
          revocado_en: null,
          expira_en: { gte: now },
          ...(since ? { fecha_hora_registro: { gte: since } } : {}),
        },
      }),
    ]);

    // === TOP 5 VENDEDORES (por rating de tienda) ===
    // Excluir tiendas con tienda o vendedor eliminado para que NO aparezcan
    // en el ranking tras la eliminacion del vendedor.
    const topVendedores = await prisma.tbl_agregados_cal_tiendas.findMany({
      where: {
        promedio: { gt: 0 },
        tbl_tiendas: {
          eliminado_en: null,
          tbl_usuarios: { eliminado_en: null },
        },
      },
      orderBy: { promedio: 'desc' },
      take: 5,
      select: {
        promedio: true,
        tbl_tiendas: { select: { id: true, nombre: true } },
      },
    });

    let topList = topVendedores.map(t => ({
      id: t.tbl_tiendas.id,
      nombre: t.tbl_tiendas.nombre,
      rating: parseFloat(t.promedio),
    }));

    if (topList.length < 5) {
      const existingIds = topList.map(t => t.id);
      const extraStores = await prisma.tbl_tiendas.findMany({
        where: {
          eliminado_en: null,
          tbl_usuarios: { eliminado_en: null },
          estado_aprobacion: APPROVAL_STATUS.APROBADO,
          id: { notIn: existingIds },
        },
        take: 5 - topList.length,
        select: { id: true, nombre: true },
        orderBy: { fecha_hora_registro: 'desc' },
      });
      topList = [...topList, ...extraStores.map(s => ({ id: s.id, nombre: s.nombre, rating: 0 }))];
    }

    res.json({
      period: period || 'all',
      total_compradores: totalBuyers,
      total_vendedores: totalSellers,
      premium_activos: totalActiveSubs,
      ingresos_totales: totalIngresos._sum.monto || 0,
      productos: {
        aprobados: productosAprobados,
        pendientes: productosPendientes,
        total: productosTotal,
      },
      actividad_periodo: {
        nuevos_usuarios: nuevosUsuarios,
        nuevos_productos: nuevosProductos,
        sesiones_activas: sesionesActivas,
      },
      top_vendedores: topList,
      distribucion_usuarios: {
        compradores: totalBuyers,
        vendedores: totalSellers,
      },
    });
  } catch (error) {
    console.error('Error en reportes:', error);
    res.status(500).json({ error: 'Error al obtener reportes' });
  }
};

// ==================== ADMIN CRUD (gestión administradores) ====================
const getAdmins = async (req, res) => {
  try {
    const admins = await prisma.tbl_usuarios.findMany({
      where: { tbl_roles: { nombre: ROLES.ADMINISTRADOR }, eliminado_en: null },
      select: { id: true, nombre: true, correo: true, telefono: true, activo: true, fecha_hora_registro: true, id_usuario_registro: true },
      orderBy: { fecha_hora_registro: 'desc' },
    });
    res.json(admins);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener administradores' });
  }
};

const deleteAdmin = async (req, res) => {
  const adminId = parseInt(req.params.id);
  if (isNaN(adminId)) return res.status(400).json({ error: 'ID invalido' });
  if (adminId === req.user.id) return res.status(400).json({ error: 'No puedes eliminarte a ti mismo' });

  try {
    const admin = await prisma.tbl_usuarios.findFirst({
      where: { id: adminId, eliminado_en: null, tbl_roles: { nombre: ROLES.ADMINISTRADOR } },
    });
    if (!admin) return res.status(404).json({ error: 'Administrador no encontrado' });
    if (!admin.id_usuario_registro) return res.status(403).json({ error: 'No se puede eliminar al administrador principal' });

    await prisma.tbl_usuarios.update({
      where: { id: adminId },
      data: { eliminado_en: new Date(), activo: false, id_usuario_modificacion: req.user.id, fecha_hora_modificacion: new Date() },
    });

    await prisma.tbl_log_auditoria.create({
      data: { id_actor: req.user.id, accion: 'ADMIN_ELIMINADO', tipo_entidad: 'tbl_usuarios', id_entidad: adminId },
    });

    res.json({ mensaje: 'Administrador eliminado exitosamente' });
  } catch (error) {
    console.error('Error eliminando admin:', error);
    res.status(500).json({ error: 'Error al eliminar administrador' });
  }
};

const updateAdmin = async (req, res) => {
  const adminId = parseInt(req.params.id);
  if (isNaN(adminId)) return res.status(400).json({ error: 'ID invalido' });

  try {
    const admin = await prisma.tbl_usuarios.findFirst({
      where: { id: adminId, eliminado_en: null, tbl_roles: { nombre: ROLES.ADMINISTRADOR } },
    });
    if (!admin) return res.status(404).json({ error: 'Administrador no encontrado' });

    const { nombre, correo, telefono, contrasena } = req.body;
    if (!nombre && !correo && !telefono && !contrasena) {
      return res.status(400).json({ error: 'Debe enviar al menos un campo para actualizar' });
    }

    const data = { id_usuario_modificacion: req.user.id, fecha_hora_modificacion: new Date() };

    if (nombre) data.nombre = nombre;
    if (telefono !== undefined) data.telefono = telefono || null;

    if (correo && correo !== admin.correo) {
      const existe = await prisma.tbl_usuarios.findFirst({ where: { correo, eliminado_en: null, id: { not: adminId } } });
      if (existe) return res.status(409).json({ error: 'El correo ya esta registrado' });
      data.correo = correo;
    }

    if (contrasena) {
      if (contrasena.length < 8) return res.status(400).json({ error: 'La contrasena debe tener al menos 8 caracteres' });
      const bcrypt = require('bcrypt');
      data.contrasena = await bcrypt.hash(contrasena, 10);
    }

    await prisma.tbl_usuarios.update({ where: { id: adminId }, data });

    await prisma.tbl_log_auditoria.create({
      data: { id_actor: req.user.id, accion: 'ADMIN_ACTUALIZADO', tipo_entidad: 'tbl_usuarios', id_entidad: adminId },
    });

    res.json({ mensaje: 'Administrador actualizado exitosamente' });
  } catch (error) {
    console.error('Error actualizando admin:', error);
    res.status(500).json({ error: 'Error al actualizar administrador' });
  }
};

const createAdmin = async (req, res) => {
  const nombre = req.body.nombre || [req.body.nombres, req.body.apellidos].filter(Boolean).join(' ');
  const { correo, contrasena, telefono } = req.body;
  if (!nombre || !correo || !contrasena) {
    return res.status(400).json({ error: 'Nombre, correo y contrasena son requeridos' });
  }

  try {
    const bcrypt = require('bcrypt');
    const existe = await prisma.tbl_usuarios.findFirst({ where: { correo, eliminado_en: null } });
    if (existe) return res.status(409).json({ error: 'El correo ya esta registrado' });

    const rolAdmin = await prisma.tbl_roles.findFirst({ where: { nombre: ROLES.ADMINISTRADOR, estado: 1 } });
    if (!rolAdmin) return res.status(500).json({ error: 'Rol ADMINISTRADOR no configurado' });

    const passwordHash = await bcrypt.hash(contrasena, 10);
    const admin = await prisma.tbl_usuarios.create({
      data: {
        nombre,
        correo,
        telefono: telefono || null,
        contrasena: passwordHash,
        id_rol: rolAdmin.id,
        correo_verificado: true,
        activo: true,
        id_usuario_registro: req.user.id,
      },
    });

    await prisma.tbl_log_auditoria.create({
      data: { id_actor: req.user.id, accion: 'ADMIN_CREADO', tipo_entidad: 'tbl_usuarios', id_entidad: admin.id },
    });

    res.status(201).json({ data: { id: admin.id, nombre: admin.nombre, correo: admin.correo } });
  } catch (error) {
    console.error('Error creando admin:', error);
    res.status(500).json({ error: 'Error al crear administrador' });
  }
};

// ==================== CASCADE DELETE SELLER ====================
// Helper: cascada completa para eliminar todos los rastros de un vendedor.
// Reusado por cascadeDeleteSeller y softDeleteUser (cuando es vendedor).
// Garantiza comportamiento consistente entre ambas vias de eliminacion.
//
// Acciones (todas dentro de la transaccion del caller):
//   1. Expirar suscripciones activas (estado ACTIVE -> EXPIRED).
//   2. Marcar solicitudes de suscripcion como ELIMINADO (no aparecen en panel).
//   3. Cerrar tickets abiertos contra tiendas del vendedor (ATENDIDO / ADMIN_CLOSED).
//   4. Soft-delete productos (eliminado_en = now, estado = INACTIVE).
//   5. Soft-delete tiendas (eliminado_en = now, activo = false).
//
// Idempotente: cada updateMany filtra por estado para no reprocesar.
const cascadeDeleteSellerData = async (tx, sellerId, adminUserId, now) => {
  // 1. Expirar suscripciones activas
  await tx.tbl_suscripciones_activas.updateMany({
    where: { tbl_tiendas: { id_vendedor: sellerId }, estado: SUBSCRIPTION_STATUS.ACTIVE },
    data: { estado: SUBSCRIPTION_STATUS.EXPIRED },
  });

  // 2. Marcar solicitudes de suscripcion del vendedor como ELIMINADO
  //    (no las eliminamos fisicamente para preservar auditoria, pero filtros las ignoran)
  await tx.tbl_solicitudes_suscripcion.updateMany({
    where: {
      id_vendedor: sellerId,
      estado: { not: SUBSCRIPTION_REQUEST_STATUS.ELIMINADO },
    },
    data: {
      estado: SUBSCRIPTION_REQUEST_STATUS.ELIMINADO,
      id_usuario_modificacion: adminUserId,
      fecha_hora_modificacion: now,
    },
  });

  // 3. Cerrar tickets abiertos contra tiendas del vendedor.
  //    Motivo: ADMIN_CLOSED para auditar el cierre por eliminacion del vendedor.
  await tx.tbl_tickets.updateMany({
    where: {
      tbl_tiendas: { id_vendedor: sellerId },
      estado: { not: TICKET_STATUS.ATENDIDO },
    },
    data: {
      estado: TICKET_STATUS.ATENDIDO,
      cerrado_por: 'ADMIN',
      motivo_cierre: TICKET_CLOSE_REASON.ADMIN_CLOSED,
      id_usuario_modificacion: adminUserId,
      fecha_hora_modificacion: now,
    },
  });

  // 4. Soft-delete productos
  await tx.tbl_productos.updateMany({
    where: { tbl_tiendas: { id_vendedor: sellerId }, eliminado_en: null },
    data: { eliminado_en: now, estado: PRODUCT_STATE.INACTIVE },
  });

  // 5. Soft-delete tiendas
  await tx.tbl_tiendas.updateMany({
    where: { id_vendedor: sellerId, eliminado_en: null },
    data: { eliminado_en: now, activo: false },
  });
};

const cascadeDeleteSeller = async (req, res) => {
  const sellerId = parseInt(req.params.id);
  if (sellerId === req.user.id) {
    return res.status(400).json({ error: 'No puedes eliminarte a ti mismo' });
  }

  try {
    const seller = await prisma.tbl_usuarios.findFirst({
      where: { id: sellerId, tbl_roles: { nombre: ROLES.VENDEDOR }, eliminado_en: null },
    });
    if (!seller) return res.status(404).json({ error: 'Vendedor no encontrado' });

    const now = new Date();

    await prisma.$transaction(async (tx) => {
      // Cascada completa: suscripciones, solicitudes, tickets, productos, tiendas.
      await cascadeDeleteSellerData(tx, sellerId, req.user.id, now);

      // Soft delete usuario y liberar correo para re-registro
      await tx.tbl_usuarios.update({
        where: { id: sellerId },
        data: { correo: `deleted_${now.getTime()}_${sellerId}@removed`, eliminado_en: now, activo: false, id_usuario_modificacion: req.user.id, fecha_hora_modificacion: now },
      });
    });

    await prisma.tbl_log_auditoria.create({
      data: { id_actor: req.user.id, accion: 'VENDEDOR_ELIMINADO_CASCADE', tipo_entidad: 'tbl_usuarios', id_entidad: sellerId },
    });

    // Refrescar pantalla de Finanzas (Web/APK) para que admins vean los nuevos totales
    // sin transacciones del vendedor eliminado. Reutiliza el evento al que ya estan suscritos.
    notificationService.emitSSEToRole('ADMINISTRADOR', SUBSCRIPTION_REQUEST_UPDATED, {
      reason: 'seller_cascade_deleted',
      id_vendedor: sellerId,
    });

    res.json({ mensaje: 'Vendedor eliminado con cascada' });
  } catch (error) {
    console.error('Error eliminando vendedor:', error);
    res.status(500).json({ error: 'Error al eliminar vendedor' });
  }
};

// ==================== USUARIOS INACTIVOS ====================
const getInactiveUsers = async (req, res) => {
  try {
    const { days = 30, type = 'all' } = req.query;
    const daysNum = parseInt(days) || 30;
    const since = new Date(Date.now() - daysNum * 24 * 60 * 60 * 1000);

    const roleFilter = {};
    if (type === 'compradores') {
      roleFilter.tbl_roles = { nombre: ROLES.COMPRADOR };
    } else if (type === 'vendedores') {
      roleFilter.tbl_roles = { nombre: ROLES.VENDEDOR };
    } else {
      roleFilter.tbl_roles = { nombre: { in: [ROLES.COMPRADOR, ROLES.VENDEDOR] } };
    }

    const users = await prisma.tbl_usuarios.findMany({
      where: {
        ...roleFilter,
        activo: true,
        eliminado_en: null,
        OR: [
          { ultimo_login: null },
          { ultimo_login: { lt: since } },
        ],
      },
      select: {
        id: true,
        nombre: true,
        correo: true,
        ultimo_login: true,
        tbl_roles: { select: { nombre: true } },
      },
      orderBy: { ultimo_login: 'asc' },
    });

    const result = users.map(u => ({
      id: u.id,
      nombre: u.nombre,
      correo: u.correo,
      rol: u.tbl_roles.nombre === ROLES.COMPRADOR ? 'Comprador' : 'Vendedor',
      ultimo_login: u.ultimo_login,
    }));

    res.json({ total: result.length, usuarios: result });
  } catch (error) {
    console.error('Error obteniendo usuarios inactivos:', error);
    res.status(500).json({ error: 'Error al obtener usuarios inactivos' });
  }
};

// ==================== PUSH NOTIFICATIONS CONFIG ====================
const pushNotificationsHandler = {
  getAll: async (req, res) => {
    try {
      const expectedEvents = PUSH_NOTIFICATION_DEFAULTS.map(t => t.evento);
      let configs = await prisma.tbl_config_notificaciones_push.findMany({
        orderBy: { id: 'asc' },
      });

      const existingEvents = configs.map(c => c.evento);

      // Eliminar eventos obsoletos que ya no estan en los defaults
      const obsolete = configs.filter(c => !expectedEvents.includes(c.evento));
      if (obsolete.length > 0) {
        await prisma.tbl_config_notificaciones_push.deleteMany({
          where: { id: { in: obsolete.map(o => o.id) } },
        });
      }

      // Auto-crear registros faltantes si no existen
      const missing = PUSH_NOTIFICATION_DEFAULTS.filter(t => !existingEvents.includes(t.evento));
      if (missing.length > 0) {
        for (const tmpl of missing) {
          await prisma.tbl_config_notificaciones_push.create({
            data: { ...tmpl, id_usuario_registro: req.user.id },
          });
        }
      }

      // Re-leer si hubo cambios e invalidar cache del pushService
      if (obsolete.length > 0 || missing.length > 0) {
        configs = await prisma.tbl_config_notificaciones_push.findMany({
          orderBy: { id: 'asc' },
        });
        pushService.invalidateTemplateCache();
      }

      res.json({ items: configs, variables: PUSH_VARIABLE_MAP });
    } catch (error) {
      console.error('[PushConfig] Error:', error);
      res.status(500).json({ error: 'Error al obtener configuracion de notificaciones push' });
    }
  },

  update: async (req, res) => {
    try {
      const { id } = req.params;
      const { titulo, mensaje, rol_destinatario, activo } = req.body;

      const config = await prisma.tbl_config_notificaciones_push.findUnique({ where: { id: parseInt(id) } });
      if (!config) return res.status(404).json({ error: 'Configuracion no encontrada' });

      const updateData = {};
      if (titulo !== undefined) updateData.titulo = titulo;
      if (mensaje !== undefined) updateData.mensaje = mensaje;
      if (rol_destinatario !== undefined) updateData.rol_destinatario = rol_destinatario || null;
      if (activo !== undefined) updateData.activo = activo;
      updateData.id_usuario_modificacion = req.user.id;
      updateData.fecha_hora_modificacion = new Date();

      const updated = await prisma.tbl_config_notificaciones_push.update({
        where: { id: parseInt(id) },
        data: updateData,
      });

      await prisma.tbl_log_auditoria.create({
        data: {
          id_actor: req.user.id,
          accion: 'PUSH_CONFIG_ACTUALIZADA',
          tipo_entidad: 'tbl_config_notificaciones_push',
          id_entidad: parseInt(id),
          datos_antes: { titulo: config.titulo, mensaje: config.mensaje, rol_destinatario: config.rol_destinatario, activo: config.activo },
          datos_despues: { titulo: updated.titulo, mensaje: updated.mensaje, rol_destinatario: updated.rol_destinatario, activo: updated.activo },
        },
      });

      // Invalidar cache del pushService
      pushService.invalidateTemplateCache();

      res.json({ data: updated });
    } catch (error) {
      console.error('[PushConfig] Update error:', error);
      res.status(500).json({ error: 'Error al actualizar configuracion' });
    }
  },

  reset: async (req, res) => {
    try {
      for (const tmpl of PUSH_NOTIFICATION_DEFAULTS) {
        await prisma.tbl_config_notificaciones_push.upsert({
          where: { evento: tmpl.evento },
          create: { ...tmpl, id_usuario_registro: req.user.id },
          update: {
            titulo: tmpl.titulo,
            mensaje: tmpl.mensaje,
            rol_destinatario: tmpl.rol_destinatario,
            activo: true,
            id_usuario_modificacion: req.user.id,
            fecha_hora_modificacion: new Date(),
          },
        });
      }

      await prisma.tbl_log_auditoria.create({
        data: {
          id_actor: req.user.id,
          accion: 'PUSH_CONFIG_RESTAURADA',
          tipo_entidad: 'tbl_config_notificaciones_push',
          id_entidad: 0,
        },
      });

      // Invalidar cache del pushService
      pushService.invalidateTemplateCache();

      res.json({ mensaje: 'Configuracion de notificaciones push restaurada a valores predeterminados' });
    } catch (error) {
      console.error('[PushConfig] Reset error:', error);
      res.status(500).json({ error: 'Error al restaurar configuracion' });
    }
  },
};

// ==================== BULK DELETE REJECTED ====================

const bulkDeleteRejectedStores = async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'Se requiere un array de IDs' });
  }

  try {
    const tiendas = await prisma.tbl_tiendas.findMany({
      where: { id: { in: ids.map(Number) }, eliminado_en: null },
      select: { id: true, estado_aprobacion: true },
    });

    const noRechazadas = tiendas.filter(t => t.estado_aprobacion !== APPROVAL_STATUS.RECHAZADO);
    if (noRechazadas.length > 0) {
      return res.status(400).json({ error: `${noRechazadas.length} tienda(s) no están en estado RECHAZADO` });
    }

    if (tiendas.length === 0) {
      return res.status(404).json({ error: 'No se encontraron tiendas con los IDs proporcionados' });
    }

    const now = new Date();
    const storeIds = tiendas.map(t => t.id);

    await prisma.$transaction(async (tx) => {
      // 1. Soft-delete productos de las tiendas
      await tx.tbl_productos.updateMany({
        where: { id_tienda: { in: storeIds }, eliminado_en: null },
        data: { eliminado_en: now, estado: PRODUCT_STATE.INACTIVE },
      });

      // 2. Soft-delete tiendas
      await tx.tbl_tiendas.updateMany({
        where: { id: { in: storeIds } },
        data: {
          eliminado_en: now,
          activo: false,
          id_usuario_modificacion: req.user.id,
          fecha_hora_modificacion: now,
        },
      });
    });

    await prisma.tbl_log_auditoria.create({
      data: {
        id_actor: req.user.id,
        accion: 'TIENDAS_RECHAZADAS_ELIMINADAS',
        tipo_entidad: 'tbl_tiendas',
        datos_despues: { ids_eliminados: storeIds, total: tiendas.length },
      },
    });


    res.json({ mensaje: `${tiendas.length} tienda(s) eliminada(s)` });
  } catch (error) {
    console.error('Error eliminando tiendas rechazadas:', error);
    res.status(500).json({ error: 'Error al eliminar tiendas' });
  }
};

const bulkDeleteRejectedProducts = async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'Se requiere un array de IDs' });
  }

  try {
    const productos = await prisma.tbl_productos.findMany({
      where: { id: { in: ids.map(Number) }, eliminado_en: null },
      select: { id: true, estado_aprobacion: true },
    });

    const noRechazados = productos.filter(p => p.estado_aprobacion !== APPROVAL_STATUS.RECHAZADO);
    if (noRechazados.length > 0) {
      return res.status(400).json({ error: `${noRechazados.length} producto(s) no están en estado RECHAZADO` });
    }

    if (productos.length === 0) {
      return res.status(404).json({ error: 'No se encontraron productos con los IDs proporcionados' });
    }

    const now = new Date();
    const productIds = productos.map(p => p.id);

    await prisma.tbl_productos.updateMany({
      where: { id: { in: productIds } },
      data: {
        eliminado_en: now,
        estado: PRODUCT_STATE.INACTIVE,
        id_usuario_modificacion: req.user.id,
        fecha_hora_modificacion: now,
      },
    });

    await prisma.tbl_log_auditoria.create({
      data: {
        id_actor: req.user.id,
        accion: 'PRODUCTOS_RECHAZADOS_ELIMINADOS',
        tipo_entidad: 'tbl_productos',
        datos_despues: { ids_eliminados: productIds, total: productos.length },
      },
    });


    res.json({ mensaje: `${productos.length} producto(s) eliminado(s)` });
  } catch (error) {
    console.error('Error eliminando productos rechazados:', error);
    res.status(500).json({ error: 'Error al eliminar productos' });
  }
};

const bulkDeleteRejectedSubscriptions = async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'Se requiere un array de IDs' });
  }

  try {
    const solicitudes = await prisma.tbl_solicitudes_suscripcion.findMany({
      where: { id: { in: ids.map(Number) } },
      select: { id: true, estado: true },
    });

    const noRechazadas = solicitudes.filter(s => s.estado !== APPROVAL_STATUS.RECHAZADO);
    if (noRechazadas.length > 0) {
      return res.status(400).json({ error: `${noRechazadas.length} solicitud(es) no están en estado RECHAZADO` });
    }

    if (solicitudes.length === 0) {
      return res.status(404).json({ error: 'No se encontraron solicitudes con los IDs proporcionados' });
    }

    const solicitudIds = solicitudes.map(s => s.id);

    await prisma.tbl_solicitudes_suscripcion.updateMany({
      where: { id: { in: solicitudIds } },
      data: {
        estado: SUBSCRIPTION_REQUEST_STATUS.ELIMINADO,
        id_usuario_modificacion: req.user.id,
        fecha_hora_modificacion: new Date(),
      },
    });

    await prisma.tbl_log_auditoria.create({
      data: {
        id_actor: req.user.id,
        accion: 'SUSCRIPCIONES_RECHAZADAS_ELIMINADAS',
        tipo_entidad: 'tbl_solicitudes_suscripcion',
        datos_despues: { ids_eliminados: solicitudIds, total: solicitudes.length },
      },
    });


    res.json({ mensaje: `${solicitudes.length} solicitud(es) eliminada(s)` });
  } catch (error) {
    console.error('Error eliminando solicitudes rechazadas:', error);
    res.status(500).json({ error: 'Error al eliminar solicitudes' });
  }
};

module.exports = {
  getDashboard,
  getPendingStores, approveStore,
  getPendingProducts, approveProduct,
  getSubscriptionRequests, approveSubscription, updateSubscriptionEndDate,
  getFinanceSummary, getTransactions, getReports, getInactiveUsers,
  getBuyers, getSellers, toggleUserActive, softDeleteUser, cascadeDeleteSeller,
  cascadeDeleteSellerData,
  getAdmins, createAdmin, updateAdmin, deleteAdmin,
  bulkDeleteRejectedStores,
  bulkDeleteRejectedProducts, bulkDeleteRejectedSubscriptions,
  citiesCrud, zonesCrud, galleriesCrud, categoriesCrud, faqsCrud, paymentMethodsCrud,
  termsCrud, privacyCrud, emailTemplatesHandler, plansCrud, systemConfigCrud,
  getPlanFeatures, createPlanFeature, updatePlanFeature, deletePlanFeature, reorderPlanFeatures,
  pushNotificationsHandler,
};
