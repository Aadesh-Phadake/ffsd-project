const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { isLoggedIn } = require('../middleware');
const user = require('../models/user');
const Listing = require('../models/listing');

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
        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
            propertyId,
            checkIn,
            checkOut,
            guests
        } = req.body;

        // Fetch the property to calculate the total amount
        const property = await Listing.findById(propertyId);
        if (!property) {
            req.flash('error', 'Property not found.');
            return res.redirect('/profile');
        }

        const basePrice = property.price * (checkOut - checkIn)* guests;
        const adminFee = basePrice * 0.05; // 5% admin fee
        const totalAmount = basePrice + adminFee;

        const bookingDetails = {
            user: req.user._id,
            listing: propertyId,
            checkIn,
            checkOut,
            guests,
            totalAmount: totalAmount.toFixed(2) // Pass the calculated total amount
        };

        // Call the payment controller to verify the payment and save the booking
        const verificationResult = await paymentController.verifyPaymentWithFee(
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
            bookingDetails
        );

        if (verificationResult.success) {
            req.flash('success', 'Payment successful! Your booking has been confirmed.');
            res.redirect('/profile');
        } else {
            req.flash('error', 'Payment verification failed. Please try again.');
            res.redirect('/profile');
        }
    } catch (error) {
        console.error('Error verifying payment:', error);
        req.flash('error', 'Error verifying payment. Please try again.');
        res.redirect('/profile');
    }
});

module.exports = router;