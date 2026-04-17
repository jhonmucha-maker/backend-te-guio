const jwt = require('jsonwebtoken');
const prisma = require('../config/db');
const { AUTH_ERROR_CODES, AUTH_MESSAGES } = require('../config/constants');

async function verificarToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token no proporcionado' });
  }

  const token = authHeader.split(' ')[1];

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ error: 'Token invalido o expirado' });
  }

  // Verificar que el usuario sigue activo en BD
  try {
    const user = await prisma.tbl_usuarios.findUnique({
      where: { id: payload.id },
      select: { activo: true, eliminado_en: true },
    });

    if (!user || !user.activo || user.eliminado_en) {
      return res.status(403).json({
        error: AUTH_ERROR_CODES.ACCOUNT_DISABLED,
        message: AUTH_MESSAGES.ACCOUNT_DISABLED,
      });
    }
  } catch (err) {
    return res.status(500).json({ error: 'Error al verificar estado de cuenta' });
  }

  req.user = payload;
  next();
}

module.exports = verificarToken;
