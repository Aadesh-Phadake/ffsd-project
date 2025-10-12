const Listing = require('../models/listing');

module.exports.index = async (req, res) => {
    let { search, price, rating } = req.query;
    let filter = {};

    if (search) {
        filter.$or = [
            { title: { $regex: search, $options: 'i' } },
            { location: { $regex: search, $options: 'i' } }
        ];
    }

    if (price) {
        if (price === '0-1000') {
            filter.price = { $lte: 1000 };
        } else if (price === '1000-2000') {
            filter.price = { $gt: 1000, $lte: 2000 };
        } else if (price === '2000-3000') {
            filter.price = { $gt: 2000, $lte: 3000 };
        } else if (price === '3000+') {
            filter.price = { $gt: 3000 };
        }
    }

    let listings = await Listing.find(filter).populate('reviews');

    if (rating) {
        listings = listings.filter(listing => {
            if (listing.reviews && listing.reviews.length > 0) {
                const avgRating = listing.reviews.reduce((sum, review) => sum + review.rating, 0) / listing.reviews.length;
                return avgRating >= parseInt(rating);
            }
            return false;
        });
    }

    res.render('listings/index.ejs', { listings });
};

module.exports.search = async (req, res) => {
    let { search, price, rating } = req.query;
    let filter = {};

    if (search) {
        filter.$or = [
            { title: { $regex: search, $options: 'i' } },
            { location: { $regex: search, $options: 'i' } }
        ];
    }

    if (price) {
        if (price === '0-1000') {
            filter.price = { $lte: 1000 };
        } else if (price === '1000-2000') {
            filter.price = { $gt: 1000, $lte: 2000 };
        } else if (price === '2000-3000') {
            filter.price = { $gt: 2000, $lte: 3000 };
        } else if (price === '3000+') {
            filter.price = { $gt: 3000 };
        }
    }

    let listings = await Listing.find(filter).populate('reviews');

    if (rating) {
        listings = listings.filter(listing => {
            if (listing.reviews && listing.reviews.length > 0) {
                const avgRating = listing.reviews.reduce((sum, review) => sum + review.rating, 0) / listing.reviews.length;
                return avgRating >= parseInt(rating);
            }
            return false;
        });
    }

    // Return JSON for AJAX requests
    res.json({ 
        success: true, 
        listings: listings,
        count: listings.length 
    });
};

module.exports.new = async (req, res) => {
    res.render('listings/new.ejs');
};

module.exports.show = async (req, res) => {
    try {
        const { sortBy } = req.query;
        let sortOption = {};
        
        // Define sort options for reviews
        switch (sortBy) {
            case 'newest':
                sortOption = { createdAt: -1 }; // newest first
                break;
            case 'oldest':
                sortOption = { createdAt: 1 }; // oldest first
                break;
            case 'highest':
                sortOption = { rating: -1 }; // highest rating first
                break;
            case 'lowest':
                sortOption = { rating: 1 }; // lowest rating first
                break;
            default:
                sortOption = { createdAt: -1 }; // default to newest first
        }
        
        const listing = await Listing.findById(req.params.id)
            .populate({ 
                path: 'reviews', 
                populate: { path: 'author' },
                options: { sort: sortOption }
            })
            .populate('owner');

        if (!listing) {
            req.flash('error', 'Hotel not found!');
            return res.redirect('/listings');
        }

        const now = new Date();
        const lastUpdated = new Date(listing.lastUpdated);
        const twoMonths = 2 * 30 * 24 * 60 * 60 * 1000;
        const fiveDays = 5 * 24 * 60 * 60 * 1000;
        const timeSinceLastUpdated = now - lastUpdated;

        if (req.user && listing.owner.equals(req.user._id)) {
            if (timeSinceLastUpdated >= (twoMonths - fiveDays) && timeSinceLastUpdated < twoMonths) {
                req.flash('warning', 'Your hotel will be deleted in less than 5 days!');
            }

            if (timeSinceLastUpdated >= twoMonths) {
                await Listing.findByIdAndDelete(req.params.id);
                req.flash('error', 'Your hotel has been deleted due to inactivity.');
                return res.redirect('/listings');
            }
        } else {
            if (timeSinceLastUpdated >= twoMonths) {
                await Listing.findByIdAndDelete(req.params.id);
                req.flash('error', 'This hotel has been deleted due to inactivity.');
                return res.redirect('/listings');
            }
        }

        // Show page without offers/discounts
        res.render('listings/show.ejs', { listing, offer: null, finalPrice: listing.price, sortBy: sortBy || 'newest' });

    } catch (error) {
        console.error(error);
        req.flash('error', 'An error occurred while fetching the listing.');
        res.redirect('/listings');
    }
};

module.exports.create = async (req, res, next) => {
    if (!req.body) throw new expressError(400, 'Send valid data.');
    const listing = new Listing(req.body);
    listing.owner = req.user._id;
    await listing.save();
    req.flash('success', 'Hotel listed successfully!');
    res.redirect(`/listings`);
};

module.exports.edit = async (req, res) => {
    const listing = await Listing.findById(req.params.id);
    if (!listing) {
        req.flash('error', 'Hotel not found!');
        return res.redirect('/listings');
    }
    res.render('listings/edit.ejs', { listing });
};

module.exports.update = async (req, res, next) => {
    if (!req.body) throw new expressError(400, 'Send valid data.');
    await Listing.findByIdAndUpdate(req.params.id, { ...req.body, lastUpdated: Date.now() });
    req.flash('success', 'Hotel updated successfully!');
    res.redirect(`/listings/${req.params.id}`);
};

module.exports.delete = async (req, res) => {
    let deletedListing = await Listing.findByIdAndDelete(req.params.id);
    req.flash('error', 'Hotel deleted successfully!');
    console.log(deletedListing);
    res.redirect(`/listings`);
};

module.exports.renderPayment = async (req, res) => {
    const { id } = req.params;
    const { checkIn, checkOut, guests } = req.query;

    const listing = await Listing.findById(id);
    if (!listing) {
        req.flash('error', 'Listing not found');
        return res.redirect('/listings');
    }

    const parseDate = (dateStr) => {
        if (!dateStr) return null;
        
        // Handle DD-MM-YYYY format (like '14-10-2025')
        if (dateStr.includes('-') && dateStr.split('-').length === 3) {
            const parts = dateStr.split('-');
            if (parts[0].length <= 2) {
                // DD-MM-YYYY format
                const [day, month, year] = parts.map(Number);
                const date = new Date(year, month - 1, day); // month is 0-indexed
                return isNaN(date.getTime()) ? null : date;
            } else {
                // YYYY-MM-DD format
                const date = new Date(dateStr);
                return isNaN(date.getTime()) ? null : date;
            }
        }
        
        // Fallback: try standard Date parsing
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
            // Calculate base amount: price per night * nights (for up to 2 guests)
            let baseAmount = listing.price * nights;
            
            // Add ₹500 per night for each guest beyond 2
            let additionalGuestFee = 0;
            if (numGuests > 2) {
                additionalGuestFee = (numGuests - 2) * 500 * nights;
                baseAmount += additionalGuestFee;
            }
            
            // Check if user has active membership for service fee discount
            const isActiveMember = req.user && req.user.isMember && req.user.membershipExpiresAt && new Date(req.user.membershipExpiresAt) > new Date();
            serviceFee = isActiveMember ? 0 : Math.round(baseAmount * 0.1); // 10% service fee or free for members
            totalAmount = baseAmount + serviceFee;
        }
    }

    res.render('listings/payment', {
        listing,
        checkIn,
        checkOut,
        guests: parseInt(guests) || 1,
        nights: nights || 0,
        serviceFee: serviceFee || 0,
        totalAmount: totalAmount || 0
    });
};
