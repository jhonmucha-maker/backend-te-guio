const express = require('express');
const router = express.Router();
const verificarToken = require('../middleware/authMiddleware');
const { validateRegisterBuyer, validateRegisterSeller, validateLogin, validateVerifyEmail, validateResetPassword } = require('../validators/authValidator');
const {
  login, registerBuyer, registerSeller, verifyEmail, resendEmailCode,
  forgotPassword, resetPassword, refreshTokenHandler, logout, getMe, getCurrentTerms, acceptTerms,
} = require('../controllers/authController');

router.post('/register/buyer', validateRegisterBuyer, registerBuyer);
router.post('/register/seller', validateRegisterSeller, registerSeller);
router.post('/verify-email', validateVerifyEmail, verifyEmail);
router.post('/resend-email-code', resendEmailCode);
router.post('/login', validateLogin, login);
router.post('/logout', verificarToken, logout);
router.post('/password/forgot', forgotPassword);
router.post('/password/reset', validateResetPassword, resetPassword);
router.post('/refresh', refreshTokenHandler);
router.get('/me', verificarToken, getMe);
router.get('/terms', getCurrentTerms);
router.post('/accept-terms', verificarToken, acceptTerms);

module.exports = router;
