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
router.post('/membership/activate', isLoggedIn, wrapAsync(userController.activateMembership));

router.get('/profile/cancel/:id', isLoggedIn, wrapAsync(userController.deleteBooking));
router.get('/profile/cancel/confirm/:id', isLoggedIn, wrapAsync(userController.renderCancelConfirm));
router.post('/profile/cancel/confirm/:id', isLoggedIn, wrapAsync(userController.confirmCancellation));

router.post('/listings/:id/book', isLoggedIn, wrapAsync(userController.createBooking));

// Simple dashboard
router.get('/dashboard', isLoggedIn, wrapAsync(userController.ownerDashboard));

// AJAX API Routes
router.get('/api/profile/cancel/:id/details', isLoggedIn, wrapAsync(userController.getCancellationDetails));
router.post('/api/profile/cancel/:id/confirm', isLoggedIn, wrapAsync(userController.confirmCancellationAjax));
router.post('/api/membership/activate', isLoggedIn, wrapAsync(userController.activateMembershipAjax));

module.exports = router;