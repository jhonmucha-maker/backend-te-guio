// Servicio centralizado de notificaciones
// Emite eventos a SSE y envia push notifications via FCM
const EventEmitter = require('events');
const prisma = require('../config/db');
const { sendToUser: pushToUser, sendToRole: pushToRole } = require('./pushService');
const {
  FAVORITES_UPDATED,
  SHOPPING_LIST_UPDATED,
  TICKET_MESSAGE_CREATED,
  TICKET_STATUS_UPDATED,
  SUBSCRIPTION_REQUEST_UPDATED,
  SUBSCRIPTION_ACTIVE_UPDATED,
  PRODUCT_PRICE_CHANGED,
  TICKET_CREATED,
  ADMIN_PENDING_SELLER,
  ADMIN_PENDING_STORE,
  ADMIN_PENDING_PRODUCT,
  ADMIN_PENDING_SUBSCRIPTION,
  SUBSCRIPTION_EXPIRING,
  APPROVAL_UPDATED_PREFIX,
  RATING_PRODUCT_NEW,
  RATING_STORE_NEW,
} = require('../config/eventNames');

class NotificationService extends EventEmitter {
  emitToUser(userId, event, data) {
    this.emit('user_event', { userId, event, data, ts_utc: new Date().toISOString() });
    // Enviar push notification en paralelo (no bloquea SSE)
    pushToUser(userId, event, data).catch(err => console.error(`[Push] Error emitToUser(${userId}, ${event}):`, err.message || err));
  }

  // Solo emitir SSE sin push (para acciones propias del usuario que no necesitan notificación)
  emitSSEOnly(userId, event, data) {
    this.emit('user_event', { userId, event, data, ts_utc: new Date().toISOString() });
  }

  emitToRole(role, event, data) {
    this.emit('role_event', { role, event, data, ts_utc: new Date().toISOString() });
    // Enviar push a todos los usuarios del rol
    pushToRole(role, event, data).catch(err => console.error(`[Push] Error emitToRole(${role}, ${event}):`, err.message || err));
  }

  // Emitir solo SSE a un rol sin push (para backup de entrega SSE a admins)
  emitSSEToRole(role, event, data) {
    this.emit('role_event', { role, event, data, ts_utc: new Date().toISOString() });
  }

  // Eventos de acciones propias del usuario (solo SSE para refrescar UI, sin push)
  favoritesUpdated(userId) {
    this.emitSSEOnly(userId, FAVORITES_UPDATED, {});
  }

  shoppingListUpdated(userId) {
    this.emitSSEOnly(userId, SHOPPING_LIST_UPDATED, {});
  }

  ticketMessageCreated(ticketId, participantIds, authorId) {
    participantIds.forEach(uid => {
      if (uid !== authorId) {
        this.emitToUser(uid, TICKET_MESSAGE_CREATED, { ticket_id: ticketId });
      }
    });
    // Backup SSE para admins via role_event (despacho fiable por iteración)
    this.emitSSEToRole('ADMINISTRADOR', TICKET_MESSAGE_CREATED, { ticket_id: ticketId });
  }

  ticketStatusUpdated(ticketId, participantIds, newStatus) {
    participantIds.forEach(uid => {
      this.emitToUser(uid, TICKET_STATUS_UPDATED, { ticket_id: ticketId, status: newStatus });
    });
    // Backup SSE para admins via role_event (despacho fiable por iteración)
    this.emitSSEToRole('ADMINISTRADOR', TICKET_STATUS_UPDATED, { ticket_id: ticketId, status: newStatus });
  }

  approvalUpdated(sellerId, entityType, entityId, status, extraData = {}) {
    let suffix = 'updated';
    if (status === 'APROBADO') suffix = 'approved';
    else if (status === 'RECHAZADO') suffix = 'rejected';
    this.emitToUser(sellerId, `${APPROVAL_UPDATED_PREFIX}.${entityType}.${suffix}`, { id: entityId, status, ...extraData });

    // Notificar a admins para que el sidebar refresque los contadores de pendientes
    const adminEventMap = {
      seller: ADMIN_PENDING_SELLER,
      store: ADMIN_PENDING_STORE,
      product: ADMIN_PENDING_PRODUCT,
    };
    const adminEvent = adminEventMap[entityType];
    if (adminEvent) {
      this.emitSSEToRole('ADMINISTRADOR', adminEvent, { id: entityId, status, ...extraData });
    }
  }

  subscriptionRequestUpdated(sellerId, requestId, status, extraData = {}) {
    this.emitToUser(sellerId, SUBSCRIPTION_REQUEST_UPDATED, { id: requestId, status, ...extraData });
    this.emitToRole('ADMINISTRADOR', SUBSCRIPTION_REQUEST_UPDATED, { id: requestId, status, ...extraData });
  }

  subscriptionActiveUpdated(sellerId, storeId, status, extraData = {}) {
    this.emitToUser(sellerId, SUBSCRIPTION_ACTIVE_UPDATED, { store_id: storeId, status, ...extraData });
  }

  productPriceChanged(productId, buyerIds, extraData = {}) {
    buyerIds.forEach(uid => {
      this.emitToUser(uid, PRODUCT_PRICE_CHANGED, { product_id: productId, ...extraData });
    });
  }

  ticketCreated(ticketId, targetUserIds) {
    targetUserIds.forEach(uid => {
      this.emitToUser(uid, TICKET_CREATED, { ticket_id: ticketId });
    });
    // Backup SSE para admins via role_event (despacho fiable por iteración)
    this.emitSSEToRole('ADMINISTRADOR', TICKET_CREATED, { ticket_id: ticketId });
  }

  newPendingApproval(entityType, extraData = {}) {
    const eventMap = {
      seller: ADMIN_PENDING_SELLER,
      store: ADMIN_PENDING_STORE,
      product: ADMIN_PENDING_PRODUCT,
      subscription: ADMIN_PENDING_SUBSCRIPTION,
    };
    const event = eventMap[entityType];
    if (event) {
      this.emitToRole('ADMINISTRADOR', event, extraData);
    }
  }

  subscriptionExpiring(sellerId, tiendas) {
    this.emitToUser(sellerId, SUBSCRIPTION_EXPIRING, { tiendas });
  }

  ratingProductNew(sellerId, productId) {
    this.emitToUser(sellerId, RATING_PRODUCT_NEW, { id_producto: productId });
  }

  ratingStoreNew(sellerId, storeId) {
    this.emitToUser(sellerId, RATING_STORE_NEW, { id_tienda: storeId });
  }

  // Notifica via SSE (sin push) a todos los compradores que tengan la tienda en favoritos
  // o productos de la tienda en su lista de compras abierta. Sirve para que el frontend
  // refresque al instante cuando admin desactiva/activa una tienda.
  async notifyBuyersStoreVisibilityChanged(storeId) {
    try {
      const id_tienda = parseInt(storeId);
      if (!id_tienda) return;

      const [favStoreRows, favProdRows, listRows] = await Promise.all([
        prisma.tbl_favoritos_tiendas.findMany({
          where: { id_tienda },
          select: { id_comprador: true },
        }),
        prisma.tbl_favoritos_productos.findMany({
          where: { tbl_productos: { id_tienda } },
          select: { id_comprador: true },
        }),
        prisma.tbl_listas_compras.findMany({
          where: {
            estado: 'OPEN',
            items: {
              some: {
                OR: [
                  { snapshot_id_tienda: id_tienda },
                  { tbl_productos: { id_tienda } },
                ],
              },
            },
          },
          select: { id_comprador: true },
        }),
      ]);

      const favoritosBuyers = new Set([
        ...favStoreRows.map(r => r.id_comprador),
        ...favProdRows.map(r => r.id_comprador),
      ]);
      const listaBuyers = new Set(listRows.map(r => r.id_comprador));

      favoritosBuyers.forEach(uid => this.emitSSEOnly(uid, FAVORITES_UPDATED, { id_tienda }));
      listaBuyers.forEach(uid => this.emitSSEOnly(uid, SHOPPING_LIST_UPDATED, { id_tienda }));
    } catch (err) {
      console.error('[notifyBuyersStoreVisibilityChanged] Error:', err);
    }
  }
}

const notificationService = new NotificationService();
module.exports = notificationService;
