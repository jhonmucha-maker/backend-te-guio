const validateCreateTicket = (req, res, next) => {
  const { tipo, objetivo, asunto, mensaje } = req.body;
  const errors = [];

  if (!tipo || !['COMPLAINT', 'SUGGESTION'].includes(tipo)) {
    errors.push('Tipo debe ser COMPLAINT o SUGGESTION');
  }
  if (!objetivo || !['ADMIN', 'STORE'].includes(objetivo)) {
    errors.push('Objetivo debe ser ADMIN o STORE');
  }
  if (objetivo === 'STORE' && !req.body.id_tienda) {
    errors.push('id_tienda es requerido cuando objetivo es STORE');
  }
  if (!asunto || asunto.trim().length < 3) {
    errors.push('Asunto es requerido (min 3 caracteres)');
  }
  if (!mensaje || mensaje.trim().length < 5) {
    errors.push('Mensaje es requerido (min 5 caracteres)');
  }

  if (errors.length > 0) return res.status(400).json({ error: errors.join('. ') });
  next();
};

const validateSendMessage = (req, res, next) => {
  const { cuerpo } = req.body;
  if (!cuerpo || cuerpo.trim().length < 1) {
    return res.status(400).json({ error: 'Mensaje no puede estar vacio' });
  }
  next();
};

module.exports = { validateCreateTicket, validateSendMessage };
