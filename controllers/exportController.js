// Exportacion a Excel / PDF de las entidades administrables.
// Cada handler consulta TODOS los registros vigentes (eliminado_en = null),
// arma columnas + filas y delega el armado del archivo en utils/exporters.
//
// El formato se decide con ?format=xlsx|pdf (default xlsx).

const prisma = require('../config/db');
const { ROLES } = require('../config/constants');
const { sendExport } = require('../utils/exporters');

// ── Helpers de formato ──
const fmtDate = (d) => (d ? new Date(d).toLocaleString('es-PE') : '');
const yesNo = (b) => (b ? 'Sí' : 'No');
const money = (n) => (n === null || n === undefined ? '' : `S/ ${parseFloat(n).toFixed(2)}`);
const resolveFormat = (req) =>
  String(req.query.format || '').toLowerCase() === 'pdf' ? 'pdf' : 'xlsx';

// Mapea el codigo interno del plan al texto mostrado al usuario.
const planLabel = (tipo) => {
  if (!tipo) return 'Sin suscripción';
  return tipo === 'REGULAR' ? 'ESTANDAR' : tipo;
};

// ==================== COMPRADORES ====================
const exportBuyers = async (req, res) => {
  try {
    const buyers = await prisma.tbl_usuarios.findMany({
      where: { tbl_roles: { nombre: ROLES.COMPRADOR }, eliminado_en: null },
      select: {
        id: true, nombre: true, correo: true, telefono: true,
        correo_verificado: true, activo: true, fecha_hora_registro: true,
        tbl_ciudades: { select: { nombre: true } },
      },
      orderBy: { fecha_hora_registro: 'desc' },
    });

    const columns = [
      { header: 'ID', key: 'id', width: 8, pdfWidth: 'auto' },
      { header: 'Nombre', key: 'nombre', width: 28 },
      { header: 'Correo', key: 'correo', width: 32 },
      { header: 'Teléfono', key: 'telefono', width: 16 },
      { header: 'Ciudad', key: 'ciudad', width: 20 },
      { header: 'Correo verificado', key: 'verificado', width: 18, pdfWidth: 'auto' },
      { header: 'Activo', key: 'activo', width: 10, pdfWidth: 'auto' },
      { header: 'Fecha registro', key: 'fecha', width: 22 },
    ];

    const rows = buyers.map((b) => ({
      id: b.id,
      nombre: b.nombre || '',
      correo: b.correo || '',
      telefono: b.telefono || '',
      ciudad: b.tbl_ciudades?.nombre || '',
      verificado: yesNo(b.correo_verificado),
      activo: yesNo(b.activo),
      fecha: fmtDate(b.fecha_hora_registro),
    }));

    await sendExport(res, {
      format: resolveFormat(req), filename: 'compradores', title: 'Compradores', columns, rows,
    });
  } catch (error) {
    console.error('Error exportando compradores:', error);
    res.status(500).json({ error: 'Error al exportar compradores' });
  }
};

// ==================== PRODUCTOS ====================
const exportProducts = async (req, res) => {
  try {
    const products = await prisma.tbl_productos.findMany({
      where: { eliminado_en: null },
      select: {
        id: true, nombre: true, precio: true, moneda: true, precio_visible: true,
        estado_aprobacion: true, estado: true, fecha_hora_registro: true,
        tbl_categorias: { select: { nombre: true } },
        tbl_tiendas: {
          select: { nombre: true, tbl_galerias: { select: { nombre: true } } },
        },
      },
      orderBy: { fecha_hora_registro: 'desc' },
    });

    const columns = [
      { header: 'ID', key: 'id', width: 8, pdfWidth: 'auto' },
      { header: 'Nombre', key: 'nombre', width: 30 },
      { header: 'Categoría', key: 'categoria', width: 20 },
      { header: 'Tienda', key: 'tienda', width: 24 },
      { header: 'Galería', key: 'galeria', width: 22 },
      { header: 'Precio', key: 'precio', width: 14, pdfWidth: 'auto' },
      { header: 'Moneda', key: 'moneda', width: 10, pdfWidth: 'auto' },
      { header: 'Precio visible', key: 'precio_visible', width: 14, pdfWidth: 'auto' },
      { header: 'Estado aprobación', key: 'estado_aprobacion', width: 18 },
      { header: 'Estado', key: 'estado', width: 12, pdfWidth: 'auto' },
      { header: 'Fecha registro', key: 'fecha', width: 22 },
    ];

    const rows = products.map((p) => ({
      id: p.id,
      nombre: p.nombre || '',
      categoria: p.tbl_categorias?.nombre || '',
      tienda: p.tbl_tiendas?.nombre || '',
      galeria: p.tbl_tiendas?.tbl_galerias?.nombre || '',
      precio: money(p.precio),
      moneda: p.moneda || '',
      precio_visible: yesNo(p.precio_visible),
      estado_aprobacion: p.estado_aprobacion || '',
      estado: p.estado || '',
      fecha: fmtDate(p.fecha_hora_registro),
    }));

    await sendExport(res, {
      format: resolveFormat(req), filename: 'productos', title: 'Productos', columns, rows,
    });
  } catch (error) {
    console.error('Error exportando productos:', error);
    res.status(500).json({ error: 'Error al exportar productos' });
  }
};

// ==================== TIENDAS ====================
const exportStores = async (req, res) => {
  try {
    const stores = await prisma.tbl_tiendas.findMany({
      where: { eliminado_en: null },
      select: {
        id: true, nombre: true, telefono: true, numero_local: true,
        estado_aprobacion: true, activo: true, fecha_hora_registro: true,
        tbl_usuarios: { select: { nombre: true } },
        tbl_galerias: {
          select: {
            nombre: true,
            tbl_ciudades: { select: { nombre: true } },
            tbl_zonas: { select: { nombre: true } },
          },
        },
        suscripcion_activa: { select: { tipo_plan: true, estado: true, fin_en: true } },
      },
      orderBy: { fecha_hora_registro: 'desc' },
    });

    const columns = [
      { header: 'ID', key: 'id', width: 8, pdfWidth: 'auto' },
      { header: 'Nombre', key: 'nombre', width: 28 },
      { header: 'Vendedor', key: 'vendedor', width: 24 },
      { header: 'Galería', key: 'galeria', width: 22 },
      { header: 'Ciudad', key: 'ciudad', width: 18 },
      { header: 'Zona', key: 'zona', width: 18 },
      { header: 'Teléfono', key: 'telefono', width: 16 },
      { header: 'N° local', key: 'numero_local', width: 12, pdfWidth: 'auto' },
      { header: 'Estado aprobación', key: 'estado_aprobacion', width: 18 },
      { header: 'Suscripción', key: 'suscripcion', width: 16 },
      { header: 'Venc. suscripción', key: 'venc', width: 18 },
      { header: 'Activo', key: 'activo', width: 10, pdfWidth: 'auto' },
      { header: 'Fecha registro', key: 'fecha', width: 22 },
    ];

    const rows = stores.map((s) => {
      const sub = s.suscripcion_activa;
      return {
        id: s.id,
        nombre: s.nombre || '',
        vendedor: s.tbl_usuarios?.nombre || '',
        galeria: s.tbl_galerias?.nombre || '',
        ciudad: s.tbl_galerias?.tbl_ciudades?.nombre || '',
        zona: s.tbl_galerias?.tbl_zonas?.nombre || '',
        telefono: s.telefono || '',
        numero_local: s.numero_local || '',
        estado_aprobacion: s.estado_aprobacion || '',
        suscripcion: planLabel(sub?.tipo_plan),
        venc: sub?.fin_en ? new Date(sub.fin_en).toLocaleDateString('es-PE') : '',
        activo: yesNo(s.activo),
        fecha: fmtDate(s.fecha_hora_registro),
      };
    });

    await sendExport(res, {
      format: resolveFormat(req), filename: 'tiendas', title: 'Tiendas', columns, rows,
    });
  } catch (error) {
    console.error('Error exportando tiendas:', error);
    res.status(500).json({ error: 'Error al exportar tiendas' });
  }
};

// ==================== GALERIAS ====================
const exportGalleries = async (req, res) => {
  try {
    const galleries = await prisma.tbl_galerias.findMany({
      where: { eliminado_en: null },
      select: {
        id: true, nombre: true, direccion: true, activo: true, fecha_hora_registro: true,
        tbl_ciudades: { select: { nombre: true } },
        tbl_zonas: { select: { nombre: true } },
        _count: { select: { tiendas: { where: { eliminado_en: null } } } },
      },
      orderBy: { nombre: 'asc' },
    });

    const columns = [
      { header: 'ID', key: 'id', width: 8, pdfWidth: 'auto' },
      { header: 'Nombre', key: 'nombre', width: 28 },
      { header: 'Ciudad', key: 'ciudad', width: 20 },
      { header: 'Zona', key: 'zona', width: 20 },
      { header: 'Dirección', key: 'direccion', width: 30 },
      { header: 'N° Tiendas', key: 'tiendas', width: 12, pdfWidth: 'auto' },
      { header: 'Activo', key: 'activo', width: 10, pdfWidth: 'auto' },
      { header: 'Fecha registro', key: 'fecha', width: 22 },
    ];

    const rows = galleries.map((g) => ({
      id: g.id,
      nombre: g.nombre || '',
      ciudad: g.tbl_ciudades?.nombre || '',
      zona: g.tbl_zonas?.nombre || '',
      direccion: g.direccion || '',
      tiendas: g._count?.tiendas ?? 0,
      activo: yesNo(g.activo),
      fecha: fmtDate(g.fecha_hora_registro),
    }));

    await sendExport(res, {
      format: resolveFormat(req), filename: 'galerias', title: 'Galerías', columns, rows,
    });
  } catch (error) {
    console.error('Error exportando galerias:', error);
    res.status(500).json({ error: 'Error al exportar galerías' });
  }
};

// ==================== ZONAS ====================
const exportZones = async (req, res) => {
  try {
    const zones = await prisma.tbl_zonas.findMany({
      where: { eliminado_en: null },
      select: {
        id: true, nombre: true, activo: true, fecha_hora_registro: true,
        tbl_ciudades: { select: { nombre: true } },
        _count: { select: { tbl_galerias: { where: { eliminado_en: null } } } },
      },
      orderBy: { nombre: 'asc' },
    });

    const columns = [
      { header: 'ID', key: 'id', width: 8, pdfWidth: 'auto' },
      { header: 'Nombre', key: 'nombre', width: 26 },
      { header: 'Ciudad', key: 'ciudad', width: 22 },
      { header: 'N° Galerías', key: 'galerias', width: 12, pdfWidth: 'auto' },
      { header: 'Activo', key: 'activo', width: 10, pdfWidth: 'auto' },
      { header: 'Fecha registro', key: 'fecha', width: 22 },
    ];

    const rows = zones.map((z) => ({
      id: z.id,
      nombre: z.nombre || '',
      ciudad: z.tbl_ciudades?.nombre || '',
      galerias: z._count?.tbl_galerias ?? 0,
      activo: yesNo(z.activo),
      fecha: fmtDate(z.fecha_hora_registro),
    }));

    await sendExport(res, {
      format: resolveFormat(req), filename: 'zonas', title: 'Zonas', columns, rows,
    });
  } catch (error) {
    console.error('Error exportando zonas:', error);
    res.status(500).json({ error: 'Error al exportar zonas' });
  }
};

// ==================== CATEGORIAS ====================
const exportCategories = async (req, res) => {
  try {
    const categories = await prisma.tbl_categorias.findMany({
      where: { eliminado_en: null },
      select: {
        id: true, nombre: true, descripcion: true, activo: true, fecha_hora_registro: true,
        _count: { select: { productos: { where: { eliminado_en: null } } } },
      },
      orderBy: { nombre: 'asc' },
    });

    const columns = [
      { header: 'ID', key: 'id', width: 8, pdfWidth: 'auto' },
      { header: 'Nombre', key: 'nombre', width: 26 },
      { header: 'Descripción', key: 'descripcion', width: 40 },
      { header: 'N° Productos', key: 'productos', width: 14, pdfWidth: 'auto' },
      { header: 'Activo', key: 'activo', width: 10, pdfWidth: 'auto' },
      { header: 'Fecha registro', key: 'fecha', width: 22 },
    ];

    const rows = categories.map((c) => ({
      id: c.id,
      nombre: c.nombre || '',
      descripcion: c.descripcion || '',
      productos: c._count?.productos ?? 0,
      activo: yesNo(c.activo),
      fecha: fmtDate(c.fecha_hora_registro),
    }));

    await sendExport(res, {
      format: resolveFormat(req), filename: 'categorias', title: 'Categorías', columns, rows,
    });
  } catch (error) {
    console.error('Error exportando categorias:', error);
    res.status(500).json({ error: 'Error al exportar categorías' });
  }
};

module.exports = {
  exportBuyers,
  exportProducts,
  exportStores,
  exportGalleries,
  exportZones,
  exportCategories,
};
