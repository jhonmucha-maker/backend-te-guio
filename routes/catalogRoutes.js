const express = require('express');
const router = express.Router();
const { getCities, getZones, getGalleries, getCategories, getPlans, getPaymentMethods, getFaqs, getCurrentPrivacy } = require('../controllers/catalogController');
const { getCurrentTerms, acceptTerms } = require('../controllers/authController');
const verificarToken = require('../middleware/authMiddleware');

// Proxy publico para servir archivos de S3 (la cuenta Wasabi bloquea acceso publico directo)
router.get('/files/{*key}', async (req, res) => {
  try {
    const rawKey = req.params.key;
    // Express 5 {*key} returns an array of path segments; join them back
    const key = Array.isArray(rawKey) ? rawKey.join('/') : rawKey;
    if (!key) return res.status(400).json({ error: 'Key requerido' });

    const { getFromS3 } = require('../config/s3');
    const s3Response = await getFromS3(key);

    res.set('Content-Type', s3Response.ContentType || 'application/octet-stream');
    if (s3Response.ContentLength) res.set('Content-Length', s3Response.ContentLength);
    res.set('Cache-Control', 'public, max-age=86400');

    s3Response.Body.pipe(res);
  } catch (err) {
    if (err.name === 'NoSuchKey' || err.$metadata?.httpStatusCode === 404) {
      return res.status(404).json({ error: 'Archivo no encontrado' });
    }
    console.error('Error sirviendo archivo S3:', err);
    res.status(500).json({ error: 'Error al obtener archivo' });
  }
});

router.get('/cities', getCities);
router.get('/zones', getZones);
router.get('/zones/:id_ciudad', getZones);
router.get('/galleries', getGalleries);
router.get('/galleries/:id_zona', getGalleries);
router.get('/categories', getCategories);
router.get('/plans', getPlans);
router.get('/payment-methods', getPaymentMethods);
router.get('/faqs', getFaqs);
router.get('/terms/current', getCurrentTerms);
router.get('/privacy/current', getCurrentPrivacy);
router.post('/terms/accept', verificarToken, acceptTerms);

module.exports = router;
