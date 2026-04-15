const express = require('express');
const router = express.Router();
const { searchProducts, searchStores, getProductDetail, getStoreDetail, getProductRatings, getStoreRatings } = require('../controllers/marketplaceController');

router.get('/products', searchProducts);
router.get('/stores', searchStores);
router.get('/products/:id', getProductDetail);
router.get('/stores/:id', getStoreDetail);
router.get('/products/:id/ratings', getProductRatings);
router.get('/stores/:id/ratings', getStoreRatings);

module.exports = router;
