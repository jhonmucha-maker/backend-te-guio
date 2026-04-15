const express = require('express');
const router = express.Router();
const verificarToken = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/rbacMiddleware');
const { ROLES } = require('../config/constants');
const { uploadImages, uploadStoreImages, uploadDocs, uploadSubscription, uploadFilesToS3, setS3SubDir, handleMulterError } = require('../middleware/uploadMiddleware');
const { uploadProfileImage } = require('../controllers/buyerProfileController');
const {
  getSellerProfile, updateSellerProfile,
  getMyStores, createStore, updateStore, resubmitStore, deleteStore,
  getMyProducts, createProduct, updateProduct, updatePrice, toggleProduct, resubmitProduct, deleteProduct,
} = require('../controllers/sellerController');
const { requestSubscription, getMySubscriptions } = require('../controllers/subscriptionController');
const { addStorePhotos, deleteStorePhoto, addProductPhotos, deleteProductPhoto, addSellerDocs } = require('../controllers/photosController');
const { registerDevice, unregisterDevice, getMyDevices } = require('../controllers/pushController');

const auth = [verificarToken, requireRole(ROLES.VENDEDOR)];

// Helpers: multer → asignar subdir → subir a S3
const storeUploadChain = [uploadStoreImages.array('fotos', 5), handleMulterError, setS3SubDir((req) => `stores/${req.user.id}`), uploadFilesToS3];
const productUploadChain = [uploadImages.array('fotos', 5), handleMulterError, setS3SubDir((req) => `photos/${req.user.id}`), uploadFilesToS3];
const docsUploadChain = [uploadDocs.array('documentos', 5), handleMulterError, setS3SubDir(() => 'documents'), uploadFilesToS3];
const avatarUploadChain = [uploadImages.array('imagen', 1), handleMulterError, setS3SubDir((req) => `avatars/${req.user.id}`), uploadFilesToS3];
const subscriptionUpload = uploadSubscription.fields([
  { name: 'comprobante', maxCount: 1 },
  { name: 'imagenes_adicionales', maxCount: 3 },
]);
const subscriptionUploadChain = [subscriptionUpload, handleMulterError, setS3SubDir((req) => `suscripciones/${req.user.id}`), uploadFilesToS3];

// Perfil vendedor
router.get('/profile', ...auth, getSellerProfile);
router.patch('/profile', ...auth, updateSellerProfile);
router.post('/profile/image', ...auth, ...avatarUploadChain, uploadProfileImage);

// Tiendas
router.get('/stores', ...auth, getMyStores);
router.post('/stores', ...auth, ...storeUploadChain, createStore);
router.patch('/stores/:id', ...auth, ...storeUploadChain, updateStore);
router.put('/stores/:id', ...auth, ...storeUploadChain, updateStore);
router.post('/stores/:id/resubmit', ...auth, ...storeUploadChain, resubmitStore);
router.put('/stores/:id/resubmit', ...auth, ...storeUploadChain, resubmitStore);
router.delete('/stores/:id', ...auth, deleteStore);

// Fotos tiendas
router.post('/stores/:id/photos', ...auth, ...storeUploadChain, addStorePhotos);
router.delete('/stores/:id/photos/:photoId', ...auth, deleteStorePhoto);

// Productos
router.get('/products', ...auth, getMyProducts);
router.post('/products', ...auth, ...productUploadChain, createProduct);
router.patch('/products/:id', ...auth, ...productUploadChain, updateProduct);
router.put('/products/:id', ...auth, ...productUploadChain, updateProduct);
router.patch('/products/:id/price', ...auth, updatePrice);
router.patch('/products/:id/toggle', ...auth, toggleProduct);
router.post('/products/:id/disable', ...auth, toggleProduct);
router.post('/products/:id/enable', ...auth, toggleProduct);
router.post('/products/:id/resubmit', ...auth, resubmitProduct);
router.delete('/products/:id', ...auth, deleteProduct);

// Fotos productos
router.post('/products/:id/photos', ...auth, ...productUploadChain, addProductPhotos);
router.delete('/products/:id/photos/:photoId', ...auth, deleteProductPhoto);

// Documentos vendedor
router.post('/docs', ...auth, ...docsUploadChain, addSellerDocs);

// Suscripciones
router.post('/subscriptions', ...auth, ...subscriptionUploadChain, requestSubscription);
router.get('/subscriptions', ...auth, getMySubscriptions);

// Push notifications
router.post('/push/register', ...auth, registerDevice);
router.post('/push/unregister', ...auth, unregisterDevice);
router.get('/push/devices', ...auth, getMyDevices);

module.exports = router;
