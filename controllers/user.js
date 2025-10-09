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

module.exports.activateMembership = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        if (!user) {
            req.flash('error', 'User not found');
            return res.redirect('/profile');
        }
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
        req.flash('success', 'Membership activated for 30 days!');
        res.redirect('/profile');
    } catch (e) {
        req.flash('error', 'Could not activate membership');
        res.redirect('/profile');
    }
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
            const isActiveMember = req.user && req.user.isMember && req.user.membershipExpiresAt && new Date(req.user.membershipExpiresAt) > new Date();
            serviceFee = isActiveMember ? 0 : Math.round(listing.price * nights * 0.1);
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
    const booking = await Booking.findById(id).populate('listing');
    
    if (!booking) {
        req.flash('error', 'Booking not found');
        return res.redirect('/profile');
    }

    // Check if user owns this booking
    if (!booking.user.equals(req.user._id)) {
        req.flash('error', 'Unauthorized');
        return res.redirect('/profile');
    }

    // Calculate cancellation fee
    const isActiveMember = req.user && req.user.isMember && req.user.membershipExpiresAt && new Date(req.user.membershipExpiresAt) > new Date();
    const now = new Date();
    
    // Initialize cancellation tracking if not set (for existing members)
    if (isActiveMember && !req.user.freeCancellationsResetAt) {
        req.user.freeCancellationsResetAt = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        req.user.freeCancellationsUsed = 0;
        await req.user.save();
    }
    
    // Reset free cancellations if it's a new month for members
    if (isActiveMember && req.user.freeCancellationsResetAt && now > req.user.freeCancellationsResetAt) {
        req.user.freeCancellationsUsed = 0;
        req.user.freeCancellationsResetAt = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        await req.user.save();
    }

    let cancellationFee = 0;
    let canUseFreeCancellation = false;

    if (isActiveMember && req.user.freeCancellationsUsed < 2) {
        canUseFreeCancellation = true;
        cancellationFee = 0;
    } else {
        cancellationFee = Math.round(booking.totalAmount * 0.1); // 10% fee
    }

    // Store cancellation details in session for confirmation
    req.session.cancellationDetails = {
        bookingId: id,
        cancellationFee,
        canUseFreeCancellation,
        bookingAmount: booking.totalAmount
    };

    res.redirect(`/profile/cancel/confirm/${id}`);
};

module.exports.renderCancelConfirm = async (req, res) => {
    const { id } = req.params;
    const booking = await Booking.findById(id).populate('listing');
    
    if (!booking) {
        req.flash('error', 'Booking not found');
        return res.redirect('/profile');
    }

    const cancellationDetails = req.session.cancellationDetails;
    if (!cancellationDetails || cancellationDetails.bookingId !== id) {
        req.flash('error', 'Invalid cancellation request');
        return res.redirect('/profile');
    }

    res.render('users/cancel-confirm', { 
        booking, 
        cancellationDetails,
        currentUser: req.user 
    });
};

module.exports.confirmCancellation = async (req, res) => {
    const { id } = req.params;
    const cancellationDetails = req.session.cancellationDetails;
    
    if (!cancellationDetails || cancellationDetails.bookingId !== id) {
        req.flash('error', 'Invalid cancellation request');
        return res.redirect('/profile');
    }

    const booking = await Booking.findById(id);
    if (!booking) {
        req.flash('error', 'Booking not found');
        return res.redirect('/profile');
    }

    // Update user's free cancellation count if applicable
    if (cancellationDetails.canUseFreeCancellation) {
        req.user.freeCancellationsUsed += 1;
        if (!req.user.freeCancellationsResetAt) {
            const now = new Date();
            req.user.freeCancellationsResetAt = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        }
        await req.user.save();
    }

    // Delete the booking
    await Booking.findByIdAndDelete(id);
    
    // Clear session data
    delete req.session.cancellationDetails;

    if (cancellationDetails.cancellationFee > 0) {
        req.flash('success', `Booking cancelled successfully! Cancellation fee: ₹${cancellationDetails.cancellationFee}`);
    } else {
        req.flash('success', 'Booking cancelled successfully! No cancellation fee (free cancellation used).');
    }
    
    res.redirect('/profile');
};