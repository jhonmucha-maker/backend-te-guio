const prisma = require('../config/db');

// Cache en memoria con TTL de 60s para evitar hits a BD en cada arranque de app.
// La clave es global porque el endpoint es publico y sin parametros.
let cache = { data: null, expires: 0 };
const CACHE_TTL_MS = 60 * 1000;

const VERSION_KEYS = [
  'android_min_version_code',
  'android_latest_version_code',
  'android_latest_version_name',
  'android_force_update_enabled',
  'android_play_store_url',
  'android_update_title',
  'android_update_message',
];

// Fallback fail-open: nunca bloquea al usuario. Se usa si la BD falla o si
// alguna clave esta ausente.
const SAFE_DEFAULT = {
  android: {
    minVersionCode: 0,
    latestVersionCode: 0,
    latestVersionName: '',
    forceUpdateEnabled: false,
    playStoreUrl: 'https://play.google.com/store/apps/details?id=com.teguio.app',
    updateTitle: 'Actualizacion requerida',
    updateMessage: 'Hay una nueva version disponible. Por favor actualiza desde Play Store.',
  },
};

const getAppVersion = async (req, res) => {
  try {
    if (cache.data && Date.now() < cache.expires) {
      res.set('Cache-Control', 'public, max-age=60');
      return res.json(cache.data);
    }

    const configs = await prisma.tbl_configuracion_sistema.findMany({
      where: { clave: { in: VERSION_KEYS } },
    });

    const map = configs.reduce((acc, c) => {
      acc[c.clave] = c.valor;
      return acc;
    }, {});

    const minCode = parseInt(map.android_min_version_code, 10);
    const latestCode = parseInt(map.android_latest_version_code, 10);

    const response = {
      android: {
        minVersionCode: Number.isFinite(minCode) ? minCode : 0,
        latestVersionCode: Number.isFinite(latestCode) ? latestCode : 0,
        latestVersionName: map.android_latest_version_name || '',
        forceUpdateEnabled: map.android_force_update_enabled === 'true',
        playStoreUrl: map.android_play_store_url || SAFE_DEFAULT.android.playStoreUrl,
        updateTitle: map.android_update_title || SAFE_DEFAULT.android.updateTitle,
        updateMessage: map.android_update_message || SAFE_DEFAULT.android.updateMessage,
      },
    };

    cache = { data: response, expires: Date.now() + CACHE_TTL_MS };
    res.set('Cache-Control', 'public, max-age=60');
    return res.json(response);
  } catch (err) {
    console.error('[version] Error consultando configuracion:', err);
    // Fail-open: devolvemos defaults seguros con 200 para que la app no bloquee.
    return res.status(200).json(SAFE_DEFAULT);
  }
};

// Permite invalidar el cache manualmente (util si el admin acaba de cambiar
// la configuracion y quiere efecto inmediato). No expuesto via HTTP por ahora.
const invalidateVersionCache = () => {
  cache = { data: null, expires: 0 };
};

module.exports = { getAppVersion, invalidateVersionCache };
