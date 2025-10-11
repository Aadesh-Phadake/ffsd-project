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

// Create order for listing with optional fee waiver for members
exports.createOrderForListing = async (propertyId, isMember, checkIn, checkOut, guests) => {
    try {
        const property = await Listing.findById(propertyId);

        if (!property) {
            throw new Error('Property not found');
        }

        const basePrice = property.price;
        const adminFee = isMember ? 0 : basePrice * 0.05; // waive for members
        const totalPrice = basePrice + adminFee;

        const options = {
            amount: totalPrice * 100, // amount in smallest currency unit
            currency: "INR",
            receipt: `receipt_${Date.now()}`,
        };

        const order = await razorpay.orders.create(options);

        return {
            property,
            orderId: order.id,
            checkIn,
            checkOut,
            guests,
            totalPrice: totalPrice.toFixed(2)
        };
    } catch (error) {
        console.error('Error creating order with fee:', error);
        throw error;
    }
};

// Verify payment with 5% admin fee
exports.verifyPaymentWithFee = async (razorpay_order_id, razorpay_payment_id, razorpay_signature, bookingDetails) => {
    try {
        const sign = `${razorpay_order_id}|${razorpay_payment_id}`;
        const expectedSign = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
            .update(sign.toString())
            .digest("hex");

        if (razorpay_signature === expectedSign) {
            // Payment successful, save booking to the database
            const Booking = require('../models/booking'); // Import the Booking model
            const newBooking = new Booking(bookingDetails);
            await newBooking.save();

            return {
                success: true,
                booking: newBooking
            };
        } else {
            // Payment verification failed
            return {
                success: false
            };
        }
    } catch (error) {
        console.error('Error verifying payment with fee:', error);
        throw error;
    }
};

// Create membership order (₹999)
exports.createMembershipOrder = async () => {
    const options = {
        amount: 99900, // ₹999 in paise
        currency: 'INR',
        receipt: `membership_${Date.now()}`,
    };
    const order = await razorpay.orders.create(options);
    return { orderId: order.id, amount: options.amount };
};

// Verify membership payment and activate
exports.verifyMembershipPayment = async (userId, razorpay_order_id, razorpay_payment_id, razorpay_signature) => {
    const sign = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSign = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(sign.toString())
        .digest('hex');

    if (razorpay_signature !== expectedSign) {
        return { success: false };
    }

    const User = require('../models/user');
    const user = await User.findById(userId);
    if (!user) return { success: false };
    const now = new Date();
    const expires = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    user.isMember = true;
    user.membershipExpiresAt = expires;
    
    // Initialize cancellation tracking for new members
    if (!user.freeCancellationsResetAt) {
        user.freeCancellationsResetAt = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        user.freeCancellationsUsed = 0;
    }
    
    await user.save();

    return { success: true, expiresAt: expires };
};