// Defaults de notificaciones push — Te Guio Marketplace
// Se usan para seed inicial y para el reset desde admin.
// El pushService lee de BD, NUNCA de este archivo en runtime.
// Los templates soportan {{variables}} que se reemplazan con datos reales.

const PUSH_NOTIFICATION_DEFAULTS = [
  { evento: 'favorites.updated', titulo: 'Favoritos actualizados', mensaje: 'Tu lista de favoritos ha sido actualizada.', rol_destinatario: null },
  { evento: 'shopping_list.updated', titulo: 'Lista de compras', mensaje: 'Tu lista de compras ha sido actualizada.', rol_destinatario: null },
  { evento: 'ticket.message.created', titulo: 'Nuevo mensaje', mensaje: 'Tienes un nuevo mensaje en tu ticket de soporte.', rol_destinatario: null },
  { evento: 'ticket.status.updated', titulo: 'Ticket actualizado', mensaje: 'El estado de tu ticket ha cambiado.', rol_destinatario: null },
  { evento: 'ticket.created', titulo: 'Nuevo ticket', mensaje: 'Se ha creado un nuevo ticket de soporte.', rol_destinatario: null },
  { evento: 'approval.store.approved', titulo: 'Tienda aprobada', mensaje: 'Tu tienda "{{nombre_tienda}}" ha sido aprobada.', rol_destinatario: null },
  { evento: 'approval.store.rejected', titulo: 'Tienda rechazada', mensaje: 'Tu tienda "{{nombre_tienda}}" ha sido rechazada. {{motivo}}', rol_destinatario: null },
  { evento: 'approval.store.updated', titulo: 'Tienda: {{nombre_tienda}}', mensaje: 'Tu tienda "{{nombre_tienda}}" ha sido {{estado}}.', rol_destinatario: null },
  { evento: 'approval.product.approved', titulo: 'Producto aprobado', mensaje: 'Tu producto "{{nombre_producto}}" de "{{nombre_tienda}}" ha sido aprobado.', rol_destinatario: null },
  { evento: 'approval.product.rejected', titulo: 'Producto rechazado', mensaje: 'Tu producto "{{nombre_producto}}" de "{{nombre_tienda}}" ha sido rechazado.', rol_destinatario: null },
  { evento: 'approval.product.updated', titulo: 'Producto: {{nombre_producto}}', mensaje: 'Tu producto "{{nombre_producto}}" de "{{nombre_tienda}}" ha sido {{estado}}.', rol_destinatario: null },
  { evento: 'subscription.request.updated', titulo: 'Suscripcion {{estado}}', mensaje: '{{nombre_vendedor}}, la suscripcion "{{nombre_plan}}" para "{{nombre_tienda}}" ha sido {{estado}}.', rol_destinatario: null },
  { evento: 'subscription.active.updated', titulo: 'Suscripcion activada', mensaje: '{{nombre_vendedor}}, tu plan "{{nombre_plan}}" ({{precio_plan}}) esta activo para "{{nombre_tienda}}".', rol_destinatario: null },
  { evento: 'subscription.expiring', titulo: 'Suscripcion por vencer', mensaje: 'Una o mas de tus suscripciones estan proximas a vencer.', rol_destinatario: null },
  { evento: 'product.price.changed', titulo: 'Precio actualizado', mensaje: '"{{nombre_producto}}" cambió de S/ {{precio_anterior}} a S/ {{precio_nuevo}}.', rol_destinatario: null },
  { evento: 'admin.pending.store', titulo: 'Nueva tienda', mensaje: 'La tienda "{{nombre_tienda}}" solicita aprobacion.', rol_destinatario: 'ADMINISTRADOR' },
  { evento: 'admin.pending.product', titulo: 'Nuevo producto', mensaje: 'El producto "{{nombre_producto}}" de la tienda "{{nombre_tienda}}" solicita aprobacion.', rol_destinatario: 'ADMINISTRADOR' },
  { evento: 'admin.pending.subscription', titulo: 'Nueva suscripcion', mensaje: '"{{nombre_vendedor}}" solicita la suscripcion "{{nombre_plan}}" para "{{nombre_tienda}}".', rol_destinatario: 'ADMINISTRADOR' },
  { evento: 'rating.product.new', titulo: 'Nueva calificacion', mensaje: 'Tu producto ha recibido una nueva calificacion.', rol_destinatario: null },
  { evento: 'rating.store.new', titulo: 'Nueva calificacion', mensaje: 'Tu tienda ha recibido una nueva calificacion.', rol_destinatario: null },
];

// Variables disponibles por evento (para el admin UI)
const PUSH_VARIABLE_MAP = {
  'favorites.updated':             [],
  'shopping_list.updated':         [],
  'ticket.message.created':        ['ticket_id'],
  'ticket.status.updated':         ['ticket_id', 'status'],
  'ticket.created':                ['ticket_id'],
  'approval.store.approved':       ['nombre_tienda', 'nombre_vendedor'],
  'approval.store.rejected':       ['nombre_tienda', 'nombre_vendedor', 'motivo'],
  'approval.store.updated':        ['nombre_tienda', 'nombre_vendedor', 'estado'],
  'approval.product.approved':     ['nombre_producto', 'nombre_tienda'],
  'approval.product.rejected':     ['nombre_producto', 'nombre_tienda'],
  'approval.product.updated':      ['nombre_producto', 'nombre_tienda', 'estado'],
  'subscription.request.updated':  ['nombre_vendedor', 'nombre_tienda', 'nombre_plan', 'precio_plan', 'duracion_plan', 'estado'],
  'subscription.active.updated':   ['nombre_vendedor', 'nombre_tienda', 'nombre_plan', 'precio_plan', 'duracion_plan', 'estado'],
  'subscription.expiring':         [],
  'product.price.changed':         ['product_id', 'nombre_producto', 'precio_anterior', 'precio_nuevo', 'nombre_tienda', 'imagen_producto'],
  'admin.pending.store':           ['nombre_tienda'],
  'admin.pending.product':         ['nombre_producto', 'nombre_tienda'],
  'admin.pending.subscription':    ['nombre_vendedor', 'nombre_tienda', 'nombre_plan'],
  'rating.product.new':            ['id_producto'],
  'rating.store.new':              ['id_tienda'],
};

module.exports = { PUSH_NOTIFICATION_DEFAULTS, PUSH_VARIABLE_MAP };
