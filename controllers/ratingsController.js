const prisma = require('../config/db');
const { RATING_WINDOW_DAYS, TIMEZONE } = require('../config/constants');
const notificationService = require('../services/notificationService');

// Obtener inicio y fin del dia actual en TZ Peru
const getLimaDayBounds = () => {
  const now = new Date();
  const limaStr = now.toLocaleString('en-US', { timeZone: TIMEZONE });
  const limaDate = new Date(limaStr);
  const inicio = new Date(limaDate.getFullYear(), limaDate.getMonth(), limaDate.getDate());
  const fin = new Date(inicio.getTime() + 24 * 60 * 60 * 1000);
  return { inicio, fin };
};

const rateProduct = async (req, res) => {
  const { estrellas, comentario } = req.body;
  const id_producto = parseInt(req.params.product_id);

  if (!estrellas || estrellas < 1 || estrellas > 5) {
    return res.status(400).json({ error: 'Estrellas debe ser entre 1 y 5' });
  }

  try {
    // Verificar evidencia: al menos 1 item comprado del producto
    const itemComprado = await prisma.tbl_items_lista_compras.findFirst({
      where: {
        id_producto,
        comprado: true,
        tbl_listas_compras: { id_comprador: req.user.id },
      },
      orderBy: { comprado_en: 'desc' },
    });

    if (!itemComprado) {
      return res.status(403).json({ error: 'Necesitas haber comprado este producto para calificarlo' });
    }

    // Verificar ventana de 14 dias
    const deadline = new Date(itemComprado.comprado_en.getTime() + RATING_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    if (new Date() > deadline) {
      return res.status(403).json({ error: 'La ventana de calificacion de 14 dias ha expirado' });
    }

    // Verificar limite 1/dia en TZ Peru
    const { inicio, fin } = getLimaDayBounds();
    const calHoy = await prisma.tbl_calificaciones_productos.count({
      where: {
        id_comprador: req.user.id,
        id_producto,
        calificado_en: { gte: inicio, lt: fin },
      },
    });

    if (calHoy > 0) {
      return res.status(429).json({ error: 'Ya calificaste este producto hoy. Intenta manana.' });
    }

    // Crear calificacion
    const rating = await prisma.tbl_calificaciones_productos.create({
      data: {
        id_comprador: req.user.id,
        id_producto,
        estrellas: parseInt(estrellas),
        comentario: comentario || null,
        id_usuario_registro: req.user.id,
      },
    });

    // Operaciones secundarias (no deben bloquear la respuesta exitosa)
    try {
      const stats = await prisma.tbl_calificaciones_productos.aggregate({
        where: { id_producto },
        _avg: { estrellas: true },
        _count: { id: true },
      });

      const promedio = stats._avg.estrellas
        ? parseFloat(Number(stats._avg.estrellas).toFixed(2))
        : 0;

      await prisma.tbl_agregados_cal_productos.upsert({
        where: { id_producto },
        create: {
          id_producto,
          promedio,
          total: stats._count.id,
        },
        update: {
          promedio,
          total: stats._count.id,
          actualizado_en: new Date(),
        },
      });
    } catch (aggErr) {
      console.error('Error actualizando agregados de producto:', aggErr);
    }

    // Notificar al vendedor via SSE
    try {
      const producto = await prisma.tbl_productos.findUnique({
        where: { id: id_producto },
        select: { tbl_tiendas: { select: { id_vendedor: true } } },
      });
      if (producto?.tbl_tiendas?.id_vendedor) {
        notificationService.ratingProductNew(producto.tbl_tiendas.id_vendedor, id_producto);
      }
    } catch (notifErr) {
      console.error('Error notificando calificacion de producto:', notifErr);
    }

    res.status(201).json({ data: rating });
  } catch (error) {
    console.error('Error calificando producto:', error);
    res.status(500).json({ error: 'Error al calificar producto' });
  }
};

const rateStore = async (req, res) => {
  const { estrellas, comentario } = req.body;
  const id_tienda = parseInt(req.params.store_id);

  if (!estrellas || estrellas < 1 || estrellas > 5) {
    return res.status(400).json({ error: 'Estrellas debe ser entre 1 y 5' });
  }

  try {
    // Evidencia: al menos 1 item comprado de la tienda
    const itemComprado = await prisma.tbl_items_lista_compras.findFirst({
      where: {
        snapshot_id_tienda: id_tienda,
        comprado: true,
        tbl_listas_compras: { id_comprador: req.user.id },
      },
      orderBy: { comprado_en: 'desc' },
    });

    if (!itemComprado) {
      return res.status(403).json({ error: 'Necesitas haber comprado en esta tienda para calificarla' });
    }

    const deadline = new Date(itemComprado.comprado_en.getTime() + RATING_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    if (new Date() > deadline) {
      return res.status(403).json({ error: 'La ventana de calificacion de 14 dias ha expirado' });
    }

    const { inicio, fin } = getLimaDayBounds();
    const calHoy = await prisma.tbl_calificaciones_tiendas.count({
      where: {
        id_comprador: req.user.id,
        id_tienda,
        calificado_en: { gte: inicio, lt: fin },
      },
    });

    if (calHoy > 0) {
      return res.status(429).json({ error: 'Ya calificaste esta tienda hoy. Intenta manana.' });
    }

    const rating = await prisma.tbl_calificaciones_tiendas.create({
      data: {
        id_comprador: req.user.id,
        id_tienda,
        estrellas: parseInt(estrellas),
        comentario: comentario || null,
        id_usuario_registro: req.user.id,
      },
    });

    // Operaciones secundarias (no deben bloquear la respuesta exitosa)
    try {
      const stats = await prisma.tbl_calificaciones_tiendas.aggregate({
        where: { id_tienda },
        _avg: { estrellas: true },
        _count: { id: true },
      });

      const promedio = stats._avg.estrellas
        ? parseFloat(Number(stats._avg.estrellas).toFixed(2))
        : 0;

      await prisma.tbl_agregados_cal_tiendas.upsert({
        where: { id_tienda },
        create: {
          id_tienda,
          promedio,
          total: stats._count.id,
        },
        update: {
          promedio,
          total: stats._count.id,
          actualizado_en: new Date(),
        },
      });
    } catch (aggErr) {
      console.error('Error actualizando agregados de tienda:', aggErr);
    }

    // Notificar al vendedor via SSE
    try {
      const tienda = await prisma.tbl_tiendas.findUnique({
        where: { id: id_tienda },
        select: { id_vendedor: true },
      });
      if (tienda?.id_vendedor) {
        notificationService.ratingStoreNew(tienda.id_vendedor, id_tienda);
      }
    } catch (notifErr) {
      console.error('Error notificando calificacion de tienda:', notifErr);
    }

    res.status(201).json({ data: rating });
  } catch (error) {
    console.error('Error calificando tienda:', error);
    res.status(500).json({ error: 'Error al calificar tienda' });
  }
};

const getMyRatings = async (req, res) => {
  try {
    const [productRatings, storeRatings] = await Promise.all([
      prisma.tbl_calificaciones_productos.findMany({
        where: { id_comprador: req.user.id },
        include: { tbl_productos: { select: { id: true, nombre: true } } },
        orderBy: { calificado_en: 'desc' },
      }),
      prisma.tbl_calificaciones_tiendas.findMany({
        where: { id_comprador: req.user.id },
        include: { tbl_tiendas: { select: { id: true, nombre: true } } },
        orderBy: { calificado_en: 'desc' },
      }),
    ]);

    res.json({
      data: {
        productos: productRatings.map(r => ({
          id: r.id, estrellas: r.estrellas, puntuacion: r.estrellas, comentario: r.comentario,
          fecha: r.calificado_en, fecha_hora_registro: r.calificado_en,
          producto: r.tbl_productos,
        })),
        tiendas: storeRatings.map(r => ({
          id: r.id, estrellas: r.estrellas, puntuacion: r.estrellas, comentario: r.comentario,
          fecha: r.calificado_en, fecha_hora_registro: r.calificado_en,
          tienda: r.tbl_tiendas,
        })),
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener mis calificaciones' });
  }
};

module.exports = { rateProduct, rateStore, getMyRatings };
