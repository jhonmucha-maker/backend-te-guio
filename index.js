const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

// Forzar timezone America/Lima
process.env.TZ = 'America/Lima';

const authRoutes = require('./routes/authRoutes');
const catalogRoutes = require('./routes/catalogRoutes');
const marketplaceRoutes = require('./routes/marketplaceRoutes');
const buyerRoutes = require('./routes/buyerRoutes');
const ticketRoutes = require('./routes/ticketRoutes');
const sellerRoutes = require('./routes/sellerRoutes');
const adminRoutes = require('./routes/adminRoutes');
const { setupSSE } = require('./services/sseService');
const { scheduleDailyJob } = require('./services/cronService');
const { initFirebase } = require('./config/firebase');
const { syncPushTemplates } = require('./services/pushService');

const app = express();
const PORT = process.env.PORT || 4002;

// Middleware
const allowedOrigins = [
  process.env.FRONTEND_URL,
  process.env.FRONTEND_WEB_URL,
  ...(process.env.CORS_EXTRA_ORIGINS ? process.env.CORS_EXTRA_ORIGINS.split(',') : []),
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Permitir requests sin origin (mobile apps, curl, server-to-server)
    if (!origin) return callback(null, true);
    // Permitir cualquier localhost en desarrollo (cualquier puerto)
    if (origin.match(/^https?:\/\/localhost(:\d+)?$/) || origin === 'capacitor://localhost') {
      return callback(null, true);
    }
    // Permitir orígenes configurados en variables de entorno
    if (allowedOrigins.some((allowed) => origin === allowed)) {
      return callback(null, true);
    }
    console.error(`[CORS BLOCKED] origin=${origin}`);
    callback(new Error(`Origin ${origin} not allowed by CORS`));
  },
  credentials: true,
}));
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Logger para peticiones de auth (diagnostico)
app.use('/api/auth', (req, res, next) => {
  console.log(`[AUTH] ${req.method} ${req.originalUrl} origin=${req.headers.origin || 'none'} ua=${(req.headers['user-agent'] || '').substring(0, 80)}`);
  next();
});

// Archivos estaticos (uploads)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// SSE (Server-Sent Events)
setupSSE(app);

// Rutas
app.use('/api/auth', authRoutes);
app.use('/api/catalog', catalogRoutes);
app.use('/api/marketplace', marketplaceRoutes);
app.use('/api/me', buyerRoutes);
app.use('/api/me', ticketRoutes);
app.use('/api', ticketRoutes);        // tambien en /api/tickets para acceso admin
app.use('/api/seller', sellerRoutes);
app.use('/api/admin', adminRoutes);

// Ruta de salud
app.get('/api/ping', (req, res) => {
  const now = new Date();
  res.json({
    status: 'ok',
    server_time_utc: now.toISOString(),
    server_time_lima: now.toLocaleString('es-PE', { timeZone: 'America/Lima' }),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  });
});

// Manejo de errores global
app.use((err, req, res, next) => {
  console.error('Error no manejado:', err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor Marketplace corriendo en http://localhost:${PORT}`);
  console.log(`Timezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`);

  // Inicializar Firebase para push notifications
  const fbApp = initFirebase();
  console.log(`[Push] Firebase: ${fbApp ? 'OK' : 'FALLO — push deshabilitado'}`);
  console.log(`[Push] BACKEND_URL=${process.env.BACKEND_URL || '(no definido)'}`);
  console.log(`[Push] RAILWAY_PUBLIC_DOMAIN=${process.env.RAILWAY_PUBLIC_DOMAIN || '(no definido)'}`);
  console.log(`[Push] FIREBASE_SERVICE_ACCOUNT=${process.env.FIREBASE_SERVICE_ACCOUNT ? 'configurado (' + process.env.FIREBASE_SERVICE_ACCOUNT.substring(0, 30) + '...)' : '(no definido)'}`);

  // Sincronizar templates de push (crear faltantes, eliminar obsoletos)
  syncPushTemplates();

  // Iniciar cron job diario (9:00 AM Peru)
  scheduleDailyJob();
});
