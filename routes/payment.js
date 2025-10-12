const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { isLoggedIn } = require('../middleware');
const user = require('../models/user');
const Listing = require('../models/listing');

// Create payment order for a listing (admin fee waived for active members)
router.get('/create/:propertyId', isLoggedIn, async (req, res, next) => {
    try {
        const propertyId = req.params.propertyId;
        const { checkIn, checkOut, guests } = req.query;
        const isMember = req.user && req.user.isMember && req.user.membershipExpiresAt && new Date(req.user.membershipExpiresAt) > new Date();

        // Create order with membership-aware pricing
        const orderDetails = await paymentController.createOrderForListing(propertyId, isMember, checkIn, checkOut, guests);

        res.render('users/payment', {
            property: orderDetails.property,
            orderId: orderDetails.orderId,
            checkIn: orderDetails.checkIn,
            checkOut: orderDetails.checkOut,
            guests: orderDetails.guests,
            totalPrice: orderDetails.totalPrice,
            user: req.user,
            isMember
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

        // Check if user has active membership
        const isMember = req.user && req.user.isMember && req.user.membershipExpiresAt && new Date(req.user.membershipExpiresAt) > new Date();
        
        // Parse dates to calculate nights
        const parseDate = (dateStr) => {
            if (!dateStr) return null;
            
            // Handle DD-MM-YYYY format (like '14-10-2025')
            if (dateStr.includes('-') && dateStr.split('-').length === 3) {
                const parts = dateStr.split('-');
                if (parts[0].length <= 2) {
                    // DD-MM-YYYY format
                    const [day, month, year] = parts.map(Number);
                    const date = new Date(year, month - 1, day); // month is 0-indexed
                    return isNaN(date.getTime()) ? null : date;
                } else {
                    // YYYY-MM-DD format
                    const date = new Date(dateStr);
                    return isNaN(date.getTime()) ? null : date;
                }
            }
            
            // Fallback: try standard Date parsing
            const date = new Date(dateStr);
            return isNaN(date.getTime()) ? null : date;
        };
        
        const checkInDate = parseDate(checkIn);
        const checkOutDate = parseDate(checkOut);
        const nights = Math.ceil((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24));
        const numGuests = parseInt(guests) || 1;
        
        // Calculate: price per night * nights (for up to 2 guests)
        let basePrice = property.price * nights;
        
        // Add ₹500 per night for each guest beyond 2
        if (numGuests > 2) {
            const additionalGuestFee = (numGuests - 2) * 500 * nights;
            basePrice += additionalGuestFee;
        }
        
        // 5% admin fee (waived for members)
        const adminFee = isMember ? 0 : basePrice * 0.05;
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

// Membership checkout
router.get('/membership', isLoggedIn, async (req, res, next) => {
    try {
        const { orderId, amount } = await paymentController.createMembershipOrder();
        res.render('users/membership', { orderId, amount, user: req.user });
    } catch (e) {
        next(e);
    }
});

router.post('/membership/verify', isLoggedIn, async (req, res, next) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
        const result = await paymentController.verifyMembershipPayment(req.user._id, razorpay_order_id, razorpay_payment_id, razorpay_signature);
        if (result.success) {
            req.flash('success', 'Membership activated!');
            res.redirect('/profile');
        } else {
            req.flash('error', 'Membership payment verification failed');
            res.redirect('/profile');
        }
    } catch (e) {
        next(e);
    }
});

module.exports = router;