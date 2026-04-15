const prisma = require('../config/db');

const getFavoriteProducts = async (userId) => {
  const favoritos = await prisma.tbl_favoritos_productos.findMany({
    where: { id_comprador: userId },
    include: {
      tbl_productos: {
        include: {
          fotos: { take: 1, orderBy: { posicion: 'asc' } },
          tbl_tiendas: { select: { id: true, nombre: true, suscripcion_activa: { select: { tipo_plan: true, estado: true } } } },
          tbl_categorias: { select: { nombre: true } },
          agregado_calificacion: { select: { promedio: true, total: true } },
        },
      },
    },
    orderBy: { fecha_hora_registro: 'desc' },
  });
  return favoritos.map(f => ({
    id_producto: f.id_producto, agregado_en: f.fecha_hora_registro,
    producto: {
      id: f.tbl_productos.id, nombre: f.tbl_productos.nombre,
      precio: f.tbl_productos.precio, moneda: f.tbl_productos.moneda,
      foto: f.tbl_productos.fotos[0]?.url || null,
      tienda: f.tbl_productos.tbl_tiendas,
      categoria: f.tbl_productos.tbl_categorias?.nombre,
      rating: f.tbl_productos.agregado_calificacion,
    },
  }));
};

const toggleFavoriteProduct = async (userId, productId, add) => {
  if (add) {
    await prisma.tbl_favoritos_productos.upsert({
      where: { id_comprador_id_producto: { id_comprador: userId, id_producto: productId } },
      create: { id_comprador: userId, id_producto: productId },
      update: {},
    });
  } else {
    await prisma.tbl_favoritos_productos.deleteMany({ where: { id_comprador: userId, id_producto: productId } });
  }
};

const getFavoriteStores = async (userId) => {
  const favoritos = await prisma.tbl_favoritos_tiendas.findMany({
    where: { id_comprador: userId },
    include: {
      tbl_tiendas: {
        include: {
          fotos: { take: 1, orderBy: { posicion: 'asc' } },
          tbl_galerias: { select: { id: true, nombre: true } },
          suscripcion_activa: { select: { tipo_plan: true } },
          agregado_calificacion: { select: { promedio: true, total: true } },
        },
      },
    },
    orderBy: { fecha_hora_registro: 'desc' },
  });
  return favoritos.map(f => ({
    id_tienda: f.id_tienda, agregado_en: f.fecha_hora_registro,
    tienda: {
      id: f.tbl_tiendas.id, nombre: f.tbl_tiendas.nombre,
      foto: f.tbl_tiendas.fotos[0]?.url || null,
      galeria: f.tbl_tiendas.tbl_galerias,
      tipo_plan: f.tbl_tiendas.suscripcion_activa?.tipo_plan,
      rating: f.tbl_tiendas.agregado_calificacion,
    },
  }));
};

const toggleFavoriteStore = async (userId, storeId, add) => {
  if (add) {
    await prisma.tbl_favoritos_tiendas.upsert({
      where: { id_comprador_id_tienda: { id_comprador: userId, id_tienda: storeId } },
      create: { id_comprador: userId, id_tienda: storeId },
      update: {},
    });
  } else {
    await prisma.tbl_favoritos_tiendas.deleteMany({ where: { id_comprador: userId, id_tienda: storeId } });
  }
};

module.exports = { getFavoriteProducts, toggleFavoriteProduct, getFavoriteStores, toggleFavoriteStore };
