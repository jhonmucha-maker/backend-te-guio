// Nombres de eventos SSE centralizados
// Frontend-web debe usar los mismos valores en SSE_EVENTS (utils/constants.js)

module.exports = {
  // Eventos admin (emitidos via role_event a ADMINISTRADOR)
  ADMIN_PENDING_STORE: 'admin.pending.store',
  ADMIN_PENDING_PRODUCT: 'admin.pending.product',
  ADMIN_PENDING_SUBSCRIPTION: 'admin.pending.subscription',

  // Eventos de tickets (emitidos via user_event)
  TICKET_CREATED: 'ticket.created',
  TICKET_MESSAGE_CREATED: 'ticket.message.created',
  TICKET_STATUS_UPDATED: 'ticket.status.updated',

  // Eventos de suscripcion
  SUBSCRIPTION_REQUEST_UPDATED: 'subscription.request.updated',
  SUBSCRIPTION_ACTIVE_UPDATED: 'subscription.active.updated',
  SUBSCRIPTION_EXPIRING: 'subscription.expiring',

  // Eventos de comprador
  FAVORITES_UPDATED: 'favorites.updated',
  SHOPPING_LIST_UPDATED: 'shopping_list.updated',
  PRODUCT_PRICE_CHANGED: 'product.price.changed',

  // Eventos de calificacion
  RATING_PRODUCT_NEW: 'rating.product.new',
  RATING_STORE_NEW: 'rating.store.new',

  // Eventos de cuenta (emitidos via user_event)
  ACCOUNT_DISABLED: 'account.disabled',

  // Eventos de vendedor (dinamico: approval.{entityType}.updated)
  APPROVAL_UPDATED_PREFIX: 'approval',
};
