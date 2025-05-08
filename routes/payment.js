const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { isLoggedIn } = require('../middleware');
const user = require('../models/user');

// Create payment order with 5% admin fee
router.get('/create/:propertyId', isLoggedIn, async (req, res, next) => {
    try {
        const propertyId = req.params.propertyId;
        const { checkIn, checkOut, guests } = req.query;

        // Call the payment controller to create the order
        const orderDetails = await paymentController.createOrderWithFee(propertyId, checkIn, checkOut, guests);

        res.render('users/payment', {
            property: orderDetails.property,
            orderId: orderDetails.orderId,
            checkIn: orderDetails.checkIn,
            checkOut: orderDetails.checkOut,
            guests: orderDetails.guests,
            totalPrice: orderDetails.totalPrice,
            user: req.user,
        });
    } catch (error) {
        next(error);
    }
});

// Verify payment and include 5% admin fee
router.post('/verify', isLoggedIn, async (req, res, next) => {
    try {
        const { paymentId, propertyId, checkIn, checkOut, guests } = req.body;

        // Call the payment controller to verify the payment
        const verificationResult = await paymentController.verifyPaymentWithFee(paymentId, propertyId, checkIn, checkOut, guests);

        if (verificationResult.success) {
            req.flash('success', `Payment successful! Total amount: ₹${verificationResult.totalPrice.toLocaleString("en-IN")} (including 5% admin fee)`);
            res.redirect('/profile');
        } else {
            req.flash('error', 'Payment verification failed. Please try again.');
            res.redirect(`/payment/create/${propertyId}`);
        }
    } catch (error) {
        next(error);
    }
});

module.exports = router;