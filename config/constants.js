// Estado de cuenta mostrado al administrador. NO es una columna de la BD:
// se deriva de `activo` (habilitado / baneado por el admin) y `correo_verificado`
// (completo su activacion por codigo). Un usuario nace activo=true + verificado=false.
const ACCOUNT_STATUS = {
  ACTIVO: 'ACTIVO',
  INACTIVO: 'INACTIVO',
  SUSPENDIDO: 'SUSPENDIDO',
};

const ACCOUNT_STATUS_LABELS = {
  [ACCOUNT_STATUS.ACTIVO]: 'Activo',
  [ACCOUNT_STATUS.INACTIVO]: 'Inactivo',
  [ACCOUNT_STATUS.SUSPENDIDO]: 'Suspendido',
};

// Clave de cada estado en los contadores que consumen los listados del admin.
const ACCOUNT_STATUS_COUNT_KEYS = {
  [ACCOUNT_STATUS.ACTIVO]: 'activos',
  [ACCOUNT_STATUS.INACTIVO]: 'sin_verificar',
  [ACCOUNT_STATUS.SUSPENDIDO]: 'suspendidos',
};

// El baneo del admin gana sobre la falta de verificacion: es la razon mas fuerte.
const deriveAccountStatus = ({ activo, correo_verificado }) => {
  if (!activo) return ACCOUNT_STATUS.SUSPENDIDO;
  if (!correo_verificado) return ACCOUNT_STATUS.INACTIVO;
  return ACCOUNT_STATUS.ACTIVO;
};

// Cuenta usuarios ya mapeados (con estado_cuenta) por estado. Arranca en 0 para
// que las claves existan aunque ningun usuario caiga en ese estado.
const countByAccountStatus = (users) => {
  const counts = Object.fromEntries(
    Object.values(ACCOUNT_STATUS_COUNT_KEYS).map((key) => [key, 0])
  );
  users.forEach((u) => {
    const key = ACCOUNT_STATUS_COUNT_KEYS[u.estado_cuenta];
    if (key) counts[key] += 1;
  });
  return counts;
};

module.exports = {
  ACCOUNT_STATUS,
  ACCOUNT_STATUS_LABELS,
  ACCOUNT_STATUS_COUNT_KEYS,
  deriveAccountStatus,
  countByAccountStatus,

  ROLES: {
    COMPRADOR: 'COMPRADOR',
    VENDEDOR: 'VENDEDOR',
    ADMINISTRADOR: 'ADMINISTRADOR',
  },

  APPROVAL_STATUS: {
    PENDIENTE: 'PENDIENTE',
    APROBADO: 'APROBADO',
    RECHAZADO: 'RECHAZADO',
  },

  PRODUCT_STATE: {
    ACTIVE: 'ACTIVE',
    INACTIVE: 'INACTIVE',
    TEMP_DISABLED: 'TEMP_DISABLED',
  },

  SHOPPING_LIST_STATUS: {
    OPEN: 'OPEN',
    COMPLETED: 'COMPLETED',
  },

  TICKET_STATUS: {
    PENDIENTE: 'PENDIENTE',
    RESPONDIDO: 'RESPONDIDO',
    EN_ESPERA_DE_RESPUESTA: 'EN_ESPERA_DE_RESPUESTA',
    ATENDIDO: 'ATENDIDO',
  },

  TICKET_TARGET: {
    ADMIN: 'ADMIN',
    STORE: 'STORE',
  },

  TICKET_CLOSE_REASON: {
    ACCEPTED: 'ACCEPTED',
    NO_BUYER_RESPONSE_7D: 'NO_BUYER_RESPONSE_7D',
    ADMIN_CLOSED: 'ADMIN_CLOSED',
  },

  SUBSCRIPTION_STATUS: {
    ACTIVE: 'ACTIVE',
    EXPIRED: 'EXPIRED',
  },

  SUBSCRIPTION_REQUEST_STATUS: {
    PENDIENTE: 'PENDIENTE',
    APROBADO: 'APROBADO',
    RECHAZADO: 'RECHAZADO',
    ELIMINADO: 'ELIMINADO',
  },

  PLAN_TYPE: {
    ESTANDAR: 'ESTANDAR',
    PREMIUM: 'PREMIUM',
  },

  AUTH_ERROR_CODES: {
    ACCOUNT_DISABLED: 'ACCOUNT_DISABLED',
  },

  AUTH_MESSAGES: {
    ACCOUNT_DISABLED: 'Tu cuenta ha sido inhabilitada por un administrador',
  },

  RATING_WINDOW_DAYS: 14,
  TICKET_SELLER_CLOSE_DAYS: 7,
  TIMEZONE: 'America/Lima',

  UPLOAD: {
    MAX_SIZE_BYTES: 10 * 1024 * 1024, // 10MB
    MAX_PHOTOS_PER_ENTITY: 5,
    ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/webp'],
    ALLOWED_RECEIPT_TYPES: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
  },
};
