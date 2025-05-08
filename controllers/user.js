const User = require('../models/user');
const Booking = require('../models/booking');
const Listing = require('../models/listing');

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
    const listing = await Listing.findById(req.params.id);
    if (!listing) {
        req.flash('error', 'Listing not found');
        return res.redirect('/listings');
    }

    const { checkIn, checkOut, guests } = req.body;
    
    // Parse the dates
    const parseDate = (dateStr) => {
        const parts = dateStr.split('-');
        if (parts.length !== 3) return null;
        const [day, month, year] = parts;
        // Month is 0-based in JavaScript Date
        return new Date(year, month - 1, day);
    };

    const checkInDate = parseDate(checkIn);
    const checkOutDate = parseDate(checkOut);

    let nights = 0;
    let serviceFee = 0;
    let totalAmount = 0;

    // Calculate values if dates are valid, otherwise use 0
    if (checkInDate && checkOutDate && !isNaN(checkInDate.getTime()) && !isNaN(checkOutDate.getTime())) {
        nights = Math.ceil((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24));
        if (nights > 0) {
            serviceFee = Math.round(listing.price * nights * 0.1);
            totalAmount = (listing.price * nights) + serviceFee;
        }
    }

    const booking = new Booking({
        user: req.user._id,
        listing: listing._id,
        checkIn,
        checkOut,
        guests: parseInt(guests) || 1,
        totalAmount: totalAmount || 0
    });

    await booking.save();
    req.flash('success', 'Booking confirmed successfully!');
    res.redirect('/profile');
};
module.exports.deleteBooking = async (req, res) => {
    const { id } = req.params;
    await Booking.findByIdAndDelete(id);
    req.flash('success', 'Booking deleted successfully!');
    res.redirect('/profile');
};