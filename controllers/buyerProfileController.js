const prisma = require('../config/db');
const bcrypt = require('bcrypt');
const { deleteFromS3 } = require('../config/s3');

const getBuyerProfile = async (req, res) => {
  try {
    const usuario = await prisma.tbl_usuarios.findFirst({
      where: { id: req.user.id, eliminado_en: null },
      select: {
        id: true,
        nombre: true,
        correo: true,
        telefono: true,
        imagen_perfil: true,
        id_ciudad: true,
        tbl_ciudades: { select: { id: true, nombre: true } },
        correo_verificado: true,
        fecha_hora_registro: true,
      },
    });
    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json({ data: usuario });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener perfil' });
  }
};

const updateBuyerProfile = async (req, res) => {
  try {
    const { nombre, telefono, id_ciudad } = req.body;
    const data = { id_usuario_modificacion: req.user.id, fecha_hora_modificacion: new Date() };

    if (nombre) data.nombre = nombre;
    if (telefono !== undefined) data.telefono = telefono || null;
    if (id_ciudad !== undefined) {
      if (id_ciudad) {
        const ciudad = await prisma.tbl_ciudades.findFirst({
          where: { id: parseInt(id_ciudad), activo: true, eliminado_en: null },
        });
        if (!ciudad) return res.status(400).json({ error: 'Ciudad no valida' });
        data.id_ciudad = parseInt(id_ciudad);
      } else {
        data.id_ciudad = null;
      }
    }

    const updated = await prisma.tbl_usuarios.update({
      where: { id: req.user.id },
      data,
      select: { id: true, nombre: true, correo: true, telefono: true, imagen_perfil: true, id_ciudad: true },
    });

    res.json({ data: updated });
  } catch (error) {
    console.error('Error actualizando perfil comprador:', error);
    res.status(500).json({ error: 'Error al actualizar perfil' });
  }
};

const changeBuyerPassword = async (req, res) => {
  try {
    const { contrasena_actual, nueva_contrasena } = req.body;

    if (!contrasena_actual || !nueva_contrasena) {
      return res.status(400).json({ error: 'Contraseña actual y nueva son obligatorias' });
    }
    if (nueva_contrasena.length < 6) {
      return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres' });
    }

    const usuario = await prisma.tbl_usuarios.findFirst({
      where: { id: req.user.id, eliminado_en: null },
      select: { id: true, contrasena: true },
    });
    if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });

    const coincide = await bcrypt.compare(contrasena_actual, usuario.contrasena);
    if (!coincide) {
      return res.status(400).json({ error: 'La contraseña actual es incorrecta' });
    }

    const hash = await bcrypt.hash(nueva_contrasena, 10);
    await prisma.tbl_usuarios.update({
      where: { id: req.user.id },
      data: { contrasena: hash },
    });

    res.json({ message: 'Contraseña actualizada correctamente' });
  } catch (error) {
    console.error('Error cambiando contraseña:', error);
    res.status(500).json({ error: 'Error al cambiar contraseña' });
  }
};

// Subir/actualizar imagen de perfil (compartido buyer/seller)
const s3KeyFromUrl = (url) => {
  const bucket = process.env.S3_BUCKET || 'marketplace-uploads';
  const idx = url.indexOf(`/${bucket}/`);
  if (idx === -1) return null;
  return url.substring(idx + bucket.length + 2);
};

const uploadProfileImage = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No se proporcionó imagen' });
    }

    const file = req.files[0];

    // Eliminar imagen anterior de S3 si existe
    const usuario = await prisma.tbl_usuarios.findUnique({
      where: { id: req.user.id },
      select: { imagen_perfil: true },
    });
    if (usuario?.imagen_perfil) {
      const oldKey = s3KeyFromUrl(usuario.imagen_perfil);
      if (oldKey) {
        try { await deleteFromS3(oldKey); } catch {}
      }
    }

    // Guardar nueva URL
    const updated = await prisma.tbl_usuarios.update({
      where: { id: req.user.id },
      data: {
        imagen_perfil: file.s3Url,
        id_usuario_modificacion: req.user.id,
        fecha_hora_modificacion: new Date(),
      },
      select: { id: true, imagen_perfil: true },
    });

    res.json({ data: updated });
  } catch (error) {
    console.error('Error subiendo imagen de perfil:', error);
    res.status(500).json({ error: 'Error al subir imagen de perfil' });
  }
};

module.exports = { getBuyerProfile, updateBuyerProfile, changeBuyerPassword, uploadProfileImage };
