const prisma = require('../config/db');
const { TIMEZONE } = require('../config/constants');
const { sendSubscriptionExpiringEmail } = require('./emailService');
const notificationService = require('./notificationService');

// Marcar suscripciones expiradas
const markExpiredSubscriptions = async () => {
  const now = new Date();
  const result = await prisma.tbl_suscripciones_activas.updateMany({
    where: { estado: 'ACTIVE', fin_en: { lte: now } },
    data: { estado: 'EXPIRED' },
  });
  if (result.count > 0) {
    console.log(`[CRON] ${result.count} suscripciones marcadas como expiradas`);
  }
};

// Enviar alertas de vencimiento proximo
const sendExpiringAlerts = async () => {
  const now = new Date();

  // Leer dias de alerta desde BD
  const config = await prisma.tbl_configuracion_sistema.findFirst({
    where: { clave: 'dias_alerta_vencimiento_suscripcion' },
  });
  const alertDays = parseInt(config?.valor) || 7;
  const alertDate = new Date(now.getTime() + alertDays * 24 * 60 * 60 * 1000);

  // Obtener dia actual en TZ Peru para evitar duplicados
  const peruNow = new Date(now.toLocaleString('en-US', { timeZone: TIMEZONE }));
  const todayStr = `${peruNow.getFullYear()}-${String(peruNow.getMonth() + 1).padStart(2, '0')}-${String(peruNow.getDate()).padStart(2, '0')}`;
  const todayDate = new Date(todayStr);

  const suscripcionesProximas = await prisma.tbl_suscripciones_activas.findMany({
    where: {
      estado: 'ACTIVE',
      fin_en: { lte: alertDate, gt: now },
      tbl_tiendas: {
        eliminado_en: null,
        tbl_usuarios: { eliminado_en: null, activo: true },
      },
    },
    include: {
      tbl_tiendas: {
        select: {
          id: true,
          nombre: true,
          id_vendedor: true,
          tbl_usuarios: { select: { id: true, nombre: true, correo: true } },
        },
      },
    },
  });

  // Agrupar por vendedor
  const byVendedor = {};
  for (const sub of suscripcionesProximas) {
    const vendedor = sub.tbl_tiendas.tbl_usuarios;
    if (!byVendedor[vendedor.id]) {
      byVendedor[vendedor.id] = { vendedor, tiendas: [] };
    }
    byVendedor[vendedor.id].tiendas.push({ nombre: sub.tbl_tiendas.nombre, fin_en: sub.fin_en });
  }

  for (const [vendedorId, { vendedor, tiendas }] of Object.entries(byVendedor)) {
    // Verificar si ya se envio email hoy
    const yaEnviado = await prisma.tbl_log_envio_email.findFirst({
      where: {
        id_vendedor: parseInt(vendedorId),
        tipo: 'SUBSCRIPTION_EXPIRING',
        fecha_envio: todayDate,
      },
    });

    if (!yaEnviado) {
      await sendSubscriptionExpiringEmail(vendedor.correo, vendedor.nombre, tiendas);

      await prisma.tbl_log_envio_email.create({
        data: {
          tipo: 'SUBSCRIPTION_EXPIRING',
          id_vendedor: parseInt(vendedorId),
          fecha_envio: todayDate,
        },
      });
      console.log(`[CRON] Alerta de vencimiento enviada a ${vendedor.correo}`);
    }

    // Notificacion in-app (SSE) - siempre, independiente del email
    notificationService.subscriptionExpiring(parseInt(vendedorId), tiendas);
  }
};

// Job principal ejecutado periodicamente
const runDailyJob = async () => {
  console.log(`[CRON] Ejecutando job diario - ${new Date().toLocaleString('es-PE', { timeZone: TIMEZONE })}`);
  try {
    await markExpiredSubscriptions();
    await sendExpiringAlerts();
  } catch (error) {
    console.error('[CRON] Error en job diario:', error);
  }
};

// Programar ejecucion diaria a las 9:00 AM Peru
const scheduleDailyJob = () => {
  const calcNextRun = () => {
    const now = new Date();
    const peruNow = new Date(now.toLocaleString('en-US', { timeZone: TIMEZONE }));
    const target = new Date(peruNow);
    target.setHours(9, 0, 0, 0);

    if (peruNow >= target) {
      target.setDate(target.getDate() + 1);
    }

    // Convertir de vuelta a UTC
    const diffMs = target.getTime() - peruNow.getTime();
    return diffMs;
  };

  const scheduleNext = () => {
    const msUntilNext = calcNextRun();
    console.log(`[CRON] Proximo job en ${Math.round(msUntilNext / 60000)} minutos`);
    setTimeout(async () => {
      await runDailyJob();
      scheduleNext();
    }, msUntilNext);
  };

  scheduleNext();
};

module.exports = { runDailyJob, scheduleDailyJob, markExpiredSubscriptions };
