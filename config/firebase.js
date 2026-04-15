const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

let firebaseApp = null;

const initFirebase = () => {
  if (firebaseApp) return firebaseApp;

  let serviceAccount = null;

  // Opcion 1: archivo local (desarrollo)
  const serviceAccountPath = path.join(__dirname, 'firebase-service-account.json');
  if (fs.existsSync(serviceAccountPath)) {
    serviceAccount = require(serviceAccountPath);
  }

  // Opcion 2: variable de entorno (produccion/Railway)
  if (!serviceAccount && process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
      serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    } catch (e) {
      console.error('[Firebase] Error parseando FIREBASE_SERVICE_ACCOUNT:', e.message);
    }
  }

  if (!serviceAccount) {
    console.warn(
      '[Firebase] No se encontro firebase-service-account.json ni FIREBASE_SERVICE_ACCOUNT env var. ' +
      'Las push notifications NO funcionaran hasta que se configure.'
    );
    return null;
  }

  try {
    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log('[Firebase] Inicializado correctamente');
    return firebaseApp;
  } catch (error) {
    console.error('[Firebase] Error al inicializar:', error.message);
    return null;
  }
};

const getMessaging = () => {
  const app = initFirebase();
  if (!app) return null;
  return admin.messaging();
};

module.exports = { initFirebase, getMessaging };
