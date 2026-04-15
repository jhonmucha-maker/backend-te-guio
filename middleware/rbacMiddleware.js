const { ROLES } = require('../config/constants');

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !req.user.rol) {
      return res.status(403).json({ error: 'Acceso denegado: rol no encontrado' });
    }
    if (!roles.includes(req.user.rol)) {
      return res.status(403).json({ error: 'Acceso denegado: rol insuficiente' });
    }
    next();
  };
}

function requirePermission(...codigos) {
  return (req, res, next) => {
    if (!req.user || !req.user.permisos) {
      return res.status(403).json({ error: 'Acceso denegado: permisos no encontrados' });
    }
    const userPermisos = req.user.permisos.map(p => p.codigo);
    const hasPermission = codigos.some(c => userPermisos.includes(c));
    if (!hasPermission) {
      return res.status(403).json({ error: 'Acceso denegado: permiso insuficiente' });
    }
    next();
  };
}

module.exports = { requireRole, requirePermission };
