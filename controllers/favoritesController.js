const prisma = require('../config/db');
const notificationService = require('../services/notificationService');

const getFavoriteProducts = async (req, res) => {
  try {
    const favoritos = await prisma.tbl_favoritos_productos.findMany({
      where: {
        id_comprador: req.user.id,
        // Visibilidad estricta: producto aprobado+activo y tienda aprobada+activa con suscripción vigente.
        // Si el admin desactiva la tienda, los productos se marcan INACTIVE en cascada y dejan de aparecer aquí.
        tbl_productos: {
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
        },
      },
      include: {
        tbl_productos: {
          include: {
            fotos: { take: 1, orderBy: { posicion: 'asc' } },
            tbl_tiendas: {
              include: {
                suscripcion_activa: { select: { tipo_plan: true, estado: true, fin_en: true } },
                tbl_galerias: {
                  include: {
                    tbl_zonas: { select: { id: true, nombre: true } },
                    tbl_ciudades: { select: { id: true, nombre: true } },
                  },
                },
              },
            },
            tbl_categorias: { select: { nombre: true } },
            agregado_calificacion: { select: { promedio: true, total: true } },
          },
        },
      },
      orderBy: { fecha_hora_registro: 'desc' },
    });

    const tiendaData = (t) => {
      const gal = t.tbl_galerias;
      return {
        id: t.id,
        nombre: t.nombre,
        tipo_plan: t.suscripcion_activa?.tipo_plan || 'ESTANDAR',
        galeria: gal ? { id: gal.id, nombre: gal.nombre } : null,
        zona: gal?.tbl_zonas ? { id: gal.tbl_zonas.id, nombre: gal.tbl_zonas.nombre } : null,
        ciudad: gal?.tbl_ciudades ? { id: gal.tbl_ciudades.id, nombre: gal.tbl_ciudades.nombre } : null,
      };
    };

    res.json({
      data: favoritos.map(f => ({
        id_producto: f.id_producto,
        agregado_en: f.fecha_hora_registro,
        producto: {
          id: f.tbl_productos.id,
          nombre: f.tbl_productos.nombre,
          precio: f.tbl_productos.precio,
          moneda: f.tbl_productos.moneda,
          precio_visible: f.tbl_productos.precio_visible,
          fotos: f.tbl_productos.fotos,
          foto: f.tbl_productos.fotos[0]?.url || null,
          tienda: tiendaData(f.tbl_productos.tbl_tiendas),
          categoria: f.tbl_productos.tbl_categorias?.nombre,
          rating: f.tbl_productos.agregado_calificacion,
        },
      })),
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener favoritos de productos' });
  }
};

const addFavoriteProduct = async (req, res) => {
  try {
    const id_producto = parseInt(req.params.product_id);
    await prisma.tbl_favoritos_productos.upsert({
      where: { id_comprador_id_producto: { id_comprador: req.user.id, id_producto } },
      create: { id_comprador: req.user.id, id_producto },
      update: {},
    });
    notificationService.favoritesUpdated(req.user.id);
    res.json({ mensaje: 'Producto agregado a favoritos' });
  } catch (error) {
    res.status(500).json({ error: 'Error al agregar favorito' });
  }
};

const removeFavoriteProduct = async (req, res) => {
  try {
    const id_producto = parseInt(req.params.product_id);
    await prisma.tbl_favoritos_productos.deleteMany({
      where: { id_comprador: req.user.id, id_producto },
    });
    notificationService.favoritesUpdated(req.user.id);
    res.json({ mensaje: 'Producto eliminado de favoritos' });
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar favorito' });
  }
};

const getFavoriteStores = async (req, res) => {
  try {
    const favoritos = await prisma.tbl_favoritos_tiendas.findMany({
      where: {
        id_comprador: req.user.id,
        // Solo tiendas visibles: aprobadas, activas, no eliminadas y con suscripción vigente.
        // Esto sincroniza con el toggle de admin: al desactivar `activo=false`, deja de aparecer aquí.
        tbl_tiendas: {
          estado_aprobacion: 'APROBADO',
          activo: true,
          eliminado_en: null,
          suscripcion_activa: {
            estado: 'ACTIVE',
            fin_en: { gte: new Date() },
          },
        },
      },
      include: {
        tbl_tiendas: {
          include: {
            fotos: { take: 1, orderBy: { posicion: 'asc' } },
            tbl_galerias: {
              include: {
                tbl_zonas: { select: { id: true, nombre: true } },
                tbl_ciudades: { select: { id: true, nombre: true } },
              },
            },
            suscripcion_activa: { select: { tipo_plan: true } },
            agregado_calificacion: { select: { promedio: true, total: true } },
          },
        },
      },
      orderBy: { fecha_hora_registro: 'desc' },
    });

    res.json({
      data: favoritos.map(f => {
        const gal = f.tbl_tiendas.tbl_galerias;
        return {
          id_tienda: f.id_tienda,
          agregado_en: f.fecha_hora_registro,
          tienda: {
            id: f.tbl_tiendas.id,
            nombre: f.tbl_tiendas.nombre,
            fotos: f.tbl_tiendas.fotos,
            foto: f.tbl_tiendas.fotos[0]?.url || null,
            galeria: gal ? { id: gal.id, nombre: gal.nombre } : null,
            zona: gal?.tbl_zonas ? { id: gal.tbl_zonas.id, nombre: gal.tbl_zonas.nombre } : null,
            ciudad: gal?.tbl_ciudades ? { id: gal.tbl_ciudades.id, nombre: gal.tbl_ciudades.nombre } : null,
            tipo_plan: f.tbl_tiendas.suscripcion_activa?.tipo_plan || 'ESTANDAR',
            rating: f.tbl_tiendas.agregado_calificacion,
          },
        };
      }),
    });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener favoritos de tiendas' });
  }
};

const addFavoriteStore = async (req, res) => {
  try {
    const id_tienda = parseInt(req.params.store_id);
    await prisma.tbl_favoritos_tiendas.upsert({
      where: { id_comprador_id_tienda: { id_comprador: req.user.id, id_tienda } },
      create: { id_comprador: req.user.id, id_tienda },
      update: {},
    });
    notificationService.favoritesUpdated(req.user.id);
    res.json({ mensaje: 'Tienda agregada a favoritos' });
  } catch (error) {
    res.status(500).json({ error: 'Error al agregar tienda a favoritos' });
  }
};

const removeFavoriteStore = async (req, res) => {
  try {
    const id_tienda = parseInt(req.params.store_id);
    await prisma.tbl_favoritos_tiendas.deleteMany({
      where: { id_comprador: req.user.id, id_tienda },
    });
    notificationService.favoritesUpdated(req.user.id);
    res.json({ mensaje: 'Tienda eliminada de favoritos' });
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar tienda de favoritos' });
  }
};

module.exports = {
  getFavoriteProducts, addFavoriteProduct, removeFavoriteProduct,
  getFavoriteStores, addFavoriteStore, removeFavoriteStore,
};
