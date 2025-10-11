const express = require('express');
const router = express.Router({ mergeParams: true });
const { isLoggedIn } = require('../middleware');
const taxiController = require('../controllers/taxi');

// Render taxi booking page for a listing
router.get('/listings/:id/taxi', isLoggedIn, taxiController.renderTaxiPage);

// Estimate fare
router.post('/listings/:id/taxi/estimate', isLoggedIn, taxiController.estimate);

// Create order and provisional booking
router.post('/listings/:id/taxi/order', isLoggedIn, taxiController.createOrder);

// Verify payment callback
router.post('/taxis/verify', isLoggedIn, taxiController.verifyPayment);

// User taxi bookings
router.get('/taxis/bookings', isLoggedIn, taxiController.userBookings);

module.exports = router;


