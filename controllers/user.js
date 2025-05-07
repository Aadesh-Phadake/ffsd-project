const User = require('../models/user');
const Booking = require('../models/booking');
const Listing = require('../models/listing');
const Razorpay = require('razorpay');
const crypto = require('crypto');

// Initialize Razorpay
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

module.exports.renderSignup = (req, res) => {
    res.render('users/signup');
};

module.exports.signup = async (req, res) => {
    try{
    let {username, email, password} = req.body;
    let user = new User({username, email});
    let registeredUser = await User.register(user, password);
    req.login(registeredUser, err => {
        if(err) return next(err);
        req.flash('success', 'Welcome to TravelNest!');
        res.redirect('/listings');
    });
    
    } catch(e){
        req.flash('error', e.message);
        res.redirect('/signup');
    }
};

module.exports.renderLogin = (req, res) => {
    res.render('users/login');
};

module.exports.login = async (req, res) => {
    req.flash('success', 'Welcome back to TravelNest!');
    res.redirect(res.locals.redirectUrl || '/listings');
};

module.exports.logout = (req, res,next) => {
    req.logout((err)=>{
        if(err) return next(err);
    });
    req.flash('success', 'Logged out successfully!');
    res.redirect('/listings');
};

module.exports.renderProfile = async (req, res) => {
    const bookings = await Booking.find({ user: req.user._id })
        .populate('listing')
        .sort('-createdAt');
    res.render('users/profile', { bookings });
};

module.exports.createBooking = async (req, res) => {
    try {
        const listing = await Listing.findById(req.params.id);
        if (!listing) {
            req.flash('error', 'Listing not found');
            return res.redirect('/listings');
        }

        const { checkIn, checkOut, guests, razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;

        // Verify payment signature
        const generated_signature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(razorpay_order_id + "|" + razorpay_payment_id)
            .digest('hex');

        if (generated_signature !== razorpay_signature) {
            req.flash('error', 'Payment verification failed');
            return res.redirect(`/listings/${listing._id}/payment?checkIn=${checkIn}&checkOut=${checkOut}&guests=${guests}`);
        }

        // Calculate booking details
        const parseDate = (dateStr) => {
            const parts = dateStr.split('-');
            if (parts.length !== 3) return null;
            const [day, month, year] = parts;
            return new Date(year, month - 1, day);
        };

        const checkInDate = parseDate(checkIn);
        const checkOutDate = parseDate(checkOut);
        let nights = 0;
        let serviceFee = 0;
        let totalAmount = 0;

        if (checkInDate && checkOutDate && !isNaN(checkInDate.getTime()) && !isNaN(checkOutDate.getTime())) {
            nights = Math.ceil((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24));
            if (nights > 0) {
                serviceFee = Math.round(listing.price * nights * 0.1);
                totalAmount = (listing.price * nights) + serviceFee;
            }
        }

        // Create booking
        const booking = new Booking({
            user: req.user._id,
            listing: listing._id,
            checkIn,
            checkOut,
            guests: parseInt(guests) || 1,
            totalAmount: totalAmount || 0,
            paymentId: razorpay_payment_id,
            orderId: razorpay_order_id,
            paymentSignature: razorpay_signature,
            paymentStatus: 'completed'
        });

        await booking.save();
        
        // Add booking to listing
        listing.bookings.push(booking._id);
        await listing.save();

        req.flash('success', 'Booking confirmed successfully!');
        res.redirect('/profile');
    } catch (error) {
        console.error('Booking error:', error);
        req.flash('error', 'An error occurred during booking');
        res.redirect('/listings');
    }
};