const User = require('../models/user');
const Booking = require('../models/booking');
const Listing = require('../models/listing');

module.exports.renderSignup = (req, res) => {
    res.render('users/signup');
};

module.exports.renderManagerSignup = (req, res) => {
    res.render('users/manager-signup');
};

module.exports.signup = async (req, res) => {
    try{
        let {username, email, password, role, businessName, phoneNumber, businessDescription} = req.body;
        
        // Validate password confirmation
        if (req.body.confirmPassword !== password) {
            req.flash('error', 'Passwords do not match');
            return res.redirect('/signup');
        }
        
        // Create user object with role
        let userData = {username, email, role: role || 'user'};
        
        // Add manager-specific fields if role is manager
        if (role === 'manager') {
            userData.businessName = businessName;
            userData.phoneNumber = phoneNumber;
            userData.businessDescription = businessDescription;
        }
        
        let user = new User(userData);
        let registeredUser = await User.register(user, password);
        
        req.login(registeredUser, err => {
            if(err) return next(err);
            
            // Different welcome messages based on role
            if (role === 'manager') {
                req.flash('success', 'Welcome to TravelNest! Your manager account has been created successfully.');
            } else {
                req.flash('success', 'Welcome to TravelNest! Your account has been created successfully.');
            }
            
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
    console.log('Login successful for user:', req.user.username);
    console.log('User role:', req.user.role);
    console.log('Redirect URL:', res.locals.redirectUrl);
    
    req.flash('success', 'Welcome back to TravelNest!');
    
    // Role-based redirects
    if (req.user.role === 'admin') {
        console.log('Admin user detected, redirecting to admin panel');
        return res.redirect('/admin');
    } else if (req.user.role === 'manager') {
        console.log('Manager user detected, redirecting to manager dashboard');
        return res.redirect('/manager');
    }
    
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
    
    // Parse the dates (now in YYYY-MM-DD format from HTML5 date input)
    const parseDate = (dateStr) => {
        if (!dateStr) return null;
        // HTML5 date input provides YYYY-MM-DD format
        return new Date(dateStr);
    };

    const checkInDate = parseDate(checkIn);
    const checkOutDate = parseDate(checkOut);

    let nights = 0;
    let guestsFee = 0;
    let adminFee = 0;
    let totalAmount = 0;

    // Calculate values if dates are valid, otherwise use 0
    if (checkInDate && checkOutDate && !isNaN(checkInDate.getTime()) && !isNaN(checkOutDate.getTime())) {
        nights = Math.ceil((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24));
        if (nights > 0) {
            const numGuests = parseInt(guests) || 1;
            const baseTotal = listing.price * nights;
            
            // Guest fee: ₹500 per extra guest per night (after 2 guests)
            guestsFee = numGuests > 2 ? (numGuests - 2) * 500 * nights : 0;
            
            // Admin fee: 5% of subtotal
            const subtotal = baseTotal + guestsFee;
            adminFee = Math.round(subtotal * 0.05);
            
            totalAmount = subtotal + adminFee;
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