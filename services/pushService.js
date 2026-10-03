const prisma = require('../config/db');
const { getMessaging } = require('../config/firebase');

// Base URL del backend (Railway o local)
const getBaseUrl = () => {
  return process.env.BACKEND_URL
    || (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : null)
    || `http://localhost:${process.env.PORT || 4002}`;
};

// URL del icono para notificaciones push (logo Te Guio)
const getIconUrl = () => `${getBaseUrl()}/uploads/logo.png`;

// Convierte URLs relativas (/api/catalog/files/...) a absolutas para que FCM pueda resolverlas
const resolveAbsoluteUrl = (url) => {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${getBaseUrl()}${url}`;
};

// ── Cache de templates desde BD ────────────────────────────────
// Mapa evento -> { titulo, mensaje, activo }
let templateCache = null;
let cacheLoadedAt = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos

const loadTemplates = async () => {
  try {
    const rows = await prisma.tbl_config_notificaciones_push.findMany({
      select: { evento: true, titulo: true, mensaje: true, activo: true },
    });
    const map = {};
    for (const r of rows) {
      map[r.evento] = { titulo: r.titulo, mensaje: r.mensaje, activo: r.activo };
    }
    templateCache = map;
    cacheLoadedAt = Date.now();
  } catch (error) {
    console.error('[Push] Error cargando templates desde BD:', error.message);
  }
};

const getTemplate = async (eventType) => {
  if (!templateCache || (Date.now() - cacheLoadedAt) > CACHE_TTL_MS) {
    await loadTemplates();
  }
  return templateCache ? templateCache[eventType] : null;
};

const invalidateTemplateCache = () => {
  templateCache = null;
  cacheLoadedAt = 0;
};

// Reemplazar {{variables}} en titulo/mensaje (misma logica que emailService)
const replaceVars = (text, vars) => {
  let result = text;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value != null ? String(value) : '');
  }
  return result;
};

// Serializar valores del data payload (FCM requiere strings)
const serializeDataValue = (v) => {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
};

/**
 * Enviar push notification a un usuario especifico
 */
const sendToUser = async (userId, eventType, extraData = {}) => {
  const messaging = getMessaging();
  if (!messaging) { console.log(`[Push] No messaging instance for event ${eventType}`); return; }

  try {
    // Verificar que el usuario no esté eliminado
    const user = await prisma.tbl_usuarios.findFirst({
      where: { id: userId, eliminado_en: null, activo: true },
      select: { id: true },
    });
    if (!user) { console.log(`[Push] User ${userId} deleted/inactive, skipping ${eventType}`); return; }

    const template = await getTemplate(eventType);

    // Si no hay template en BD o esta desactivado, no enviar
    if (!template) { console.log(`[Push] No template found for event: ${eventType}`); return; }
    if (!template.activo) { console.log(`[Push] Template inactive for event: ${eventType}`); return; }

    const devices = await prisma.tbl_dispositivos_push.findMany({
      where: { id_usuario: userId, activo: true },
      select: { id: true, token_dispositivo: true },
    });

    if (devices.length === 0) { console.log(`[Push] No active devices for user ${userId}, event ${eventType}`); return; }
    console.log(`[Push] Sending ${eventType} to user ${userId} (${devices.length} devices)`);

    const dataPayload = {
      event_type: eventType,
      ...Object.fromEntries(
        Object.entries(extraData).map(([k, v]) => [k, serializeDataValue(v)])
      ),
    };

    const iconUrl = getIconUrl();

    const title = replaceVars(template.titulo, extraData);
    const body = replaceVars(template.mensaje, extraData);

    // Imagen: si hay imagen de producto usa esa, sino vacia (el servicio Android pone el logo)
    const productImageUrl = resolveAbsoluteUrl(extraData.imagen_producto);
    const imageUrl = productImageUrl || '';

    // Mensaje DATA-ONLY para Android: el MyFirebaseMessagingService construye la notificacion
    // con largeIcon (logo Te Guio), BigPicture (imagen producto), etc.
    // Sin campo 'notification' para que SIEMPRE pase por nuestro servicio, incluso en background.
    const results = await Promise.allSettled(
      devices.map(device =>
        messaging.send({
          token: device.token_dispositivo,
          data: {
            ...dataPayload,
            title,
            body,
            image: imageUrl,
          },
          android: {
            priority: 'high',
          },
          // iOS: APNs necesita bloque alert explicito (el mensaje data-only
          // de Android seria una notificacion silenciosa en iPhone)
          apns: {
            payload: {
              aps: {
                alert: { title, body },
                sound: 'default',
                badge: 1,
                'mutable-content': 1,
              },
            },
            ...(imageUrl ? { fcm_options: { image: imageUrl } } : {}),
          },
          webpush: {
            notification: {
              title,
              body,
              icon: iconUrl,
              badge: iconUrl,
              image: imageUrl || iconUrl,
            },
          },
        }).catch(error => {
          error.deviceId = device.id;
          throw error;
        })
      )
    );

    // Recolectar tokens invalidos para desactivar
    const sent = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    console.log(`[Push] ${eventType} → ${sent} enviados, ${failed} fallidos`);
    const tokensToDeactivate = [];
    for (const result of results) {
      if (result.status === 'rejected') {
        const error = result.reason;
        if (
          error.code === 'messaging/registration-token-not-registered' ||
          error.code === 'messaging/invalid-registration-token' ||
          error.code === 'messaging/mismatched-credential' ||
          error.code === 'messaging/sender-id-mismatch' ||
          error.code === 'messaging/invalid-package-name'
        ) {
          tokensToDeactivate.push(error.deviceId);
        } else {
          console.error(`[Push] Error enviando a device ${error.deviceId}:`, error.code || error.message);
        }
      }
    }

    if (tokensToDeactivate.length > 0) {
      await prisma.tbl_dispositivos_push.updateMany({
        where: { id: { in: tokensToDeactivate } },
        data: { activo: false },
      });
      console.log(`[Push] Desactivados ${tokensToDeactivate.length} tokens invalidos`);
    }
  } catch (error) {
    console.error('[Push] Error en sendToUser:', error.message);
  }
};

/**
 * Enviar push notification a multiples usuarios (en paralelo)
 */
const sendToMultipleUsers = async (userIds, eventType, extraData = {}) => {
  await Promise.allSettled(
    userIds.map(userId => sendToUser(userId, eventType, extraData))
  );
};

/**
 * Enviar push notification a todos los usuarios de un rol
 */
const sendToRole = async (roleName, eventType, extraData = {}) => {
  try {
    const users = await prisma.tbl_usuarios.findMany({
      where: {
        tbl_roles: { nombre: roleName },
        activo: true,
        eliminado_en: null,
      },
      select: { id: true },
    });

    if (users.length === 0) return;

    const userIds = users.map(u => u.id);
    await sendToMultipleUsers(userIds, eventType, extraData);
  } catch (error) {
    console.error('[Push] Error en sendToRole:', error.message);
  }
};

/**
 * Sincronizar templates de push con los defaults al arrancar el backend.
 * Crea faltantes, elimina obsoletos e invalida cache.
 */
const syncPushTemplates = async () => {
  const { PUSH_NOTIFICATION_DEFAULTS } = require('../config/pushNotificationDefaults');
  try {
    const expectedEvents = PUSH_NOTIFICATION_DEFAULTS.map(t => t.evento);
    const existing = await prisma.tbl_config_notificaciones_push.findMany({ select: { id: true, evento: true } });
    const existingEvents = existing.map(e => e.evento);

    // Eliminar obsoletos
    const obsolete = existing.filter(e => !expectedEvents.includes(e.evento));
    if (obsolete.length > 0) {
      await prisma.tbl_config_notificaciones_push.deleteMany({ where: { id: { in: obsolete.map(o => o.id) } } });
      console.log(`[Push] Eliminados ${obsolete.length} templates obsoletos: ${obsolete.map(o => o.evento).join(', ')}`);
    }

    // Crear faltantes
    const missing = PUSH_NOTIFICATION_DEFAULTS.filter(t => !existingEvents.includes(t.evento));
    if (missing.length > 0) {
      await prisma.tbl_config_notificaciones_push.createMany({
        data: missing.map(t => ({ ...t, id_usuario_registro: 1 })),
        skipDuplicates: true,
      });
      console.log(`[Push] Creados ${missing.length} templates nuevos: ${missing.map(m => m.evento).join(', ')}`);
    }

    // Actualizar titulo/mensaje de templates existentes para mantenerlos al dia con los defaults
    // (preserva el campo 'activo' para no afectar toggles del admin)
    let updated = 0;
    for (const def of PUSH_NOTIFICATION_DEFAULTS) {
      if (!existingEvents.includes(def.evento)) continue;
      const result = await prisma.tbl_config_notificaciones_push.updateMany({
        where: { evento: def.evento },
        data: { titulo: def.titulo, mensaje: def.mensaje },
      });
      if (result.count > 0) updated++;
    }
    if (updated > 0) console.log(`[Push] Actualizados ${updated} templates con nuevos textos`);

    if (obsolete.length > 0 || missing.length > 0 || updated > 0) {
      invalidateTemplateCache();
    }
    console.log(`[Push] Templates sincronizados (${expectedEvents.length} eventos)`);
  } catch (error) {
    console.error('[Push] Error sincronizando templates:', error.message);
  }
};

module.exports = { sendToUser, sendToMultipleUsers, sendToRole, invalidateTemplateCache, syncPushTemplates };
