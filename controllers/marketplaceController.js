const prisma = require('../config/db');
const { PLAN_TYPE } = require('../config/constants');

// Condicion base de visibilidad: producto aprobado+activo, tienda aprobada+activa, suscripcion activa
// Funcion (no constante) para que new Date() se evalúe en cada request
const getVisibilityWhere = () => ({
  estado_aprobacion: 'APROBADO',
  estado: 'ACTIVE',
  eliminado_en: null,
  tbl_tiendas: {
    estado_aprobacion: 'APROBADO',
    activo: true,
    eliminado_en: null,
    suscripcion_activa: {
      estado: 'ACTIVE',
      fin_en: { gte: new Date() },
    },
  },
});

// Normaliza tipo_plan: mapea valores legacy y asegura casing correcto
const normalizeTipoPlan = (raw) => {
  if (!raw) return PLAN_TYPE.ESTANDAR;
  const upper = raw.toUpperCase().trim();
  if (upper === 'PREMIUM') return PLAN_TYPE.PREMIUM;
  return PLAN_TYPE.ESTANDAR; // ESTANDAR, REGULAR, o cualquier otro → ESTANDAR
};

const searchProducts = async (req, res) => {
  try {
    const { q, city_id, zone_id, gallery_id, category_id, min_price, max_price, sort, page = 1 } = req.query;
    const limit = 20;
    const skip = (parseInt(page) - 1) * limit;

    const where = { ...getVisibilityWhere() };

    if (q) {
      where.OR = [
        { nombre: { contains: q, mode: 'insensitive' } },
        { descripcion: { contains: q, mode: 'insensitive' } },
      ];
    }
    if (category_id) where.id_categoria = parseInt(category_id);
    if (min_price || max_price) {
      where.precio = {};
      if (min_price) where.precio.gte = parseFloat(min_price);
      if (max_price) where.precio.lte = parseFloat(max_price);
    }

    // Filtros de ubicacion via tienda -> galeria
    if (city_id || zone_id || gallery_id) {
      where.tbl_tiendas = { ...where.tbl_tiendas };
      if (gallery_id) {
        where.tbl_tiendas.id_galeria = parseInt(gallery_id);
      } else {
        where.tbl_tiendas.tbl_galerias = {};
        if (city_id) where.tbl_tiendas.tbl_galerias.id_ciudad = parseInt(city_id);
        if (zone_id) where.tbl_tiendas.tbl_galerias.id_zona = parseInt(zone_id);
      }
    }

    // Ordenamiento
    let orderBy = [];
    switch (sort) {
      case 'cheap':
        orderBy = [{ precio: 'asc' }];
        break;
      case 'expensive':
        orderBy = [{ precio: 'desc' }];
        break;
      case 'recent':
        orderBy = [{ fecha_hora_registro: 'desc' }];
        break;
      default: // relevancia - se aplica post-query
        orderBy = [{ nombre: 'asc' }];
        break;
    }

    const isRelevancia = !sort || sort === 'relevancia';

    const includeData = {
      fotos: { select: { id: true, url: true, posicion: true }, orderBy: { posicion: 'asc' }, take: 1 },
      tbl_tiendas: {
        select: {
          id: true, nombre: true, id_galeria: true,
          suscripcion_activa: { select: { tipo_plan: true } },
          agregado_calificacion: { select: { promedio: true, total: true } },
          tbl_galerias: { select: { id: true, nombre: true, id_ciudad: true, id_zona: true } },
        },
      },
      tbl_categorias: { select: { id: true, nombre: true } },
      agregado_calificacion: { select: { promedio: true, total: true } },
    };

    let productos, total;

    if (isRelevancia) {
      // Para relevancia: traer TODOS, ordenar en memoria, luego paginar
      [productos, total] = await Promise.all([
        prisma.tbl_productos.findMany({ where, include: includeData }),
        prisma.tbl_productos.count({ where }),
      ]);
    } else {
      [productos, total] = await Promise.all([
        prisma.tbl_productos.findMany({ where, include: includeData, orderBy, skip, take: limit }),
        prisma.tbl_productos.count({ where }),
      ]);
    }

    let result = productos.map(p => ({
      id: p.id,
      nombre: p.nombre,
      descripcion: p.descripcion,
      precio: p.precio,
      moneda: p.moneda,
      precio_visible: p.precio_visible,
      foto: p.fotos[0]?.url || null,
      categoria: p.tbl_categorias,
      tienda: {
        id: p.tbl_tiendas.id,
        nombre: p.tbl_tiendas.nombre,
        tipo_plan: normalizeTipoPlan(p.tbl_tiendas.suscripcion_activa?.tipo_plan),
        rating: p.tbl_tiendas.agregado_calificacion,
        galeria: p.tbl_tiendas.tbl_galerias,
      },
      rating: p.agregado_calificacion,
    }));

    // Orden por relevancia deterministica (sobre TODOS los resultados, luego slice)
    if (isRelevancia) {
      result.sort((a, b) => {
        const planOrder = { [PLAN_TYPE.PREMIUM]: 0, [PLAN_TYPE.ESTANDAR]: 1 };
        const planDiff = (planOrder[a.tienda.tipo_plan] ?? 1) - (planOrder[b.tienda.tipo_plan] ?? 1);
        if (planDiff !== 0) return planDiff;
        const ratingA = parseFloat(a.rating?.promedio || 0);
        const ratingB = parseFloat(b.rating?.promedio || 0);
        if (ratingB !== ratingA) return ratingB - ratingA;
        const storeRatingA = parseFloat(a.tienda.rating?.promedio || 0);
        const storeRatingB = parseFloat(b.tienda.rating?.promedio || 0);
        if (storeRatingB !== storeRatingA) return storeRatingB - storeRatingA;
        return a.nombre.localeCompare(b.nombre);
      });
      result = result.slice(skip, skip + limit);
    }

    res.json({
      data: result,
      pagination: { page: parseInt(page), limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Error buscando productos:', error);
    res.status(500).json({ error: 'Error al buscar productos' });
  }
};

const searchStores = async (req, res) => {
  try {
    const { q, city_id, zone_id, gallery_id, sort, page = 1 } = req.query;
    const limit = 20;
    const skip = (parseInt(page) - 1) * limit;

    const where = {
      estado_aprobacion: 'APROBADO',
      activo: true,
      eliminado_en: null,
      suscripcion_activa: {
        estado: 'ACTIVE',
        fin_en: { gte: new Date() },
      },
    };

    if (q) {
      where.OR = [
        { nombre: { contains: q, mode: 'insensitive' } },
        { descripcion: { contains: q, mode: 'insensitive' } },
      ];
    }
    if (gallery_id) where.id_galeria = parseInt(gallery_id);
    if (city_id || zone_id) {
      where.tbl_galerias = {};
      if (city_id) where.tbl_galerias.id_ciudad = parseInt(city_id);
      if (zone_id) where.tbl_galerias.id_zona = parseInt(zone_id);
    }

    const isRelevancia = !sort || sort === 'relevancia';

    const includeStores = {
      fotos: { select: { id: true, url: true, posicion: true }, orderBy: { posicion: 'asc' }, take: 1 },
      tbl_galerias: { select: { id: true, nombre: true, direccion: true, id_ciudad: true, id_zona: true } },
      suscripcion_activa: { select: { tipo_plan: true } },
      agregado_calificacion: { select: { promedio: true, total: true } },
      _count: { select: { productos: { where: { estado_aprobacion: 'APROBADO', estado: 'ACTIVE', eliminado_en: null } } } },
    };

    let tiendas, total;

    if (isRelevancia) {
      [tiendas, total] = await Promise.all([
        prisma.tbl_tiendas.findMany({ where, include: includeStores }),
        prisma.tbl_tiendas.count({ where }),
      ]);
    } else {
      [tiendas, total] = await Promise.all([
        prisma.tbl_tiendas.findMany({ where, include: includeStores, skip, take: limit }),
        prisma.tbl_tiendas.count({ where }),
      ]);
    }

    let result = tiendas.map(t => ({
      id: t.id,
      nombre: t.nombre,
      descripcion: t.descripcion,
      foto: t.fotos[0]?.url || null,
      galeria: t.tbl_galerias,
      tipo_plan: normalizeTipoPlan(t.suscripcion_activa?.tipo_plan),
      rating: t.agregado_calificacion,
      total_productos: t._count.productos,
      horarios: t.horarios_json,
    }));

    if (isRelevancia) {
      result.sort((a, b) => {
        const planOrder = { [PLAN_TYPE.PREMIUM]: 0, [PLAN_TYPE.ESTANDAR]: 1 };
        const planDiff = (planOrder[a.tipo_plan] ?? 1) - (planOrder[b.tipo_plan] ?? 1);
        if (planDiff !== 0) return planDiff;
        const rA = parseFloat(a.rating?.promedio || 0);
        const rB = parseFloat(b.rating?.promedio || 0);
        if (rB !== rA) return rB - rA;
        return a.nombre.localeCompare(b.nombre);
      });
      result = result.slice(skip, skip + limit);
    }

    res.json({
      data: result,
      pagination: { page: parseInt(page), limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Error buscando tiendas:', error);
    res.status(500).json({ error: 'Error al buscar tiendas' });
  }
};

const getProductDetail = async (req, res) => {
  try {
    const producto = await prisma.tbl_productos.findFirst({
      where: { id: parseInt(req.params.id), ...getVisibilityWhere() },
      include: {
        fotos: { orderBy: { posicion: 'asc' } },
        tbl_categorias: true,
        tbl_tiendas: {
          include: {
            tbl_galerias: { include: { tbl_ciudades: true, tbl_zonas: true } },
            suscripcion_activa: { select: { tipo_plan: true } },
            agregado_calificacion: true,
          },
        },
        agregado_calificacion: true,
      },
    });

    if (!producto) return res.status(404).json({ error: 'Producto no encontrado' });

    // Resenas paginadas
    const page = parseInt(req.query.reviews_page || 1);
    const limit = 10;
    const resenas = await prisma.tbl_calificaciones_productos.findMany({
      where: { id_producto: producto.id },
      include: { tbl_usuarios: { select: { nombre: true } } },
      orderBy: { calificado_en: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    });

    res.json({
      data: {
        ...producto,
        resenas: resenas.map(r => ({
          id: r.id,
          estrellas: r.estrellas,
          comentario: r.comentario,
          fecha: r.calificado_en,
          autor: r.tbl_usuarios.nombre,
        })),
      },
    });
  } catch (error) {
    console.error('Error obteniendo producto:', error);
    res.status(500).json({ error: 'Error al obtener producto' });
  }
};

const getStoreDetail = async (req, res) => {
  try {
    const tienda = await prisma.tbl_tiendas.findFirst({
      where: {
        id: parseInt(req.params.id),
        estado_aprobacion: 'APROBADO',
        activo: true,
        eliminado_en: null,
        suscripcion_activa: { estado: 'ACTIVE', fin_en: { gte: new Date() } },
      },
      include: {
        fotos: { orderBy: { posicion: 'asc' } },
        tbl_galerias: { include: { tbl_ciudades: true, tbl_zonas: true, fotos: { orderBy: { posicion: 'asc' } } } },
        suscripcion_activa: { select: { tipo_plan: true } },
        agregado_calificacion: true,
        productos: {
          where: { estado_aprobacion: 'APROBADO', estado: 'ACTIVE', eliminado_en: null },
          include: {
            fotos: { take: 1, orderBy: { posicion: 'asc' } },
            tbl_categorias: true,
            agregado_calificacion: true,
          },
          orderBy: { nombre: 'asc' },
        },
      },
    });

    if (!tienda) return res.status(404).json({ error: 'Tienda no encontrada' });

    res.json({ data: tienda });
  } catch (error) {
    console.error('Error obteniendo tienda:', error);
    res.status(500).json({ error: 'Error al obtener tienda' });
  }
};

const getProductRatings = async (req, res) => {
  try {
    const productoId = parseInt(req.params.id);
    // Validar visibilidad del producto antes de listar reseñas. Si el producto
    // o su tienda o el vendedor estan eliminados, devolver 404 (no exponer rastro).
    const producto = await prisma.tbl_productos.findFirst({
      where: { id: productoId, ...getVisibilityWhere() },
      select: { id: true },
    });
    if (!producto) return res.status(404).json({ error: 'Producto no encontrado' });

    const page = parseInt(req.query.page || 1);
    const limit = 10;
    const [ratings, total] = await Promise.all([
      prisma.tbl_calificaciones_productos.findMany({
        where: { id_producto: productoId },
        include: { tbl_usuarios: { select: { nombre: true } } },
        orderBy: { calificado_en: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.tbl_calificaciones_productos.count({ where: { id_producto: productoId } }),
    ]);

    res.json({
      data: ratings.map(r => ({
        id: r.id, estrellas: r.estrellas, comentario: r.comentario,
        fecha: r.calificado_en, autor: r.tbl_usuarios.nombre,
      })),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener calificaciones' });
  }
};

const getStoreRatings = async (req, res) => {
  try {
    const tiendaId = parseInt(req.params.id);
    // Validar visibilidad de la tienda antes de listar reseñas. Si la tienda
    // o el vendedor estan eliminados, devolver 404 (no exponer rastro).
    const tienda = await prisma.tbl_tiendas.findFirst({
      where: {
        id: tiendaId,
        eliminado_en: null,
        estado_aprobacion: 'APROBADO',
        activo: true,
        tbl_usuarios: { eliminado_en: null },
      },
      select: { id: true },
    });
    if (!tienda) return res.status(404).json({ error: 'Tienda no encontrada' });

    const page = parseInt(req.query.page || 1);
    const limit = 10;
    const [ratings, total] = await Promise.all([
      prisma.tbl_calificaciones_tiendas.findMany({
        where: { id_tienda: tiendaId },
        include: { tbl_usuarios: { select: { nombre: true } } },
        orderBy: { calificado_en: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.tbl_calificaciones_tiendas.count({ where: { id_tienda: tiendaId } }),
    ]);

    res.json({
      data: ratings.map(r => ({
        id: r.id, estrellas: r.estrellas, comentario: r.comentario,
        fecha: r.calificado_en, autor: r.tbl_usuarios.nombre,
      })),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener calificaciones de tienda' });
  }
};

module.exports = {
  searchProducts, searchStores, getProductDetail, getStoreDetail,
  getProductRatings, getStoreRatings,
};
