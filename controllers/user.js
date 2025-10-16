const User = require('../models/user');
const Booking = require('../models/booking');
const Listing = require('../models/listing');
const Request = require('../models/request');

// ===============================
// AUTHENTICATION CONTROLLERS
// ===============================

module.exports.renderSignup = (req, res) => {
    res.render('users/signup');
};

module.exports.renderLogin = (req, res) => {
    res.render('users/login');
};

// ✅ Handle signup
module.exports.signup = async (req, res) => {
    try {
        let { username, email, password, role } = req.body;
        if (!['traveller', 'manager'].includes(role)) {
            req.flash('error', 'Invalid account type.');
            return res.redirect('/signup');
        }
        let user = new User({ username, email, role });
        let registeredUser = await User.register(user, password);
        req.login(registeredUser, err => {
            if (err) {
                req.flash('error', 'Login after signup failed');
                return res.redirect('/login');
            }
            req.flash('success', 'Welcome to TravelNest!');
            res.redirect('/listings');
        });
    } catch (e) {
        req.flash('error', e.message);
        res.redirect('/signup');
    }
};

// ✅ Handle login (missing function)
module.exports.login = async (req, res) => {
    req.flash('success', 'Welcome back!');
    const redirectUrl = req.session.returnTo || '/listings';
    delete req.session.returnTo;
    res.redirect(redirectUrl);
};

// ✅ Handle logout (recommended)
module.exports.logout = (req, res, next) => {
    req.logout(err => {
        if (err) return next(err);
        req.flash('success', 'Logged out successfully!');
        res.redirect('/login');
    });
};

// ===============================
// USER PROFILE + MEMBERSHIP
// ===============================

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

// ===============================
// BOOKINGS + REQUESTS
// ===============================

module.exports.createBooking = async (req, res) => {
    const listing = await Listing.findById(req.params.id);
    if (!listing) {
        req.flash('error', 'Listing not found');
        return res.redirect('/listings');
    }

    const { checkIn, checkOut, guests } = req.body;

    const parseDate = (dateStr) => {
        if (!dateStr) return null;
        if (dateStr.includes('-') && dateStr.split('-').length === 3) {
            const parts = dateStr.split('-');
            if (parts[0].length <= 2) {
                const [day, month, year] = parts.map(Number);
                const date = new Date(year, month - 1, day);
                return isNaN(date.getTime()) ? null : date;
            } else {
                const date = new Date(dateStr);
                return isNaN(date.getTime()) ? null : date;
            }
        }
        const date = new Date(dateStr);
        return isNaN(date.getTime()) ? null : date;
    };

    const checkInDate = parseDate(checkIn);
    const checkOutDate = parseDate(checkOut);

    let nights = 0;
    let serviceFee = 0;
    let totalAmount = 0;

    const numGuests = parseInt(guests) || 1;
    if (checkInDate && checkOutDate && !isNaN(checkInDate.getTime()) && !isNaN(checkOutDate.getTime())) {
        nights = Math.ceil((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24));
        if (nights > 0) {
            let baseAmount = listing.price * nights;
            if (numGuests > 2) {
                const additionalGuestFee = (numGuests - 2) * 500 * nights;
                baseAmount += additionalGuestFee;
            }

            const isActiveMember = req.user && req.user.isMember && req.user.membershipExpiresAt && new Date(req.user.membershipExpiresAt) > new Date();
            serviceFee = isActiveMember ? 0 : Math.round(baseAmount * 0.1);
            totalAmount = baseAmount + serviceFee;
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

// ===============================
// (All your remaining functions stay the same)
// ===============================

// Include all other methods: createRequest, getOwnerRequests, ownerDashboard,
// searchDashboard, getUserHotels, adminDashboard, updateRequestStatus,
// deleteBooking, renderCancelConfirm, confirmCancellation,
// getCancellationDetails, confirmCancellationAjax, activateMembershipAjax
// (no change needed there — your logic was perfect)
