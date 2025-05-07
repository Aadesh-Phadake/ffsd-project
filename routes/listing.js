const express = require('express');
const router = express.Router();
const Listing = require('../models/listing');
const wrapAsync = require('../utils/wrapAsync');
const expressError = require('../utils/expressError');
const { isLoggedIn , isOwner, validateListing ,isOwnerOrAdmin } = require('../middleware');

const  listingController = require('../controllers/listing');

router.route('/')
    .get(wrapAsync(listingController.index)) 
    .post(isLoggedIn,validateListing,wrapAsync(listingController.create));

router.get('/new',isLoggedIn,wrapAsync(listingController.new));

router.route('/:id')
    .get(wrapAsync(listingController.show))
    .put(isLoggedIn,isOwnerOrAdmin,validateListing,wrapAsync(listingController.update))
    .delete(isLoggedIn,isOwnerOrAdmin,wrapAsync(listingController.delete));

router.get('/:id/edit',isLoggedIn, isOwnerOrAdmin ,wrapAsync(listingController.edit));

// Add payment route
// router.get('/:id/payment', isLoggedIn, wrapAsync(listingController.renderPayment));

module.exports = router;