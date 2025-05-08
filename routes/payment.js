const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { isLoggedIn } = require('../middleware');

// Create payment order
router.get('/create/:propertyId', isLoggedIn, paymentController.createOrder);

// Verify payment
router.post('/verify', isLoggedIn, paymentController.verifyPayment);

module.exports = router; 