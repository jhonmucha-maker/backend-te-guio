const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const prisma = require('../config/db');
const { ROLES } = require('../config/constants');
const {
  findUserByEmail, findUserById, createUser, updateLastLogin,
  createVerificationCode, findVerificationCode, markEmailVerified,
  createPasswordResetToken, findPasswordResetToken, markResetTokenUsed,
  updatePassword, saveRefreshToken, revokeRefreshTokensByUser,
} = require('../models/authModel');

const generarTokens = (usuario) => {
  const payload = { id: usuario.id, correo: usuario.correo, id_rol: usuario.id_rol, rol: usuario.rol, permisos: usuario.permisos };
  const accessToken = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '4h' });
  const refreshToken = jwt.sign({ id: usuario.id, type: 'refresh' }, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET, { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' });
  return { accessToken, refreshToken };
};

const loginUser = async (correo, contrasena, userAgent, ip) => {
  const usuario = await findUserByEmail(correo);
  if (!usuario) throw { status: 404, message: 'Correo no registrado o usuario inactivo' };

  const coincide = await bcrypt.compare(contrasena, usuario.contrasena);
  if (!coincide) throw { status: 401, message: 'Contrasena incorrecta' };

  if (!usuario.correo_verificado && usuario.rol !== ROLES.ADMINISTRADOR) {
    throw { status: 403, message: 'Email no verificado', extra: { requireVerification: true } };
  }

  const terminosVigentes = await prisma.tbl_versiones_terminos.findFirst({ where: { es_vigente: true } });
  let requireTerms = false;
  if (terminosVigentes) {
    const aceptacion = await prisma.tbl_aceptaciones_terminos.findUnique({
      where: { id_usuario_id_version_terminos: { id_usuario: usuario.id, id_version_terminos: terminosVigentes.id } },
    });
    if (!aceptacion) requireTerms = true;
  }

  const { accessToken, refreshToken } = generarTokens(usuario);

  const refreshHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
  const refreshExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await saveRefreshToken(usuario.id, refreshHash, refreshExpiry, userAgent, ip);
  await updateLastLogin(usuario.id);

  return {
    token: accessToken, refreshToken, requireTerms,
    usuario: { id: usuario.id, nombre: usuario.nombre, correo: usuario.correo, id_rol: usuario.id_rol, rol: usuario.rol, permisos: usuario.permisos },
  };
};

const registerBuyerUser = async (data) => {
  const existe = await prisma.tbl_usuarios.findFirst({ where: { correo: data.correo } });
  if (existe) throw { status: 409, message: 'El correo ya esta registrado' };

  if (data.id_ciudad) {
    const ciudad = await prisma.tbl_ciudades.findFirst({ where: { id: parseInt(data.id_ciudad), activo: true, eliminado_en: null } });
    if (!ciudad) throw { status: 400, message: 'Ciudad no valida o inactiva' };
  }

  const rolComprador = await prisma.tbl_roles.findFirst({ where: { nombre: ROLES.COMPRADOR, estado: 1 } });
  if (!rolComprador) throw { status: 500, message: 'Rol COMPRADOR no configurado' };

  const passwordHash = await bcrypt.hash(data.contrasena, 10);
  const nuevoUsuario = await createUser({
    nombre: data.nombre, correo: data.correo, telefono: data.telefono || null,
    contrasena: passwordHash, id_rol: rolComprador.id,
    id_ciudad: data.id_ciudad ? parseInt(data.id_ciudad) : null, correo_verificado: false, activo: true,
  });

  const codigo = Math.floor(100000 + Math.random() * 900000).toString();
  await createVerificationCode(nuevoUsuario.id, codigo, new Date(Date.now() + 15 * 60 * 1000));
  console.log(`[DEV] Codigo de verificacion para ${data.correo}: ${codigo}`);

  return { usuario_id: nuevoUsuario.id };
};

const registerSellerUser = async (data) => {
  const existe = await prisma.tbl_usuarios.findFirst({ where: { correo: data.correo } });
  if (existe) throw { status: 409, message: 'El correo ya esta registrado' };

  const rolVendedor = await prisma.tbl_roles.findFirst({ where: { nombre: ROLES.VENDEDOR, estado: 1 } });
  if (!rolVendedor) throw { status: 500, message: 'Rol VENDEDOR no configurado' };

  const passwordHash = await bcrypt.hash(data.contrasena, 10);

  const nuevoUsuario = await prisma.$transaction(async (tx) => {
    const user = await tx.tbl_usuarios.create({
      data: {
        nombre: data.nombre, correo: data.correo, telefono: data.telefono || null,
        contrasena: passwordHash, id_rol: rolVendedor.id, correo_verificado: false, activo: true,
      },
    });
    await tx.tbl_perfiles_vendedor.create({
      data: {
        id_usuario: user.id, nombre_negocio: data.nombre_negocio || null,
        ruc: data.ruc || null, dni: data.dni || null, direccion: data.direccion || null,
        estado_aprobacion: 'PENDIENTE', id_usuario_registro: user.id,
      },
    });
    return user;
  });

  const codigo = Math.floor(100000 + Math.random() * 900000).toString();
  await createVerificationCode(nuevoUsuario.id, codigo, new Date(Date.now() + 15 * 60 * 1000));
  console.log(`[DEV] Codigo de verificacion para ${data.correo}: ${codigo}`);

  return { usuario_id: nuevoUsuario.id };
};

const verifyEmailCode = async (correo, codigo) => {
  const usuario = await prisma.tbl_usuarios.findFirst({ where: { correo, eliminado_en: null } });
  if (!usuario) throw { status: 404, message: 'Usuario no encontrado' };
  if (usuario.correo_verificado) throw { status: 400, message: 'Email ya verificado' };

  const reg = await findVerificationCode(usuario.id, codigo);
  if (!reg) throw { status: 400, message: 'Codigo invalido o expirado' };

  await markEmailVerified(usuario.id);
};

const requestPasswordReset = async (correo) => {
  const usuario = await prisma.tbl_usuarios.findFirst({ where: { correo, activo: true, eliminado_en: null } });
  if (!usuario) return;

  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  await createPasswordResetToken(usuario.id, tokenHash, new Date(Date.now() + 60 * 60 * 1000));
  console.log(`[DEV] Token de reset para ${correo}: ${token}`);
};

const resetUserPassword = async (token, nueva_contrasena) => {
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const resetToken = await findPasswordResetToken(tokenHash);
  if (!resetToken) throw { status: 400, message: 'Token invalido o expirado' };

  const passwordHash = await bcrypt.hash(nueva_contrasena, 10);
  await updatePassword(resetToken.id_usuario, passwordHash);
  await markResetTokenUsed(resetToken.id);
  await revokeRefreshTokensByUser(resetToken.id_usuario);
};

const logoutUser = async (userId) => {
  if (userId) await revokeRefreshTokensByUser(userId);
};

const getUserProfile = async (userId) => {
  const usuario = await findUserById(userId);
  if (!usuario) throw { status: 404, message: 'Usuario no encontrado' };
  return usuario;
};

module.exports = {
  loginUser, registerBuyerUser, registerSellerUser, verifyEmailCode,
  requestPasswordReset, resetUserPassword, logoutUser, getUserProfile,
};
