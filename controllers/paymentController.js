const Razorpay = require('razorpay');
const crypto = require('crypto');
const Listing = require('../models/listing');

// Initialize Razorpay
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

// Create order
exports.createOrder = async (req, res) => {
    try {
        const { propertyId } = req.params;
        const { checkIn, checkOut, guests } = req.query;
        
        const property = await Listing.findById(propertyId);
        
        if (!property) {
            return res.status(404).json({ message: 'Property not found' });
        }

        const options = {
            amount: property.price * 100, // amount in smallest currency unit
            currency: "INR",
            receipt: `receipt_${Date.now()}`,
        };

        const order = await razorpay.orders.create(options);
        
        res.render('users/payment', {
            property,
            orderId: order.id,
            user: req.user,
            checkIn,
            checkOut,
            guests
        });
    } catch (error) {
        console.error('Error creating order:', error);
        req.flash('error', 'Error creating payment order');
        res.redirect(`/listings/${req.params.propertyId}`);
    }
};

// Verify payment
exports.verifyPayment = async (req, res) => {
    try {
        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature
        } = req.body;

        const sign = razorpay_order_id + "|" + razorpay_payment_id;
        const expectedSign = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
            .update(sign.toString())
            .digest("hex");

        if (razorpay_signature === expectedSign) {
            // Payment successful
            req.flash('success', 'Payment successful! Your booking has been confirmed.');
            res.redirect('/profile');
        } else {
            req.flash('error', 'Payment verification failed');
            res.redirect('/profile');
        }
    } catch (error) {
        console.error('Error verifying payment:', error);
        req.flash('error', 'Error verifying payment');
        res.redirect('/profile');
    }
}; 