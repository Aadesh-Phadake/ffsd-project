const Listing = require('../models/listing');
const Review = require('../models/review');

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