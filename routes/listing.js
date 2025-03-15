const express = require('express');
const router = express.Router();
const Listing = require('../models/listing');
const wrapAsync = require('../utils/wrapAsync');
const expressError = require('../utils/expressError');
const { isLoggedIn , isOwner, validateListing } = require('../middleware');

const  listingController = require('../controllers/listing');

router.route('/')
    .get(wrapAsync(listingController.index)) 
    .post(isLoggedIn,validateListing,wrapAsync(listingController.create));

router.get('/new',isLoggedIn,wrapAsync(listingController.new));

router.route('/:id')
    .get(wrapAsync(listingController.show))
    .put(isLoggedIn,isOwner,validateListing,wrapAsync(listingController.update))
    .delete(isLoggedIn,isOwner,wrapAsync(listingController.delete));

router.get('/:id/edit',isLoggedIn,isOwner,wrapAsync(listingController.edit));

module.exports = router;