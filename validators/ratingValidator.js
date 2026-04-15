const validateRating = (req, res, next) => {
  const { estrellas } = req.body;

  if (!estrellas || isNaN(estrellas) || parseInt(estrellas) < 1 || parseInt(estrellas) > 5) {
    return res.status(400).json({ error: 'Estrellas debe ser un numero entre 1 y 5' });
  }

  req.body.estrellas = parseInt(estrellas);
  next();
};

module.exports = { validateRating };
