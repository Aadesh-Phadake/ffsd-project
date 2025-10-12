const Listing = require('./models/listing');
const expressError = require('./utils/expressError');
const {listingSchema , reviewSchema} = require('./schema');
const Review = require('./models/review');


module.exports.isLoggedIn = (req, res, next) => {
    if(!req.isAuthenticated()){
        req.session.redirectUrl = req.originalUrl;
        req.flash('error', 'Login required!');
        return res.redirect('/login');
    }
    next(); 
}
module.exports.saveRedirectUrl = (req, res, next) => {
    res.locals.redirectUrl = req.session.redirectUrl || '/listings';
    next();
}

module.exports.isOwner = async (req, res, next) => {
    const {id} = req.params;
    const listing = await Listing.findById(id);
    if (!listing.owner.equals(res.locals.currentUser._id)){
        req.flash('error', 'You do not have permission to do that!');
        return res.redirect(`/listings/${id}`);
    }
    next();
}

module.exports.isOwnerOrAdmin = async (req, res, next) => {
    const { id } = req.params;
    const listing = await Listing.findById(id);
    
    // Check if user is the owner of the listing or has admin role
    if (
        !listing.owner.equals(res.locals.currentUser._id) &&
        res.locals.currentUser.role !== 'admin'
    ) {
        req.flash("error", "You do not have permission to do that!");
        return res.redirect(`/listings/${id}`);
    }

    next();
};


module.exports.validateListing = (req,res,next) => {
    let {error} = listingSchema.validate(req.body);
    if(error){
        const msg = error.details.map(el => el.message).join(',');
        throw new expressError(400, msg);
    }
    else{
        next();
    }
}

module.exports.validateReview = (req, res, next) => {
    let {error} = reviewSchema.validate(req.body);
    if(error){
        const msg = error.details.map(el => el.message).join(',');
        throw new expressError(400, msg);
    }
    else{
        next();
    }
};

module.exports.isAuthor = async (req, res, next) => {
    const {id,reviewId} = req.params;
    const review = await Review.findById(reviewId);
    if(!review.author.equals(res.locals.currentUser._id)){
        req.flash('error', 'You do not have permission to do that!');
        return res.redirect(`/listings/${id}`);
    }
    next();
}

// Role-based middleware
module.exports.requireRole = (allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            req.flash('error', 'You must be logged in');
            return res.redirect('/login');
        }
        
        if (!allowedRoles.includes(req.user.role)) {
            req.flash('error', 'Access denied. Insufficient permissions.');
            return res.redirect('/');
        }
        
        next();
    };
};

module.exports.requireTraveller = module.exports.requireRole(['traveller']);
module.exports.requireManager = module.exports.requireRole(['manager']);
module.exports.requireAdmin = module.exports.requireRole(['admin']);
module.exports.requireManagerOrAdmin = module.exports.requireRole(['manager', 'admin']);
module.exports.requireTravellerOrManager = module.exports.requireRole(['traveller', 'manager']);
