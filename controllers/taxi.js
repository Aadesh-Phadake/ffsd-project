const Razorpay = require('razorpay');
const crypto = require('crypto');
const Listing = require('../models/listing');
const TaxiBooking = require('../models/taxiBooking');

const RADIUS_KM = 50;
const BASE_PER_KM = {
    Standard: 15,
    SUV: 22,
    Luxury: 35,
};
const AVG_SPEED_KMPH = 35; // simple ETA estimate

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

function clampRadius(distanceKm) {
    return distanceKm <= RADIUS_KM;
}

function estimateFareAndTime(distanceKm, taxiType) {
    const perKm = BASE_PER_KM[taxiType] || BASE_PER_KM.Standard;
    const fare = Math.max(0, distanceKm) * perKm;
    const timeMin = Math.ceil((Math.max(1, distanceKm) / AVG_SPEED_KMPH) * 60);
    return { fare: Math.round(fare), timeMin };
}

module.exports.renderTaxiPage = async (req, res) => {
    const { id } = req.params; // listing id
    const listing = await Listing.findById(id);
    if (!listing) {
        req.flash('error', 'Hotel not found');
        return res.redirect('/listings');
    }
    res.render('listings/taxi', { listing, currentUser: req.user });
};

module.exports.estimate = async (req, res) => {
    try {
        const { id } = req.params; // listing id
        const { pickupLocation, dropLocation, distanceKm, taxiType } = req.body;

        const listing = await Listing.findById(id);
        if (!listing) return res.status(404).json({ message: 'Hotel not found' });

        const d = Number(distanceKm);
        if (!pickupLocation || !dropLocation || !taxiType || isNaN(d) || d <= 0) {
            return res.status(400).json({ message: 'Invalid input' });
        }
        if (!clampRadius(d)) {
            return res.status(400).json({ message: `Drop must be within ${RADIUS_KM} km` });
        }
        const { fare, timeMin } = estimateFareAndTime(d, taxiType);
        return res.json({ fare, timeMin });
    } catch (e) {
        console.error('Estimate error:', e);
        return res.status(500).json({ message: 'Server error' });
    }
};

module.exports.createOrder = async (req, res) => {
    try {
        const { id } = req.params; // listing id
        const { pickupLocation, dropLocation, distanceKm, taxiType } = req.body;

        const listing = await Listing.findById(id);
        if (!listing) return res.status(404).json({ message: 'Hotel not found' });

        const d = Number(distanceKm);
        if (!pickupLocation || !dropLocation || !taxiType || isNaN(d) || d <= 0) {
            return res.status(400).json({ message: 'Invalid input' });
        }
        if (!clampRadius(d)) {
            return res.status(400).json({ message: `Drop must be within ${RADIUS_KM} km` });
        }
        const { fare, timeMin } = estimateFareAndTime(d, taxiType);

        const order = await razorpay.orders.create({
            amount: fare * 100,
            currency: 'INR',
            receipt: `taxi_${Date.now()}`,
        });

        const booking = await TaxiBooking.create({
            user: req.user._id,
            listing: listing._id,
            pickupLocation,
            dropLocation,
            distanceKm: d,
            estimatedTimeMin: timeMin,
            taxiType,
            fareAmount: fare,
            paymentStatus: 'Pending',
            bookingStatus: 'Created',
            razorpayOrderId: order.id,
        });

        return res.json({
            orderId: order.id,
            amount: fare,
            currency: 'INR',
            bookingId: booking._id,
            keyId: process.env.RAZORPAY_KEY_ID,
        });
    } catch (e) {
        console.error('Create taxi order error:', e);
        return res.status(500).json({ message: 'Server error' });
    }
};

module.exports.verifyPayment = async (req, res) => {
    try {
        const { bookingId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
        
        console.log('Taxi payment verification attempt:', { bookingId, razorpay_order_id, razorpay_payment_id });
        
        const booking = await TaxiBooking.findById(bookingId);
        if (!booking) {
            console.error('Booking not found:', bookingId);
            return res.status(404).json({ success: false, message: 'Booking not found' });
        }
        
        if (booking.razorpayOrderId !== razorpay_order_id) {
            console.error('Order ID mismatch:', { stored: booking.razorpayOrderId, received: razorpay_order_id });
            return res.status(400).json({ success: false, message: 'Invalid order ID' });
        }

        // Check if Razorpay key secret is available
        if (!process.env.RAZORPAY_KEY_SECRET) {
            console.error('RAZORPAY_KEY_SECRET not found in environment variables');
            return res.status(500).json({ success: false, message: 'Payment configuration error' });
        }

        const sign = `${razorpay_order_id}|${razorpay_payment_id}`;
        const expectedSign = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(sign)
            .digest('hex');

        console.log('Signature verification:', { expected: expectedSign, received: razorpay_signature });

        if (expectedSign !== razorpay_signature) {
            await TaxiBooking.findByIdAndUpdate(bookingId, { paymentStatus: 'Failed' });
            console.error('Signature verification failed');
            return res.status(400).json({ success: false, message: 'Payment verification failed' });
        }

        await TaxiBooking.findByIdAndUpdate(bookingId, {
            paymentStatus: 'Paid',
            bookingStatus: 'Confirmed',
            razorpayPaymentId: razorpay_payment_id,
        });
        
        console.log('Taxi payment verified successfully');
        return res.json({ success: true, message: 'Payment verified successfully' });
    } catch (e) {
        console.error('Verify taxi payment error:', e);
        return res.status(500).json({ success: false, message: 'Server error during verification' });
    }
};

module.exports.userBookings = async (req, res) => {
    const bookings = await TaxiBooking.find({ user: req.user._id })
        .populate('listing')
        .sort('-createdAt');
    res.render('users/taxiBookings', { bookings, currentUser: req.user });
};


