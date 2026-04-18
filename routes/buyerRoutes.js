const express = require('express');
const router = express.Router();
const verificarToken = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/rbacMiddleware');
const { ROLES } = require('../config/constants');
const { validateRating } = require('../validators/ratingValidator');
const { validateAddItem } = require('../validators/shoppingValidator');

const { getBuyerProfile, updateBuyerProfile, changeBuyerPassword, uploadProfileImage } = require('../controllers/buyerProfileController');
const { uploadImages, uploadFilesToS3, setS3SubDir, handleMulterError } = require('../middleware/uploadMiddleware');
const { getFavoriteProducts, addFavoriteProduct, removeFavoriteProduct, getFavoriteStores, addFavoriteStore, removeFavoriteStore } = require('../controllers/favoritesController');
const { getShoppingList, addItem, updateItem, markPurchased, unmarkPurchased, deleteItem, getShoppingHistory, getPurchasedStores } = require('../controllers/shoppingController');
const { rateProduct, rateStore, getMyRatings } = require('../controllers/ratingsController');
const { registerDevice, unregisterDevice, getMyDevices } = require('../controllers/pushController');

const auth = [verificarToken, requireRole(ROLES.COMPRADOR)];
const avatarUploadChain = [uploadImages.array('imagen', 1), handleMulterError, setS3SubDir((req) => `avatars/${req.user.id}`), uploadFilesToS3];

// Perfil comprador
router.get('/profile', ...auth, getBuyerProfile);
router.patch('/profile', ...auth, updateBuyerProfile);
router.patch('/password', ...auth, changeBuyerPassword);
router.post('/profile/image', ...auth, ...avatarUploadChain, uploadProfileImage);

// Favoritos (PUT original + POST para compatibilidad con frontend)
router.get('/favorites/products', ...auth, getFavoriteProducts);
router.put('/favorites/products/:product_id', ...auth, addFavoriteProduct);
router.post('/favorites/products/:product_id', ...auth, addFavoriteProduct);
router.delete('/favorites/products/:product_id', ...auth, removeFavoriteProduct);
router.get('/favorites/stores', ...auth, getFavoriteStores);
router.put('/favorites/stores/:store_id', ...auth, addFavoriteStore);
router.post('/favorites/stores/:store_id', ...auth, addFavoriteStore);
router.delete('/favorites/stores/:store_id', ...auth, removeFavoriteStore);

// Lista de compras (PATCH original + PUT para compatibilidad con frontend)
router.get('/shopping-list', ...auth, getShoppingList);
router.post('/shopping-list/items', ...auth, validateAddItem, addItem);
router.patch('/shopping-list/items/:id', ...auth, updateItem);
router.put('/shopping-list/items/:id', ...auth, updateItem);
router.post('/shopping-list/items/:id/purchased', ...auth, markPurchased);
router.patch('/shopping-list/items/:id/purchased', ...auth, markPurchased);
router.delete('/shopping-list/items/:id/purchased', ...auth, unmarkPurchased);
router.patch('/shopping-list/items/:id/unpurchased', ...auth, unmarkPurchased);
router.delete('/shopping-list/items/:id', ...auth, deleteItem);
router.get('/shopping-history', ...auth, getShoppingHistory);
router.get('/purchased-stores', ...auth, getPurchasedStores);

// Calificaciones (rutas originales con path param)
router.post('/ratings/products/:product_id', ...auth, validateRating, rateProduct);
router.post('/ratings/stores/:store_id', ...auth, validateRating, rateStore);
// Rutas alternativas (singular, ID desde body) para compatibilidad con frontend
router.post('/ratings/product', ...auth, validateRating, (req, res) => {
  req.params.product_id = req.body.id_producto || req.body.product_id;
  return rateProduct(req, res);
});
router.post('/ratings/store', ...auth, validateRating, (req, res) => {
  req.params.store_id = req.body.id_tienda || req.body.store_id;
  return rateStore(req, res);
});
router.get('/ratings', ...auth, getMyRatings);

// Push notifications
router.post('/push/register', ...auth, registerDevice);
router.post('/push/unregister', ...auth, unregisterDevice);
router.get('/push/devices', ...auth, getMyDevices);

module.exports = router;
