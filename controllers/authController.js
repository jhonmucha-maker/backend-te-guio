const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const {
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
} = require('../models/authModel');
const prisma = require('../config/db');
const { ROLES } = require('../config/constants');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../services/emailService');
const notificationService = require('../services/notificationService');

const generarTokens = (usuario) => {
  const payload = {
    id: usuario.id,
    correo: usuario.correo,
    id_rol: usuario.id_rol,
    rol: usuario.rol,
    permisos: usuario.permisos,
  };
  const accessToken = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '4h',
  });
  const refreshToken = jwt.sign(
    { id: usuario.id, type: 'refresh' },
    process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
  );
  return { accessToken, refreshToken };
};

const login = async (req, res) => {
  console.log(`[LOGIN] Intento de login: correo=${req.body?.correo || 'VACIO'} origin=${req.headers.origin || 'none'} ip=${req.ip}`);
  const { correo, contrasena } = req.body;
  if (!correo || !contrasena) {
    console.log(`[LOGIN] FAIL: campos vacios correo=${!!correo} contrasena=${!!contrasena}`);
    return res.status(400).json({ error: 'Correo y contrasena son requeridos' });
  }

  try {
    const usuario = await findUserByEmail(correo);
    if (!usuario) {
      console.log(`[LOGIN] FAIL: correo no encontrado: ${correo}`);
      return res.status(404).json({ error: 'Correo no registrado o usuario inactivo' });
    }

    const coincide = await bcrypt.compare(contrasena, usuario.contrasena);
    if (!coincide) {
      console.log(`[LOGIN] FAIL: contrasena incorrecta para: ${correo}`);
      return res.status(401).json({ error: 'Contrasena incorrecta' });
    }

    if (!usuario.correo_verificado && usuario.rol !== ROLES.ADMINISTRADOR) {
      return res.status(403).json({ error: 'Email no verificado', requireVerification: true });
    }

    // Verificar terminos aceptados
    const terminosVigentes = await prisma.tbl_versiones_terminos.findFirst({
      where: { es_vigente: true },
    });

    let requireTerms = false;
    if (terminosVigentes) {
      const aceptacion = await prisma.tbl_aceptaciones_terminos.findUnique({
        where: {
          id_usuario_id_version_terminos: {
            id_usuario: usuario.id,
            id_version_terminos: terminosVigentes.id,
          },
        },
      });
      if (!aceptacion) {
        requireTerms = true;
      }
    }

    const { accessToken, refreshToken } = generarTokens(usuario);

    // Guardar refresh token
    const refreshHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const refreshExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await saveRefreshToken(
      usuario.id,
      refreshHash,
      refreshExpiry,
      req.headers['user-agent'] || null,
      req.ip
    );

    await updateLastLogin(usuario.id);

    // Registrar dispositivo push si se proporciona
    if (req.body.device_token && req.body.plataforma) {
      await prisma.tbl_dispositivos_push.upsert({
        where: {
          id_usuario_token_dispositivo: {
            id_usuario: usuario.id,
            token_dispositivo: req.body.device_token,
          },
        },
        create: {
          id_usuario: usuario.id,
          token_dispositivo: req.body.device_token,
          plataforma: req.body.plataforma,
          activo: true,
          ultima_conexion: new Date(),
        },
        update: {
          activo: true,
          ultima_conexion: new Date(),
        },
      });
    }

    console.log(`[LOGIN] OK: usuario=${usuario.correo} rol=${usuario.rol} id=${usuario.id}`);
    res.json({
      mensaje: 'Login exitoso',
      token: accessToken,
      refreshToken,
      requireTerms,
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre,
        correo: usuario.correo,
        imagen_perfil: usuario.imagen_perfil,
        id_rol: usuario.id_rol,
        rol: usuario.rol,
        id_ciudad: usuario.id_ciudad,
        id_usuario_registro: usuario.id_usuario_registro,
        permisos: usuario.permisos,
      },
    });
  } catch (error) {
    console.error(`[LOGIN] ERROR INTERNO: ${error.message}`, error.stack);
    res.status(500).json({ error: 'Error al iniciar sesion' });
  }
};

const registerBuyer = async (req, res) => {
  const { nombre, correo, telefono, contrasena, id_ciudad } = req.body;

  if (!nombre || !correo || !contrasena) {
    return res.status(400).json({ error: 'Nombre, correo y contrasena son requeridos' });
  }

  try {
    const existe = await prisma.tbl_usuarios.findFirst({ where: { correo, eliminado_en: null } });
    if (existe) {
      return res.status(409).json({ error: 'El correo ya esta registrado' });
    }

    // Validar ciudad
    if (id_ciudad) {
      const ciudad = await prisma.tbl_ciudades.findFirst({
        where: { id: parseInt(id_ciudad), activo: true, eliminado_en: null },
      });
      if (!ciudad) {
        return res.status(400).json({ error: 'Ciudad no valida o inactiva' });
      }
    }

    // Obtener rol COMPRADOR
    const rolComprador = await prisma.tbl_roles.findFirst({
      where: { nombre: ROLES.COMPRADOR, estado: 1 },
    });
    if (!rolComprador) {
      return res.status(500).json({ error: 'Rol COMPRADOR no configurado' });
    }

    const passwordHash = await bcrypt.hash(contrasena, 10);

    const nuevoUsuario = await createUser({
      nombre,
      correo,
      telefono: telefono || null,
      contrasena: passwordHash,
      id_rol: rolComprador.id,
      id_ciudad: id_ciudad ? parseInt(id_ciudad) : null,
      correo_verificado: false,
      activo: true,
    });

    // Generar codigo de verificacion
    const codigo = Math.floor(100000 + Math.random() * 900000).toString();
    const expira_en = new Date(Date.now() + 15 * 60 * 1000); // 15 min
    await createVerificationCode(nuevoUsuario.id, codigo, expira_en);

    const emailEnviado = await sendVerificationEmail(correo, codigo, nombre);
    if (!emailEnviado) {
      console.warn(`[AUTH] Usuario comprador ${correo} creado pero email de verificación NO se envió`);
    }

    res.status(201).json({
      mensaje: 'Registro exitoso. Verifica tu email.',
      usuario_id: nuevoUsuario.id,
    });
  } catch (error) {
    console.error('Error en registro comprador:', error);
    res.status(500).json({ error: 'Error al registrar comprador' });
  }
};

const registerSeller = async (req, res) => {
  const { nombre, correo, telefono, contrasena, nombre_negocio, ruc, dni, direccion } = req.body;

  if (!nombre || !correo || !contrasena) {
    return res.status(400).json({ error: 'Nombre, correo y contrasena son requeridos' });
  }

  try {
    const existe = await prisma.tbl_usuarios.findFirst({ where: { correo, eliminado_en: null } });
    if (existe) {
      return res.status(409).json({ error: 'El correo ya esta registrado' });
    }

    const rolVendedor = await prisma.tbl_roles.findFirst({
      where: { nombre: ROLES.VENDEDOR, estado: 1 },
    });
    if (!rolVendedor) {
      return res.status(500).json({ error: 'Rol VENDEDOR no configurado' });
    }

    const passwordHash = await bcrypt.hash(contrasena, 10);

    const nuevoUsuario = await prisma.$transaction(async (tx) => {
      const user = await tx.tbl_usuarios.create({
        data: {
          nombre,
          correo,
          telefono: telefono || null,
          contrasena: passwordHash,
          id_rol: rolVendedor.id,
          correo_verificado: false,
          activo: true,
        },
      });

      await tx.tbl_perfiles_vendedor.create({
        data: {
          id_usuario: user.id,
          nombre_negocio: nombre_negocio || null,
          ruc: ruc || null,
          dni: dni || null,
          direccion: direccion || null,
          estado_aprobacion: 'PENDIENTE',
          id_usuario_registro: user.id,
        },
      });

      return user;
    });

    // Generar codigo de verificacion
    const codigo = Math.floor(100000 + Math.random() * 900000).toString();
    const expira_en = new Date(Date.now() + 15 * 60 * 1000);
    await createVerificationCode(nuevoUsuario.id, codigo, expira_en);

    const emailEnviado = await sendVerificationEmail(correo, codigo, nombre);
    if (!emailEnviado) {
      console.warn(`[AUTH] Usuario vendedor ${correo} creado pero email de verificación NO se envió`);
    }

    // Notificar a admins sobre nueva solicitud de vendedor
    notificationService.newPendingApproval('seller', { nombre_vendedor: nombre });

    res.status(201).json({
      mensaje: 'Registro vendedor exitoso. Verifica tu email.',
      usuario_id: nuevoUsuario.id,
    });
  } catch (error) {
    console.error('Error en registro vendedor:', error);
    res.status(500).json({ error: 'Error al registrar vendedor' });
  }
};

const verifyEmail = async (req, res) => {
  const { correo, codigo } = req.body;
  if (!correo || !codigo) {
    return res.status(400).json({ error: 'Correo y codigo son requeridos' });
  }

  try {
    const usuario = await prisma.tbl_usuarios.findFirst({
      where: { correo, eliminado_en: null },
    });
    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    if (usuario.correo_verificado) {
      return res.status(400).json({ error: 'Email ya verificado' });
    }

    // Buscar el codigo mas reciente del usuario (sin filtro de codigo) para incrementar intentos
    const regReciente = await prisma.tbl_codigos_verificacion_email.findFirst({
      where: { id_usuario: usuario.id, expira_en: { gte: new Date() } },
      orderBy: { fecha_hora_registro: 'desc' },
    });

    const reg = await findVerificationCode(usuario.id, codigo);
    if (!reg) {
      // Incrementar intentos si hay un registro reciente
      if (regReciente) {
        await incrementVerificationAttempts(regReciente.id);
      }
      return res.status(400).json({ error: 'Codigo invalido o expirado' });
    }

    await markEmailVerified(usuario.id);

    res.json({ mensaje: 'Email verificado exitosamente' });
  } catch (error) {
    console.error('Error verificando email:', error);
    res.status(500).json({ error: 'Error al verificar email' });
  }
};

const resendEmailCode = async (req, res) => {
  const { correo } = req.body;
  if (!correo) {
    return res.status(400).json({ error: 'Correo es requerido' });
  }

  try {
    const usuario = await prisma.tbl_usuarios.findFirst({
      where: { correo, eliminado_en: null },
    });
    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    if (usuario.correo_verificado) {
      return res.status(400).json({ error: 'Email ya verificado' });
    }

    const codigo = Math.floor(100000 + Math.random() * 900000).toString();
    const expira_en = new Date(Date.now() + 15 * 60 * 1000);
    await createVerificationCode(usuario.id, codigo, expira_en);

    const emailEnviado = await sendVerificationEmail(correo, codigo, usuario.nombre);
    if (!emailEnviado) {
      console.warn(`[AUTH] Reenvío de código a ${correo} falló`);
      return res.status(500).json({ error: 'No se pudo enviar el código. Intenta de nuevo.' });
    }

    res.json({ mensaje: 'Codigo reenviado' });
  } catch (error) {
    console.error('Error reenviando codigo:', error);
    res.status(500).json({ error: 'Error al reenviar codigo' });
  }
};

const forgotPassword = async (req, res) => {
  const { correo } = req.body;
  if (!correo) {
    return res.status(400).json({ error: 'Correo es requerido' });
  }

  try {
    const usuario = await prisma.tbl_usuarios.findFirst({
      where: { correo, activo: true, eliminado_en: null },
    });
    if (!usuario) {
      return res.json({ mensaje: 'Si el correo existe, recibiras un enlace de recuperacion' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const expira_en = new Date(Date.now() + 60 * 60 * 1000); // 1 hora

    await createPasswordResetToken(usuario.id, tokenHash, expira_en);

    const emailEnviado = await sendPasswordResetEmail(correo, token, usuario.nombre);
    if (!emailEnviado) {
      console.warn(`[AUTH] Email de recuperación a ${correo} falló`);
    }

    res.json({ mensaje: 'Si el correo existe, recibiras un enlace de recuperacion' });
  } catch (error) {
    console.error('Error en forgot password:', error);
    res.status(500).json({ error: 'Error al procesar solicitud' });
  }
};

const resetPassword = async (req, res) => {
  const { token, nueva_contrasena } = req.body;
  if (!token || !nueva_contrasena) {
    return res.status(400).json({ error: 'Token y nueva contrasena son requeridos' });
  }

  try {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const resetToken = await findPasswordResetToken(tokenHash);

    if (!resetToken) {
      return res.status(400).json({ error: 'Token invalido o expirado' });
    }

    const passwordHash = await bcrypt.hash(nueva_contrasena, 10);
    await updatePassword(resetToken.id_usuario, passwordHash);
    await markResetTokenUsed(resetToken.id);
    await revokeRefreshTokensByUser(resetToken.id_usuario);

    res.json({ mensaje: 'Contrasena actualizada exitosamente' });
  } catch (error) {
    console.error('Error en reset password:', error);
    res.status(500).json({ error: 'Error al restablecer contrasena' });
  }
};

const refreshTokenHandler = async (req, res) => {
  const { refreshToken: incomingToken } = req.body;
  if (!incomingToken) {
    return res.status(400).json({ error: 'refreshToken es requerido' });
  }

  try {
    // Verificar JWT del refresh token
    const decoded = jwt.verify(
      incomingToken,
      process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET
    );
    if (decoded.type !== 'refresh') {
      return res.status(401).json({ error: 'Token invalido' });
    }

    // Buscar el token en BD
    const tokenHash = crypto.createHash('sha256').update(incomingToken).digest('hex');
    const storedToken = await prisma.tbl_tokens_refresco.findFirst({
      where: { token_hash: tokenHash, revocado_en: null, expira_en: { gte: new Date() } },
    });
    if (!storedToken) {
      return res.status(401).json({ error: 'Refresh token revocado o expirado' });
    }

    // Revocar el token usado (rotacion)
    await prisma.tbl_tokens_refresco.update({
      where: { id: storedToken.id },
      data: { revocado_en: new Date() },
    });

    // Obtener usuario con roles y permisos
    const usuario = await findUserByEmail(
      (await prisma.tbl_usuarios.findUnique({ where: { id: decoded.id }, select: { correo: true } }))?.correo
    );
    if (!usuario || !usuario.activo) {
      return res.status(401).json({ error: 'Usuario no encontrado o inactivo' });
    }

    // Generar nuevos tokens
    const { accessToken, refreshToken: newRefreshToken } = generarTokens(usuario);

    // Guardar nuevo refresh token
    const newRefreshHash = crypto.createHash('sha256').update(newRefreshToken).digest('hex');
    const refreshExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await saveRefreshToken(
      usuario.id,
      newRefreshHash,
      refreshExpiry,
      req.headers['user-agent'] || null,
      req.ip
    );

    res.json({
      token: accessToken,
      refreshToken: newRefreshToken,
    });
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Refresh token invalido o expirado' });
    }
    console.error('Error en refresh token:', error);
    res.status(500).json({ error: 'Error al renovar token' });
  }
};

const logout = async (req, res) => {
  try {
    if (req.user && req.user.id) {
      await revokeRefreshTokensByUser(req.user.id);

      // Desregistrar dispositivo push si se proporciona
      if (req.body?.device_token) {
        await prisma.tbl_dispositivos_push.updateMany({
          where: {
            id_usuario: req.user.id,
            token_dispositivo: req.body.device_token,
          },
          data: { activo: false },
        });
      }
    }
    res.json({ mensaje: 'Sesion cerrada exitosamente' });
  } catch (error) {
    console.error('Error en logout:', error);
    res.status(500).json({ error: 'Error al cerrar sesion' });
  }
};

const getMe = async (req, res) => {
  try {
    const usuario = await findUserById(req.user.id);
    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    res.json({ usuario });
  } catch (error) {
    console.error('Error en getMe:', error);
    res.status(500).json({ error: 'Error al obtener perfil' });
  }
};

const getCurrentTerms = async (req, res) => {
  try {
    const terminos = await prisma.tbl_versiones_terminos.findFirst({
      where: { es_vigente: true },
    });
    if (!terminos) {
      return res.status(404).json({ error: 'No hay terminos vigentes' });
    }
    res.json({ terminos });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener terminos' });
  }
};

const acceptTerms = async (req, res) => {
  const { id_version_terminos } = req.body;
  if (!id_version_terminos) {
    return res.status(400).json({ error: 'id_version_terminos requerido' });
  }

  try {
    const version = await prisma.tbl_versiones_terminos.findFirst({
      where: { id: parseInt(id_version_terminos), es_vigente: true },
    });
    if (!version) {
      return res.status(400).json({ error: 'Version de terminos no vigente' });
    }

    await prisma.tbl_aceptaciones_terminos.upsert({
      where: {
        id_usuario_id_version_terminos: {
          id_usuario: req.user.id,
          id_version_terminos: parseInt(id_version_terminos),
        },
      },
      create: {
        id_usuario: req.user.id,
        id_version_terminos: parseInt(id_version_terminos),
      },
      update: {
        aceptado_en: new Date(),
      },
    });

    res.json({ mensaje: 'Terminos aceptados' });
  } catch (error) {
    console.error('Error aceptando terminos:', error);
    res.status(500).json({ error: 'Error al aceptar terminos' });
  }
};

module.exports = {
  login,
  registerBuyer,
  registerSeller,
  verifyEmail,
  resendEmailCode,
  forgotPassword,
  resetPassword,
  refreshTokenHandler,
  logout,
  getMe,
  getCurrentTerms,
  acceptTerms,
};
