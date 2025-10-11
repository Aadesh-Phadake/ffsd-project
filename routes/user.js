const express = require('express');
const router = express.Router();
const passport = require('passport');
const User = require('../models/user');
const wrapAsync = require('../utils/wrapAsync');
const {saveRedirectUrl, isLoggedIn} = require('../middleware');
const Listing = require('../models/listing');
const Booking = require('../models/booking')

const userController = require('../controllers/user');

router.route('/signup')
    .get(userController.renderSignup)
    .post(wrapAsync(userController.signup));

router.route('/login')
    .get(userController.renderLogin)
    .post(saveRedirectUrl, passport.authenticate('local', {failureFlash: true, failureRedirect: '/login'}),userController.login);
 
router.get('/logout', userController.logout);

router.get('/profile', isLoggedIn, wrapAsync(userController.renderProfile));

router.get('/profile/cancel/:id', isLoggedIn, wrapAsync(userController.deleteBooking));

router.post('/listings/:id/book', isLoggedIn, wrapAsync(userController.createBooking));
router.get('/dashboard', isLoggedIn ,async (req, res) => {
    try {
        // 1. Extract userId from cookies
        const userId = req.user._id;
        if (!userId) {
            return res.status(401).json({ message: 'Unauthorized: No user ID found in cookies' });
        }

        // 2. Find listings owned by this user
        const userListings = await Listing.find({ owner: userId }, '_id');
        const listingIds = userListings.map(listing => listing._id);

        // 3. Find bookings where listing is in those listingIds
        const bookings = await Booking.find({ listing: { $in: listingIds } })
            .populate('user', 'name email')       // Optional: populate user details
            .populate('listing', 'title location') // Optional: populate listing details
            .exec();

        // 4. Send the bookings to frontend
        res.status(200).render('listings/dashboard.ejs',{bookings, currentUser: req.user});
        
        // res.status(200).json({ bookings });

    } catch (err) {
        console.error('Dashboard route error:', err);
        res.status(500).json({ message: 'Server error while fetching dashboard data' });
    }
});

router.get('/dashboard/search', isLoggedIn, wrapAsync(userController.searchDashboard));

router.get('/dashboard/hotels', isLoggedIn, wrapAsync(userController.getUserHotels));

module.exports = router;