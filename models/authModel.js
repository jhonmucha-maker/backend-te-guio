const prisma = require('../config/db');

const findUserByEmail = async (correo) => {
  const usuario = await prisma.tbl_usuarios.findFirst({
    where: {
      correo,
      activo: true,
      eliminado_en: null,
    },
    include: {
      tbl_roles: {
        include: {
          tbl_roles_permisos: {
            where: { estado: 1 },
            include: {
              tbl_permisos: {
                select: {
                  codigo: true,
                  nombre: true,
                  tipo: true,
                  recurso: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!usuario) return null;

  const permisos = usuario.tbl_roles.tbl_roles_permisos
    .filter(rp => rp.tbl_permisos && rp.tbl_permisos.codigo)
    .map(rp => ({
      codigo: rp.tbl_permisos.codigo,
      nombre: rp.tbl_permisos.nombre,
      tipo: rp.tbl_permisos.tipo,
      recurso: rp.tbl_permisos.recurso,
    }));

  return {
    id: usuario.id,
    nombre: usuario.nombre,
    correo: usuario.correo,
    contrasena: usuario.contrasena,
    imagen_perfil: usuario.imagen_perfil,
    id_rol: usuario.id_rol,
    rol: usuario.tbl_roles.nombre,
    correo_verificado: usuario.correo_verificado,
    activo: usuario.activo,
    id_ciudad: usuario.id_ciudad,
    id_usuario_registro: usuario.id_usuario_registro,
    permisos,
  };
};

const findUserById = async (id) => {
  const usuario = await prisma.tbl_usuarios.findFirst({
    where: { id, activo: true, eliminado_en: null },
    include: {
      tbl_roles: true,
      tbl_ciudades: { select: { id: true, nombre: true } },
    },
  });
  if (!usuario) return null;
  return {
    id: usuario.id,
    nombre: usuario.nombre,
    correo: usuario.correo,
    telefono: usuario.telefono,
    imagen_perfil: usuario.imagen_perfil,
    id_rol: usuario.id_rol,
    rol: usuario.tbl_roles.nombre,
    correo_verificado: usuario.correo_verificado,
    id_ciudad: usuario.id_ciudad,
    ciudad: usuario.tbl_ciudades ? usuario.tbl_ciudades.nombre : null,
    id_usuario_registro: usuario.id_usuario_registro,
  };
};

const createUser = async (data) => {
  return prisma.tbl_usuarios.create({ data });
};

const updateLastLogin = async (id) => {
  return prisma.tbl_usuarios.update({
    where: { id },
    data: { ultimo_login: new Date() },
  });
};

const createVerificationCode = async (id_usuario, codigo, expira_en) => {
  return prisma.tbl_codigos_verificacion_email.create({
    data: { id_usuario, codigo, expira_en },
  });
};

const findVerificationCode = async (id_usuario, codigo) => {
  return prisma.tbl_codigos_verificacion_email.findFirst({
    where: {
      id_usuario,
      codigo,
      expira_en: { gte: new Date() },
      intentos: { lt: 5 },
    },
    orderBy: { fecha_hora_registro: 'desc' },
  });
};

const markEmailVerified = async (id) => {
  return prisma.tbl_usuarios.update({
    where: { id },
    data: { correo_verificado: true },
  });
};

const incrementVerificationAttempts = async (id) => {
  return prisma.tbl_codigos_verificacion_email.update({
    where: { id },
    data: { intentos: { increment: 1 } },
  });
};

const createPasswordResetToken = async (id_usuario, token_hash, expira_en) => {
  return prisma.tbl_tokens_recuperacion.create({
    data: { id_usuario, token_hash, expira_en },
  });
};

const findPasswordResetToken = async (token_hash) => {
  return prisma.tbl_tokens_recuperacion.findFirst({
    where: {
      token_hash,
      expira_en: { gte: new Date() },
      usado_en: null,
    },
  });
};

const markResetTokenUsed = async (id) => {
  return prisma.tbl_tokens_recuperacion.update({
    where: { id },
    data: { usado_en: new Date() },
  });
};

const updatePassword = async (id, contrasena) => {
  return prisma.tbl_usuarios.update({
    where: { id },
    data: { contrasena },
  });
};

const saveRefreshToken = async (id_usuario, token_hash, expira_en, user_agent, ip) => {
  return prisma.tbl_tokens_refresco.create({
    data: { id_usuario, token_hash, expira_en, user_agent, ip },
  });
};

const revokeRefreshTokensByUser = async (id_usuario) => {
  return prisma.tbl_tokens_refresco.updateMany({
    where: { id_usuario, revocado_en: null },
    data: { revocado_en: new Date() },
  });
};

module.exports = {
  findUserByEmail,
  findUserById,
  createUser,
  updateLastLogin,
  createVerificationCode,
  findVerificationCode,
  markEmailVerified,
  incrementVerificationAttempts,
  createPasswordResetToken,
  findPasswordResetToken,
  markResetTokenUsed,
  updatePassword,
  saveRefreshToken,
  revokeRefreshTokensByUser,
};
