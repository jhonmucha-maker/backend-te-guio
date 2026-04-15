const prisma = require('../config/db');

const getCities = async () => {
  return prisma.tbl_ciudades.findMany({
    where: { activo: true, eliminado_en: null },
    select: { id: true, nombre: true },
    orderBy: { nombre: 'asc' },
  });
};

const getZones = async (cityId) => {
  const where = { activo: true, eliminado_en: null };
  if (cityId) where.id_ciudad = parseInt(cityId);
  return prisma.tbl_zonas.findMany({ where, select: { id: true, nombre: true, id_ciudad: true }, orderBy: { nombre: 'asc' } });
};

const getGalleries = async (cityId, zoneId) => {
  const where = { activo: true, eliminado_en: null };
  if (cityId) where.id_ciudad = parseInt(cityId);
  if (zoneId) where.id_zona = parseInt(zoneId);
  return prisma.tbl_galerias.findMany({
    where,
    include: { fotos: { select: { id: true, url: true, posicion: true }, orderBy: { posicion: 'asc' } } },
    orderBy: { nombre: 'asc' },
  });
};

const getCategories = async () => {
  return prisma.tbl_categorias.findMany({
    where: { activo: true, eliminado_en: null },
    select: { id: true, nombre: true },
    orderBy: { nombre: 'asc' },
  });
};

const getPlans = async () => {
  return prisma.tbl_planes.findMany({ where: { activo: true }, orderBy: { precio: 'asc' } });
};

const getPaymentMethods = async () => {
  return prisma.tbl_metodos_pago.findMany({ where: { activo: true, eliminado_en: null }, orderBy: { tipo: 'asc' } });
};

module.exports = { getCities, getZones, getGalleries, getCategories, getPlans, getPaymentMethods };
