const PHONE_REGEX = /^\+?[\d\s()-]{7,20}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const validateRegisterBuyer = (req, res, next) => {
  const { nombre, correo, contrasena, telefono } = req.body;
  const errors = [];

  if (!nombre || nombre.trim().length < 2) errors.push('Nombre debe tener al menos 2 caracteres');
  if (!correo || !EMAIL_REGEX.test(correo)) errors.push('Correo no valido');
  if (!contrasena) errors.push('Contrasena es requerida');
  if (telefono && !PHONE_REGEX.test(telefono)) errors.push('Formato de telefono no valido');

  if (errors.length > 0) return res.status(400).json({ error: errors.join('. ') });
  next();
};

const validateRegisterSeller = (req, res, next) => {
  const { nombre, correo, contrasena, telefono } = req.body;
  const errors = [];

  if (!nombre || nombre.trim().length < 2) errors.push('Nombre debe tener al menos 2 caracteres');
  if (!correo || !EMAIL_REGEX.test(correo)) errors.push('Correo no valido');
  if (!contrasena) errors.push('Contrasena es requerida');
  if (telefono && !PHONE_REGEX.test(telefono)) errors.push('Formato de telefono no valido');

  if (errors.length > 0) return res.status(400).json({ error: errors.join('. ') });
  next();
};

const validateLogin = (req, res, next) => {
  const { correo, contrasena } = req.body;
  if (!correo || !contrasena) {
    return res.status(400).json({ error: 'Correo y contrasena son requeridos' });
  }
  if (!EMAIL_REGEX.test(correo)) {
    return res.status(400).json({ error: 'Formato de correo no valido' });
  }
  next();
};

const validateVerifyEmail = (req, res, next) => {
  const { correo, codigo } = req.body;
  if (!correo || !codigo) return res.status(400).json({ error: 'Correo y codigo son requeridos' });
  if (codigo.length !== 6) return res.status(400).json({ error: 'Codigo debe tener 6 digitos' });
  next();
};

const validateResetPassword = (req, res, next) => {
  const { token, nueva_contrasena } = req.body;
  if (!token || !nueva_contrasena) return res.status(400).json({ error: 'Token y nueva contrasena son requeridos' });
  next();
};

module.exports = { validateRegisterBuyer, validateRegisterSeller, validateLogin, validateVerifyEmail, validateResetPassword };
