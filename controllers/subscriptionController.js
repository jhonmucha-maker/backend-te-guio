const prisma = require('../config/db');
const notificationService = require('../services/notificationService');

const requestSubscription = async (req, res) => {
  const { id_tienda, id_plan, id_metodo_pago } = req.body;

  if (!id_tienda || !id_plan || !id_metodo_pago) {
    return res.status(400).json({ error: 'Tienda, plan y método de pago son requeridos' });
  }

  try {
    const tienda = await prisma.tbl_tiendas.findFirst({
      where: { id: parseInt(id_tienda), id_vendedor: req.user.id, eliminado_en: null },
    });
    if (!tienda) return res.status(400).json({ error: 'Tienda no válida' });

    const plan = await prisma.tbl_planes.findFirst({
      where: { id: parseInt(id_plan), activo: true },
    });
    if (!plan) return res.status(400).json({ error: 'Plan no válido' });

    const metodo = await prisma.tbl_metodos_pago.findFirst({
      where: { id: parseInt(id_metodo_pago), activo: true, eliminado_en: null },
    });
    if (!metodo) return res.status(400).json({ error: 'Método de pago no válido' });

    const solicitud = await prisma.tbl_solicitudes_suscripcion.create({
      data: {
        id_tienda: parseInt(id_tienda),
        id_plan: parseInt(id_plan),
        tipo_plan_solicitado: plan.tipo,
        id_metodo_pago: parseInt(id_metodo_pago),
        estado: 'PENDIENTE',
        id_vendedor: req.user.id,
        id_usuario_registro: req.user.id,
      },
    });

    // Guardar comprobante principal
    const comprobante = req.files?.comprobante?.[0];
    if (comprobante) {
      await prisma.tbl_archivos_solicitudes_suscripcion.create({
        data: {
          id_solicitud: solicitud.id,
          url_archivo: comprobante.s3Url,
          tipo_archivo: comprobante.mimetype.startsWith('image/') ? 'IMAGE' : 'PDF',
          es_comprobante: true,
          tamano_bytes: comprobante.size,
        },
      });
    }

    // Guardar imágenes adicionales
    const adicionales = req.files?.imagenes_adicionales || [];
    for (const img of adicionales) {
      await prisma.tbl_archivos_solicitudes_suscripcion.create({
        data: {
          id_solicitud: solicitud.id,
          url_archivo: img.s3Url,
          tipo_archivo: 'IMAGE',
          es_comprobante: false,
          tamano_bytes: img.size,
        },
      });
    }

    const vendedor = await prisma.tbl_usuarios.findUnique({ where: { id: req.user.id }, select: { nombre: true } });

    notificationService.newPendingApproval('subscription', { nombre_vendedor: vendedor?.nombre || '', nombre_tienda: tienda.nombre, nombre_plan: plan.nombre });
    res.status(201).json({ data: solicitud });
  } catch (error) {
    console.error('Error solicitando suscripción:', error);
    res.status(500).json({ error: 'Error al solicitar suscripción' });
  }
};

const getMySubscriptions = async (req, res) => {
  try {
    const solicitudes = await prisma.tbl_solicitudes_suscripcion.findMany({
      where: { id_vendedor: req.user.id },
      include: {
        tbl_tiendas: { select: { id: true, nombre: true } },
        plan: { select: { id: true, tipo: true, precio: true } },
        archivos: true,
      },
      orderBy: { solicitado_en: 'desc' },
    });

    res.json({ data: solicitudes });
  } catch (error) {
    console.error('Error al obtener suscripciones:', error);
    res.status(500).json({ error: 'Error al obtener suscripciones' });
  }
};

module.exports = { requestSubscription, getMySubscriptions };
