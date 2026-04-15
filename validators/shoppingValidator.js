const validateAddItem = (req, res, next) => {
  const { tipo, product_id, texto_manual, zone_id, gallery_id } = req.body;

  if (tipo === 'MANUAL') {
    if (!texto_manual || texto_manual.trim().length < 1) {
      return res.status(400).json({ error: 'Texto manual es requerido para items manuales' });
    }
  } else {
    if (!product_id) {
      return res.status(400).json({ error: 'product_id es requerido para items de producto' });
    }
  }

  if (req.body.cantidad !== undefined && (isNaN(req.body.cantidad) || parseInt(req.body.cantidad) < 1)) {
    return res.status(400).json({ error: 'Cantidad debe ser al menos 1' });
  }

  next();
};

module.exports = { validateAddItem };
