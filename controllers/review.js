const Listing = require('../models/listing');
const Review = require('../models/review');
const expressError = require('../utils/expressError');
const { reviewSchema } = require('../schema');

module.exports.postReview = async (req, res) => {
    let listing = await Listing.findById(req.params.id);
    let review = new Review(req.body);
    review.author = req.user._id;
    listing.reviews.push(review);
    await review.save();
    await listing.save();
    req.flash('success', 'Review posted successfully!');
    res.redirect(`/listings/${req.params.id}`);
};

module.exports.deleteReview = async (req, res) => {
    let {id,reviewId} = req.params;
    await Listing.findByIdAndUpdate(id,{$pull: {reviews: reviewId}});
    await Review.findByIdAndDelete(reviewId);
    req.flash('error', 'Review deleted successfully!');
    res.redirect(`/listings/${id}`);
};

module.exports.createReview = async (req, res) => {
    const listing = await Listing.findById(req.params.id)
        .populate('bookings');
    
    if (!listing) {
        req.flash('error', 'Listing not found');
        return res.redirect('/listings');
    }

    // Check if user has booked and stayed at the property
    const hasBooked = listing.bookings.some(booking => 
        booking.user.equals(req.user._id) && 
        new Date(booking.checkOut) < new Date()
    );

    if (!hasBooked) {
        req.flash('error', 'You can only review properties you have stayed at');
        return res.redirect(`/listings/${listing._id}`);
    }

    const { error } = reviewSchema.validate(req.body);
    if (error) {
        const msg = error.details.map(el => el.message).join(',');
        throw new expressError(400, msg);
    }

    const review = new Review(req.body.review);
    review.author = req.user._id;
    listing.reviews.push(review);
    await review.save();
    await listing.save();
    req.flash('success', 'Created new review!');
    res.redirect(`/listings/${listing._id}`);
};