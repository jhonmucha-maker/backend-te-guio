const prisma = require('../config/db');
const { UPLOAD } = require('../config/constants');
const { deleteFromS3 } = require('../config/s3');

// Extraer s3Key de una URL (soporta proxy y directa S3)
function s3KeyFromUrl(url) {
  if (!url) return null;
  // Formato proxy del backend: /api/catalog/files/photos/1/foto.jpg
  const proxyPrefix = '/api/catalog/files/';
  if (url.includes(proxyPrefix)) {
    return url.substring(url.indexOf(proxyPrefix) + proxyPrefix.length);
  }
  // Formato directo S3: https://s3.*.wasabisys.com/bucket/photos/1/foto.jpg
  const bucket = process.env.S3_BUCKET || 'marketplace-uploads';
  const idx = url.indexOf(`/${bucket}/`);
  if (idx !== -1) return url.substring(idx + bucket.length + 2);
  return null;
}

// ==================== FOTOS TIENDAS ====================
const addStorePhotos = async (req, res) => {
  try {
    const tienda = await prisma.tbl_tiendas.findFirst({
      where: { id: parseInt(req.params.id), id_vendedor: req.user.id, eliminado_en: null },
      include: { _count: { select: { fotos: true } } },
    });
    if (!tienda) return res.status(404).json({ error: 'Tienda no encontrada' });

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'Se requiere al menos una foto' });
    }

    const currentCount = tienda._count.fotos;
    if (currentCount + req.files.length > UPLOAD.MAX_PHOTOS_PER_ENTITY) {
      return res.status(400).json({ error: `Maximo ${UPLOAD.MAX_PHOTOS_PER_ENTITY} fotos por tienda. Actualmente tiene ${currentCount}.` });
    }

    const fotos = req.files.map((file, i) => ({
      id_tienda: tienda.id,
      url: file.s3Url,
      posicion: currentCount + i,
    }));

    await prisma.tbl_fotos_tiendas.createMany({ data: fotos });

    const allFotos = await prisma.tbl_fotos_tiendas.findMany({
      where: { id_tienda: tienda.id },
      orderBy: { posicion: 'asc' },
    });

    res.status(201).json({ data: allFotos });
  } catch (error) {
    console.error('Error subiendo fotos tienda:', error);
    res.status(500).json({ error: 'Error al subir fotos' });
  }
};

const deleteStorePhoto = async (req, res) => {
  try {
    const foto = await prisma.tbl_fotos_tiendas.findUnique({
      where: { id: parseInt(req.params.photoId) },
      include: { tbl_tiendas: { select: { id_vendedor: true } } },
    });
    if (!foto || foto.tbl_tiendas.id_vendedor !== req.user.id) {
      return res.status(404).json({ error: 'Foto no encontrada' });
    }

    // Eliminar de S3
    const key = s3KeyFromUrl(foto.url);
    if (key) {
      try { await deleteFromS3(key); } catch {}
    }

    await prisma.tbl_fotos_tiendas.delete({ where: { id: foto.id } });

    res.json({ mensaje: 'Foto eliminada' });
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar foto' });
  }
};

// ==================== FOTOS PRODUCTOS ====================
const addProductPhotos = async (req, res) => {
  try {
    const producto = await prisma.tbl_productos.findFirst({
      where: { id: parseInt(req.params.id), eliminado_en: null },
      include: {
        tbl_tiendas: { select: { id_vendedor: true } },
        _count: { select: { fotos: true } },
      },
    });
    if (!producto || producto.tbl_tiendas.id_vendedor !== req.user.id) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'Se requiere al menos una foto' });
    }

    const currentCount = producto._count.fotos;
    if (currentCount + req.files.length > UPLOAD.MAX_PHOTOS_PER_ENTITY) {
      return res.status(400).json({ error: `Maximo ${UPLOAD.MAX_PHOTOS_PER_ENTITY} fotos por producto. Actualmente tiene ${currentCount}.` });
    }

    const fotos = req.files.map((file, i) => ({
      id_producto: producto.id,
      url: file.s3Url,
      posicion: currentCount + i,
    }));

    await prisma.tbl_fotos_productos.createMany({ data: fotos });

    const allFotos = await prisma.tbl_fotos_productos.findMany({
      where: { id_producto: producto.id },
      orderBy: { posicion: 'asc' },
    });

    res.status(201).json({ data: allFotos });
  } catch (error) {
    console.error('Error subiendo fotos producto:', error);
    res.status(500).json({ error: 'Error al subir fotos' });
  }
};

const deleteProductPhoto = async (req, res) => {
  try {
    const foto = await prisma.tbl_fotos_productos.findUnique({
      where: { id: parseInt(req.params.photoId) },
      include: { tbl_productos: { include: { tbl_tiendas: { select: { id_vendedor: true } } } } },
    });
    if (!foto || foto.tbl_productos.tbl_tiendas.id_vendedor !== req.user.id) {
      return res.status(404).json({ error: 'Foto no encontrada' });
    }

    const key = s3KeyFromUrl(foto.url);
    if (key) {
      try { await deleteFromS3(key); } catch {}
    }

    await prisma.tbl_fotos_productos.delete({ where: { id: foto.id } });

    res.json({ mensaje: 'Foto eliminada' });
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar foto' });
  }
};

// ==================== FOTOS GALERIAS (Admin) ====================
const addGalleryPhotos = async (req, res) => {
  try {
    const galeria = await prisma.tbl_galerias.findFirst({
      where: { id: parseInt(req.params.id), eliminado_en: null },
      include: { _count: { select: { fotos: true } } },
    });
    if (!galeria) return res.status(404).json({ error: 'Galeria no encontrada' });

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'Se requiere al menos una foto' });
    }

    const currentCount = galeria._count.fotos;
    if (currentCount + req.files.length > UPLOAD.MAX_PHOTOS_PER_ENTITY) {
      return res.status(400).json({ error: `Maximo ${UPLOAD.MAX_PHOTOS_PER_ENTITY} fotos por galeria. Actualmente tiene ${currentCount}.` });
    }

    const fotos = req.files.map((file, i) => ({
      id_galeria: galeria.id,
      url: file.s3Url,
      posicion: currentCount + i,
    }));

    await prisma.tbl_fotos_galerias.createMany({ data: fotos });

    const allFotos = await prisma.tbl_fotos_galerias.findMany({
      where: { id_galeria: galeria.id },
      orderBy: { posicion: 'asc' },
    });

    res.status(201).json({ data: allFotos });
  } catch (error) {
    console.error('Error subiendo fotos galeria:', error);
    res.status(500).json({ error: 'Error al subir fotos' });
  }
};

const deleteGalleryPhoto = async (req, res) => {
  try {
    const foto = await prisma.tbl_fotos_galerias.findUnique({
      where: { id: parseInt(req.params.photoId) },
    });
    if (!foto) return res.status(404).json({ error: 'Foto no encontrada' });

    const key = s3KeyFromUrl(foto.url);
    if (key) {
      try { await deleteFromS3(key); } catch {}
    }

    await prisma.tbl_fotos_galerias.delete({ where: { id: foto.id } });

    res.json({ mensaje: 'Foto eliminada' });
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar foto' });
  }
};

// ==================== DOCS VENDEDOR ====================
const addSellerDocs = async (req, res) => {
  try {
    const perfil = await prisma.tbl_perfiles_vendedor.findFirst({
      where: { id_usuario: req.user.id },
    });
    if (!perfil) return res.status(404).json({ error: 'Perfil vendedor no encontrado' });

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'Se requiere al menos un documento' });
    }

    const docs = req.files.map(file => ({
      id_perfil_vendedor: perfil.id,
      tipo: req.body.tipo || 'OTHER',
      url_archivo: file.s3Url,
      id_usuario_registro: req.user.id,
    }));

    await prisma.tbl_documentos_vendedor.createMany({ data: docs });

    const allDocs = await prisma.tbl_documentos_vendedor.findMany({
      where: { id_perfil_vendedor: perfil.id },
    });

    res.status(201).json({ data: allDocs });
  } catch (error) {
    console.error('Error subiendo documentos:', error);
    res.status(500).json({ error: 'Error al subir documentos' });
  }
};

module.exports = {
  addStorePhotos, deleteStorePhoto,
  addProductPhotos, deleteProductPhoto,
  addGalleryPhotos, deleteGalleryPhoto,
  addSellerDocs,
};
