const prisma = require('../config/db');

const getCities = async (req, res) => {
  try {
    const ciudades = await prisma.tbl_ciudades.findMany({
      where: { activo: true, eliminado_en: null },
      select: { id: true, nombre: true },
      orderBy: { nombre: 'asc' },
    });
    res.json({ data: ciudades });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener ciudades' });
  }
};

const getZones = async (req, res) => {
  try {
    const where = { activo: true, eliminado_en: null };
    const cityId = req.params.id_ciudad || req.query.city_id;
    if (cityId) where.id_ciudad = parseInt(cityId);

    const zonas = await prisma.tbl_zonas.findMany({
      where,
      select: { id: true, nombre: true, id_ciudad: true },
      orderBy: { nombre: 'asc' },
    });
    res.json({ data: zonas });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener zonas' });
  }
};

const getGalleries = async (req, res) => {
  try {
    const where = { activo: true, eliminado_en: null };
    const zoneId = req.params.id_zona || req.query.zone_id;
    if (zoneId) where.id_zona = parseInt(zoneId);

    const galerias = await prisma.tbl_galerias.findMany({
      where,
      include: {
        fotos: { select: { id: true, url: true, posicion: true }, orderBy: { posicion: 'asc' } },
      },
      orderBy: { nombre: 'asc' },
    });
    res.json({ data: galerias });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener galerias' });
  }
};

const getCategories = async (req, res) => {
  try {
    const categorias = await prisma.tbl_categorias.findMany({
      where: { activo: true, eliminado_en: null },
      select: { id: true, nombre: true },
      orderBy: { nombre: 'asc' },
    });
    res.json({ data: categorias });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener categorias' });
  }
};

const getPlans = async (req, res) => {
  try {
    let planes;
    try {
      planes = await prisma.tbl_planes.findMany({
        where: { activo: true },
        orderBy: { precio: 'asc' },
        include: {
          caracteristicas: { orderBy: { orden: 'asc' } },
        },
      });
    } catch {
      // Fallback: tabla caracteristicas no existe aun (migracion pendiente)
      planes = await prisma.tbl_planes.findMany({
        where: { activo: true },
        orderBy: { precio: 'asc' },
      });
      planes = planes.map(p => ({ ...p, caracteristicas: [] }));
    }
    res.json({ data: planes });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener planes' });
  }
};

const getPaymentMethods = async (req, res) => {
  try {
    const metodos = await prisma.tbl_metodos_pago.findMany({
      where: { activo: true, eliminado_en: null },
      orderBy: { tipo: 'asc' },
    });
    res.json({ data: metodos });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener metodos de pago' });
  }
};

const getFaqs = async (req, res) => {
  try {
    const { audiencia } = req.query;
    const where = { activo: true, eliminado_en: null };
    if (audiencia) {
      where.audiencia = { in: [audiencia, 'ALL'] };
    }
    const faqs = await prisma.tbl_faqs.findMany({
      where,
      select: { id: true, pregunta: true, respuesta: true, audiencia: true },
      orderBy: { id: 'asc' },
    });
    res.json(faqs);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener FAQs' });
  }
};

const getCurrentPrivacy = async (req, res) => {
  try {
    const privacidad = await prisma.tbl_versiones_privacidad.findFirst({
      where: { es_vigente: true },
      orderBy: { publicado_en: 'desc' },
    });
    res.json({ privacidad: privacidad || null });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener politica de privacidad' });
  }
};

module.exports = { getCities, getZones, getGalleries, getCategories, getPlans, getPaymentMethods, getFaqs, getCurrentPrivacy };
