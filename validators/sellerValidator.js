const validateCreateStore = (req, res, next) => {
  const { nombre, id_galeria } = req.body;
  const errors = [];

  if (!nombre || nombre.trim().length < 2) errors.push('Nombre de tienda es requerido (min 2 caracteres)');
  if (!id_galeria) errors.push('Galeria es requerida');
  if (req.body.latitud && (isNaN(req.body.latitud) || req.body.latitud < -90 || req.body.latitud > 90)) {
    errors.push('Latitud debe estar entre -90 y 90');
  }
  if (req.body.longitud && (isNaN(req.body.longitud) || req.body.longitud < -180 || req.body.longitud > 180)) {
    errors.push('Longitud debe estar entre -180 y 180');
  }

  if (errors.length > 0) return res.status(400).json({ error: errors.join('. ') });
  next();
};

const validateCreateProduct = (req, res, next) => {
  const { id_tienda, id_categoria, nombre, precio } = req.body;
  const errors = [];

  if (!id_tienda) errors.push('Tienda es requerida');
  if (!id_categoria) errors.push('Categoria es requerida');
  if (!nombre || nombre.trim().length < 2) errors.push('Nombre de producto es requerido (min 2 caracteres)');
  if (precio === undefined || precio === null) errors.push('Precio es requerido');
  if (precio !== undefined && (isNaN(precio) || parseFloat(precio) < 0)) errors.push('Precio debe ser un numero positivo');

  if (errors.length > 0) return res.status(400).json({ error: errors.join('. ') });
  next();
};

const validateUpdatePrice = (req, res, next) => {
  const { precio } = req.body;
  if (precio === undefined || isNaN(precio) || parseFloat(precio) < 0) {
    return res.status(400).json({ error: 'Precio valido requerido (numero positivo)' });
  }
  next();
};

module.exports = { validateCreateStore, validateCreateProduct, validateUpdatePrice };
