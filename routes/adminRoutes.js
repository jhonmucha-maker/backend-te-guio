const express = require('express');
const router = express.Router();
const verificarToken = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/rbacMiddleware');
const { ROLES } = require('../config/constants');
const { uploadGalleryImages, uploadFilesToS3, setS3SubDir, handleMulterError } = require('../middleware/uploadMiddleware');
const { addGalleryPhotos, deleteGalleryPhoto } = require('../controllers/photosController');

const { registerDevice, unregisterDevice, getMyDevices } = require('../controllers/pushController');

const {
  getDashboard,
  getPendingStores, approveStore,
  getPendingProducts, approveProduct,
  getSubscriptionRequests, approveSubscription, updateSubscriptionEndDate,
  getFinanceSummary, getTransactions, getReports, getInactiveUsers,
  getBuyers, getSellers, toggleUserActive, softDeleteUser, cascadeDeleteSeller,
  getAdmins, createAdmin, updateAdmin, deleteAdmin,
  bulkDeleteRejectedStores,
  bulkDeleteRejectedProducts, bulkDeleteRejectedSubscriptions,
  citiesCrud, zonesCrud, galleriesCrud, categoriesCrud, faqsCrud, paymentMethodsCrud,
  termsCrud, privacyCrud, emailTemplatesHandler, plansCrud, systemConfigCrud,
  getPlanFeatures, createPlanFeature, updatePlanFeature, deletePlanFeature, reorderPlanFeatures,
  pushNotificationsHandler,
} = require('../controllers/adminController');

const {
  exportEntity, exportBundle, getExportCatalog,
} = require('../controllers/exportController');

const auth = [verificarToken, requireRole(ROLES.ADMINISTRADOR)];

// Dashboard y reportes
router.get('/dashboard', ...auth, getDashboard);
router.get('/reports', ...auth, getReports);
router.get('/reports/inactive-users', ...auth, getInactiveUsers);

// Finanzas
router.get('/finance/summary', ...auth, getFinanceSummary);
router.get('/finance/transactions', ...auth, getTransactions);

// Gestion usuarios (prefijo /users/)
router.get('/users/buyers', ...auth, getBuyers);
router.get('/users/sellers', ...auth, getSellers);
router.patch('/users/:id/toggle-active', ...auth, toggleUserActive);
router.delete('/users/:id', ...auth, softDeleteUser);
router.delete('/users/sellers/:id/cascade', ...auth, cascadeDeleteSeller);

// Export (?format=xlsx|pdf ; default xlsx)
// 'catalog' y 'bundle' van ANTES de '/export/:entity' o el parametro los captura.
router.get('/export/catalog', ...auth, getExportCatalog);
router.get('/export/bundle', ...auth, exportBundle);
// :entity = clave de utils/datasets (sellers, buyers, products, stores,
// galleries, zones, categories). Sustituye a las 7 rutas fijas anteriores.
router.get('/export/:entity', ...auth, exportEntity);

// Administradores
router.get('/admins', ...auth, getAdmins);
router.post('/admins', ...auth, createAdmin);
router.put('/admins/:id', ...auth, updateAdmin);
router.delete('/admins/:id', ...auth, deleteAdmin);

// Aprobaciones tiendas
router.get('/approvals/stores', ...auth, getPendingStores);
router.patch('/approvals/stores/:id', ...auth, approveStore);

// Aprobaciones productos
router.get('/approvals/products', ...auth, getPendingProducts);
router.patch('/approvals/products/:id', ...auth, approveProduct);

// Aprobaciones suscripciones
router.get('/approvals/subscriptions', ...auth, getSubscriptionRequests);
router.patch('/approvals/subscriptions/:id', ...auth, approveSubscription);

// Suscripciones gestion
router.patch('/subscriptions/:id/end-date', ...auth, updateSubscriptionEndDate);

// Eliminacion masiva de rechazados
router.post('/approvals/stores/bulk-delete', ...auth, bulkDeleteRejectedStores);
router.post('/approvals/products/bulk-delete', ...auth, bulkDeleteRejectedProducts);
router.post('/approvals/subscriptions/bulk-delete', ...auth, bulkDeleteRejectedSubscriptions);

// CRUD Config - Ciudades (prefijo /config/)
router.get('/config/cities', ...auth, citiesCrud.getAll);
router.post('/config/cities', ...auth, citiesCrud.create);
router.put('/config/cities/:id', ...auth, citiesCrud.update);
router.patch('/config/cities/:id', ...auth, citiesCrud.update);
router.delete('/config/cities/:id', ...auth, citiesCrud.softDelete);

// CRUD Config - Zonas
router.get('/config/zones', ...auth, zonesCrud.getAll);
router.post('/config/zones', ...auth, zonesCrud.create);
router.put('/config/zones/:id', ...auth, zonesCrud.update);
router.patch('/config/zones/:id', ...auth, zonesCrud.update);
router.delete('/config/zones/:id', ...auth, zonesCrud.softDelete);

// CRUD Config - Galerias
router.get('/config/galleries', ...auth, galleriesCrud.getAll);
router.post('/config/galleries', ...auth, galleriesCrud.create);
router.put('/config/galleries/:id', ...auth, galleriesCrud.update);
router.patch('/config/galleries/:id', ...auth, galleriesCrud.update);
router.delete('/config/galleries/:id', ...auth, galleriesCrud.softDelete);

// Fotos galerias
router.post('/galleries/:id/photos', ...auth, uploadGalleryImages.array('fotos', 5), handleMulterError, setS3SubDir((req) => `galerias/${req.params.id}`), uploadFilesToS3, addGalleryPhotos);
router.delete('/galleries/:id/photos/:photoId', ...auth, deleteGalleryPhoto);

// CRUD Config - Categorias
router.get('/config/categories', ...auth, categoriesCrud.getAll);
router.post('/config/categories', ...auth, categoriesCrud.create);
router.put('/config/categories/:id', ...auth, categoriesCrud.update);
router.patch('/config/categories/:id', ...auth, categoriesCrud.update);
router.delete('/config/categories/:id', ...auth, categoriesCrud.softDelete);

// CRUD Config - FAQs
router.get('/config/faqs', ...auth, faqsCrud.getAll);
router.post('/config/faqs', ...auth, faqsCrud.create);
router.put('/config/faqs/:id', ...auth, faqsCrud.update);
router.patch('/config/faqs/:id', ...auth, faqsCrud.update);
router.delete('/config/faqs/:id', ...auth, faqsCrud.softDelete);

// CRUD Config - Metodos de Pago
router.get('/config/payment-methods', ...auth, paymentMethodsCrud.getAll);
router.post('/config/payment-methods', ...auth, paymentMethodsCrud.create);
router.put('/config/payment-methods/:id', ...auth, paymentMethodsCrud.update);
router.patch('/config/payment-methods/:id', ...auth, paymentMethodsCrud.update);
router.delete('/config/payment-methods/:id', ...auth, paymentMethodsCrud.softDelete);

// CRUD Config - Terminos
router.get('/config/terms', ...auth, termsCrud.getAll);
router.post('/config/terms', ...auth, termsCrud.create);
router.put('/config/terms/:id', ...auth, termsCrud.update);
router.patch('/config/terms/:id', ...auth, termsCrud.update);
router.delete('/config/terms/:id', ...auth, termsCrud.softDelete);

// CRUD Config - Privacidad
router.get('/config/privacy', ...auth, privacyCrud.getAll);
router.post('/config/privacy', ...auth, privacyCrud.create);
router.put('/config/privacy/:id', ...auth, privacyCrud.update);
router.patch('/config/privacy/:id', ...auth, privacyCrud.update);
router.delete('/config/privacy/:id', ...auth, privacyCrud.softDelete);

// Config - Plantillas Email (solo lectura + edicion + reset + preview, sin crear/eliminar)
router.post('/config/email-templates/preview', ...auth, emailTemplatesHandler.preview);
router.get('/config/email-templates', ...auth, emailTemplatesHandler.getAll);
router.put('/config/email-templates/:id', ...auth, emailTemplatesHandler.update);
router.patch('/config/email-templates/:id', ...auth, emailTemplatesHandler.update);
router.post('/config/email-templates/reset', ...auth, emailTemplatesHandler.reset);

// Config - Planes de Suscripcion (solo lectura + edicion precio/duracion)
router.get('/config/plans', ...auth, plansCrud.getAll);
router.patch('/config/plans/:id', ...auth, plansCrud.update);

// Config - Plan Features (CRUD + reorder)
router.get('/config/plans/:id/features', ...auth, getPlanFeatures);
router.post('/config/plans/:id/features/reorder', ...auth, reorderPlanFeatures);
router.post('/config/plans/:id/features', ...auth, createPlanFeature);
router.patch('/config/plans/:id/features/:featureId', ...auth, updatePlanFeature);
router.delete('/config/plans/:id/features/:featureId', ...auth, deletePlanFeature);

// Config - Configuracion del Sistema (solo lectura + edicion valor)
router.get('/config/system', ...auth, systemConfigCrud.getAll);
router.patch('/config/system/:id', ...auth, systemConfigCrud.update);

// Config - Notificaciones Push (lectura + edicion + reset, sin crear/eliminar)
router.get('/config/push-notifications', ...auth, pushNotificationsHandler.getAll);
router.put('/config/push-notifications/:id', ...auth, pushNotificationsHandler.update);
router.patch('/config/push-notifications/:id', ...auth, pushNotificationsHandler.update);
router.post('/config/push-notifications/reset', ...auth, pushNotificationsHandler.reset);

// Push notifications - registro de dispositivos
router.post('/push/register', ...auth, registerDevice);
router.post('/push/unregister', ...auth, unregisterDevice);
router.get('/push/devices', ...auth, getMyDevices);

module.exports = router;
