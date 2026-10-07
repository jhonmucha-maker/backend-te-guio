// Registro unico de los conjuntos de datos exportables.
//
// Cada entidad declara AQUI, una sola vez, que datos trae y con que columnas.
// Como se entrega (xlsx / pdf, individual o combinado) es responsabilidad de
// utils/exporters. Esa separacion es lo que permite que la exportacion general
// reutilice las mismas definiciones en vez de duplicarlas.
//
// Contrato de cada dataset:
//   label    -> nombre mostrado al usuario (UI y titulo del documento)
//   filename -> nombre base del archivo individual, sin extension
//   sheet    -> nombre de la hoja en el Excel combinado (max 31 chars, ExcelJS)
//   fetch()  -> async () => ({ columns, rows })  ver utils/exporters
//
// Para agregar una entidad exportable: se anade una entrada aqui y queda
// disponible automaticamente en /admin/export/:entity y en /admin/export/bundle.

const prisma = require('../config/db');
const {
  ROLES,
  ACCOUNT_STATUS_LABELS,
  deriveAccountStatus,
  SUBSCRIPTION_STATUS,
} = require('../config/constants');

// ── Helpers de formato ──
const fmtDate = (d) => (d ? new Date(d).toLocaleString('es-PE') : '');
const fmtDay = (d) => (d ? new Date(d).toLocaleDateString('es-PE') : '');
const yesNo = (b) => (b ? 'Sí' : 'No');
const money = (n) => (n === null || n === undefined ? '' : `S/ ${parseFloat(n).toFixed(2)}`);
// Decimal(10,7) de Prisma -> texto plano; sin recorte de decimales.
const coord = (n) => (n === null || n === undefined ? '' : String(n));

// Mapea el codigo interno del plan al texto mostrado al usuario.
// Sin suscripcion -> celda vacia.
const planLabel = (tipo) => {
  if (!tipo) return '';
  return tipo === 'REGULAR' ? 'ESTANDAR' : tipo;
};

// ==================== COMPRADORES ====================
const fetchBuyers = async () => {
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
    { header: 'Estado', key: 'estado', width: 14, pdfWidth: 'auto' },
    { header: 'Fecha registro', key: 'fecha', width: 22 },
  ];

  const rows = buyers.map((b) => ({
    id: b.id,
    nombre: b.nombre || '',
    correo: b.correo || '',
    telefono: b.telefono || '',
    ciudad: b.tbl_ciudades?.nombre || '',
    verificado: yesNo(b.correo_verificado),
    estado: ACCOUNT_STATUS_LABELS[deriveAccountStatus(b)],
    fecha: fmtDate(b.fecha_hora_registro),
  }));

  return { columns, rows };
};

// ==================== VENDEDORES ====================
// Unico dataset desnormalizado: un vendedor con N tiendas produce N filas
// (los datos del vendedor se repiten). Un vendedor sin tiendas produce 1 fila
// con las columnas de tienda vacias.
const fetchSellers = async () => {
  const sellers = await prisma.tbl_usuarios.findMany({
    where: { tbl_roles: { nombre: ROLES.VENDEDOR }, eliminado_en: null },
    select: {
      id: true, nombre: true, correo: true, telefono: true, activo: true,
      correo_verificado: true, fecha_hora_registro: true,
      tbl_perfil_vendedor: {
        select: {
          nombre_negocio: true, razon_social: true, ruc: true, dni: true,
          estado_aprobacion: true, tipo_comprobante: true,
        },
      },
      tiendas: {
        where: { eliminado_en: null },
        select: {
          id: true,
          nombre: true,
          observacion: true,
          tbl_galerias: {
            select: {
              id: true,
              nombre: true,
              tbl_ciudades: { select: { id: true, nombre: true } },
              tbl_zonas: { select: { id: true, nombre: true } },
            },
          },
          suscripcion_activa: { select: { tipo_plan: true, estado: true, fin_en: true } },
          transacciones: {
            where: { estado: SUBSCRIPTION_STATUS.ACTIVE },
            select: { monto: true },
            orderBy: { fin_en: 'desc' },
            take: 1,
          },
        },
      },
    },
    orderBy: { fecha_hora_registro: 'desc' },
  });

  const columns = [
    { header: 'ID', key: 'id', width: 8, pdfWidth: 'auto' },
    { header: 'Nombre', key: 'nombre', width: 25 },
    { header: 'Correo', key: 'correo', width: 30 },
    { header: 'Teléfono', key: 'telefono', width: 15 },
    { header: 'Estado', key: 'estado_cuenta', width: 14 },
    { header: 'Negocio', key: 'negocio', width: 25 },
    { header: 'RUC', key: 'ruc', width: 15 },
    { header: 'DNI', key: 'dni', width: 15 },
    { header: 'Estado Aprobación', key: 'estado', width: 18 },
    { header: 'Tipo Comprobante', key: 'tipo_comprobante', width: 18 },
    { header: 'Tienda', key: 'tienda', width: 30 },
    { header: 'ID Tienda', key: 'id_tienda', width: 12, pdfWidth: 'auto' },
    { header: 'Zona', key: 'zona', width: 18 },
    { header: 'ID Zona', key: 'id_zona', width: 12, pdfWidth: 'auto' },
    { header: 'Galería', key: 'galeria', width: 22 },
    { header: 'ID Galería', key: 'id_galeria', width: 12, pdfWidth: 'auto' },
    { header: 'Ciudad', key: 'ciudad', width: 18 },
    { header: 'ID Ciudad', key: 'id_ciudad', width: 12, pdfWidth: 'auto' },
    { header: 'Suscripción', key: 'suscripcion', width: 18 },
    { header: 'Precio de Suscripción', key: 'precio_suscripcion', width: 20 },
    { header: 'Estado Suscripción', key: 'estado_suscripcion', width: 20 },
    { header: 'Fecha Venc. Suscripción', key: 'fecha_venc_suscripcion', width: 24 },
    { header: 'Observación', key: 'observacion', width: 30 },
    { header: 'Fecha Registro', key: 'fecha', width: 22 },
  ];

  // Columnas de tienda vacias, para el vendedor que aun no registro ninguna.
  const EMPTY_STORE = {
    tienda: '', id_tienda: '', zona: '', id_zona: '', galeria: '', id_galeria: '',
    ciudad: '', id_ciudad: '', suscripcion: '', precio_suscripcion: '',
    estado_suscripcion: '', fecha_venc_suscripcion: '', observacion: '',
  };

  const rows = [];
  sellers.forEach((s) => {
    const perfil = s.tbl_perfil_vendedor;
    // Si el vendedor escogió "Factura" y registró un RUC, la columna Negocio
    // muestra la razón social; en caso contrario, el nombre del negocio.
    const usaFactura = perfil?.tipo_comprobante === 'FACTURA' && !!perfil?.ruc;
    const negocio = (usaFactura ? (perfil?.razon_social || perfil?.nombre_negocio) : perfil?.nombre_negocio) || '';

    const base = {
      id: s.id,
      nombre: s.nombre || '',
      correo: s.correo || '',
      telefono: s.telefono || '',
      estado_cuenta: ACCOUNT_STATUS_LABELS[deriveAccountStatus(s)],
      negocio,
      ruc: perfil?.ruc || '',
      dni: perfil?.dni || '',
      estado: perfil?.estado_aprobacion || '',
      tipo_comprobante: perfil?.tipo_comprobante || '',
      fecha: fmtDate(s.fecha_hora_registro),
    };

    const tiendas = Array.isArray(s.tiendas) ? s.tiendas : [];
    if (tiendas.length === 0) {
      rows.push({ ...base, ...EMPTY_STORE });
      return;
    }

    tiendas.forEach((t) => {
      const sub = t.suscripcion_activa;
      const subActiva = sub?.estado === SUBSCRIPTION_STATUS.ACTIVE;
      const monto = t.transacciones?.[0]?.monto;
      rows.push({
        ...base,
        tienda: t.nombre || '',
        id_tienda: t.id,
        zona: t.tbl_galerias?.tbl_zonas?.nombre || '',
        id_zona: t.tbl_galerias?.tbl_zonas?.id ?? '',
        galeria: t.tbl_galerias?.nombre || '',
        id_galeria: t.tbl_galerias?.id ?? '',
        ciudad: t.tbl_galerias?.tbl_ciudades?.nombre || '',
        id_ciudad: t.tbl_galerias?.tbl_ciudades?.id ?? '',
        suscripcion: planLabel(sub?.tipo_plan),
        precio_suscripcion: subActiva && monto != null ? money(monto) : '',
        estado_suscripcion: sub?.estado || '',
        fecha_venc_suscripcion: fmtDay(sub?.fin_en),
        observacion: t.observacion || '',
      });
    });
  });

  return { columns, rows };
};

// ==================== PRODUCTOS ====================
const fetchProducts = async () => {
  const products = await prisma.tbl_productos.findMany({
    where: { eliminado_en: null },
    select: {
      id: true, nombre: true, precio: true, moneda: true, precio_visible: true,
      estado_aprobacion: true, estado: true, fecha_hora_registro: true,
      id_categoria: true, id_tienda: true,
      tbl_categorias: { select: { nombre: true } },
      tbl_tiendas: {
        select: {
          nombre: true,
          id_galeria: true,
          tbl_galerias: { select: { nombre: true } },
        },
      },
    },
    orderBy: { fecha_hora_registro: 'desc' },
  });

  const columns = [
    { header: 'ID', key: 'id', width: 8, pdfWidth: 'auto' },
    { header: 'Nombre', key: 'nombre', width: 30 },
    { header: 'Categoría', key: 'categoria', width: 20 },
    { header: 'ID Categoría', key: 'id_categoria', width: 12, pdfWidth: 'auto' },
    { header: 'Tienda', key: 'tienda', width: 24 },
    { header: 'ID Tienda', key: 'id_tienda', width: 12, pdfWidth: 'auto' },
    { header: 'Galería', key: 'galeria', width: 22 },
    { header: 'ID Galería', key: 'id_galeria', width: 12, pdfWidth: 'auto' },
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
    id_categoria: p.id_categoria ?? '',
    tienda: p.tbl_tiendas?.nombre || '',
    id_tienda: p.id_tienda ?? '',
    galeria: p.tbl_tiendas?.tbl_galerias?.nombre || '',
    id_galeria: p.tbl_tiendas?.id_galeria ?? '',
    precio: money(p.precio),
    moneda: p.moneda || '',
    precio_visible: yesNo(p.precio_visible),
    estado_aprobacion: p.estado_aprobacion || '',
    estado: p.estado || '',
    fecha: fmtDate(p.fecha_hora_registro),
  }));

  return { columns, rows };
};

// ==================== TIENDAS ====================
const fetchStores = async () => {
  const stores = await prisma.tbl_tiendas.findMany({
    where: { eliminado_en: null },
    select: {
      id: true, nombre: true, telefono: true, numero_local: true,
      estado_aprobacion: true, activo: true, fecha_hora_registro: true,
      id_vendedor: true, id_galeria: true,
      tbl_usuarios: { select: { nombre: true } },
      tbl_galerias: {
        select: {
          nombre: true,
          id_ciudad: true,
          id_zona: true,
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
    { header: 'ID Vendedor', key: 'id_vendedor', width: 12, pdfWidth: 'auto' },
    { header: 'Galería', key: 'galeria', width: 22 },
    { header: 'ID Galería', key: 'id_galeria', width: 12, pdfWidth: 'auto' },
    { header: 'Ciudad', key: 'ciudad', width: 18 },
    { header: 'ID Ciudad', key: 'id_ciudad', width: 12, pdfWidth: 'auto' },
    { header: 'Zona', key: 'zona', width: 18 },
    { header: 'ID Zona', key: 'id_zona', width: 12, pdfWidth: 'auto' },
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
      id_vendedor: s.id_vendedor ?? '',
      galeria: s.tbl_galerias?.nombre || '',
      id_galeria: s.id_galeria ?? '',
      ciudad: s.tbl_galerias?.tbl_ciudades?.nombre || '',
      id_ciudad: s.tbl_galerias?.id_ciudad ?? '',
      zona: s.tbl_galerias?.tbl_zonas?.nombre || '',
      id_zona: s.tbl_galerias?.id_zona ?? '',
      telefono: s.telefono || '',
      numero_local: s.numero_local || '',
      estado_aprobacion: s.estado_aprobacion || '',
      suscripcion: planLabel(sub?.tipo_plan),
      venc: fmtDay(sub?.fin_en),
      activo: yesNo(s.activo),
      fecha: fmtDate(s.fecha_hora_registro),
    };
  });

  return { columns, rows };
};

// ==================== GALERIAS ====================
const fetchGalleries = async () => {
  const galleries = await prisma.tbl_galerias.findMany({
    where: { eliminado_en: null },
    select: {
      id: true, nombre: true, direccion: true, activo: true, fecha_hora_registro: true,
      id_ciudad: true, id_zona: true, latitud: true, longitud: true,
      tbl_ciudades: { select: { nombre: true } },
      tbl_zonas: { select: { nombre: true } },
      _count: { select: { tiendas: { where: { eliminado_en: null } } } },
    },
    orderBy: { nombre: 'asc' },
  });

  const columns = [
    { header: 'ID', key: 'id', width: 8, pdfWidth: 'auto' },
    { header: 'Nombre', key: 'nombre', width: 28 },
    { header: 'ID Ciudad', key: 'id_ciudad', width: 10, pdfWidth: 'auto' },
    { header: 'Ciudad', key: 'ciudad', width: 20 },
    { header: 'ID Zona', key: 'id_zona', width: 10, pdfWidth: 'auto' },
    { header: 'Zona', key: 'zona', width: 20 },
    { header: 'Dirección', key: 'direccion', width: 30 },
    { header: 'Latitud', key: 'latitud', width: 14, pdfWidth: 'auto' },
    { header: 'Longitud', key: 'longitud', width: 14, pdfWidth: 'auto' },
    { header: 'N° Tiendas', key: 'tiendas', width: 12, pdfWidth: 'auto' },
    { header: 'Activo', key: 'activo', width: 10, pdfWidth: 'auto' },
    { header: 'Fecha registro', key: 'fecha', width: 22 },
  ];

  const rows = galleries.map((g) => ({
    id: g.id,
    nombre: g.nombre || '',
    id_ciudad: g.id_ciudad ?? '',
    ciudad: g.tbl_ciudades?.nombre || '',
    id_zona: g.id_zona ?? '',
    zona: g.tbl_zonas?.nombre || '',
    direccion: g.direccion || '',
    latitud: coord(g.latitud),
    longitud: coord(g.longitud),
    tiendas: g._count?.tiendas ?? 0,
    activo: yesNo(g.activo),
    fecha: fmtDate(g.fecha_hora_registro),
  }));

  return { columns, rows };
};

// ==================== ZONAS ====================
const fetchZones = async () => {
  const zones = await prisma.tbl_zonas.findMany({
    where: { eliminado_en: null },
    select: {
      id: true, nombre: true, activo: true, fecha_hora_registro: true,
      tbl_ciudades: { select: { id: true, nombre: true } },
      _count: { select: { tbl_galerias: { where: { eliminado_en: null } } } },
    },
    orderBy: { nombre: 'asc' },
  });

  const columns = [
    { header: 'ID', key: 'id', width: 8, pdfWidth: 'auto' },
    { header: 'Nombre', key: 'nombre', width: 26 },
    { header: 'Ciudad', key: 'ciudad', width: 22 },
    { header: 'ID Ciudad', key: 'id_ciudad', width: 12, pdfWidth: 'auto' },
    { header: 'N° Galerías', key: 'galerias', width: 12, pdfWidth: 'auto' },
    { header: 'Activo', key: 'activo', width: 10, pdfWidth: 'auto' },
    { header: 'Fecha registro', key: 'fecha', width: 22 },
  ];

  const rows = zones.map((z) => ({
    id: z.id,
    nombre: z.nombre || '',
    ciudad: z.tbl_ciudades?.nombre || '',
    id_ciudad: z.tbl_ciudades?.id ?? '',
    galerias: z._count?.tbl_galerias ?? 0,
    activo: yesNo(z.activo),
    fecha: fmtDate(z.fecha_hora_registro),
  }));

  return { columns, rows };
};

// ==================== CATEGORIAS ====================
const fetchCategories = async () => {
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

  return { columns, rows };
};

// ── Registro ──
// El orden de las claves es el orden de las hojas/secciones en la exportacion
// general y el orden de la lista en la UI.
const DATASETS = {
  buyers: { label: 'Compradores', filename: 'compradores', sheet: 'Compradores', fetch: fetchBuyers },
  sellers: { label: 'Vendedores', filename: 'vendedores', sheet: 'Vendedores', fetch: fetchSellers },
  stores: { label: 'Tiendas', filename: 'tiendas', sheet: 'Tiendas', fetch: fetchStores },
  products: { label: 'Productos', filename: 'productos', sheet: 'Productos', fetch: fetchProducts },
  galleries: { label: 'Galerías', filename: 'galerias', sheet: 'Galerías', fetch: fetchGalleries },
  zones: { label: 'Zonas', filename: 'zonas', sheet: 'Zonas', fetch: fetchZones },
  categories: { label: 'Categorías', filename: 'categorias', sheet: 'Categorías', fetch: fetchCategories },
};

const DATASET_KEYS = Object.keys(DATASETS);

module.exports = { DATASETS, DATASET_KEYS };
