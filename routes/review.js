const express = require('express'); 
const router = express.Router({mergeParams: true});
const Listing = require('../models/listing');
const Review = require('../models/review');
const wrapAsync = require('../utils/wrapAsync');
const {isLoggedIn , validateReview, isAuthor} = require('../middleware');
const reviewController = require('../controllers/review');
// post review route
router.post('/',isLoggedIn,validateReview,wrapAsync(reviewController.postReview));
//delete review route
router.delete('/:reviewId',isLoggedIn,isAuthor,wrapAsync(reviewController.deleteReview));

module.exports = router;