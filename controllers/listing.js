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

module.exports.new = async (req, res) => {
    res.render('listings/new.ejs');
};

module.exports.show = async (req, res) => {
    try {
        const listing = await Listing.findById(req.params.id)

            .populate({ path: 'reviews', populate: { path: 'author' } })
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
        res.render('listings/show.ejs', { listing, offer: null, finalPrice: listing.price });


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
        const parts = dateStr.split('-');
        if (parts.length !== 3) return null;
        const [day, month, year] = parts;
        return new Date(year, month - 1, day);
    };

    const checkInDate = parseDate(checkIn);
    const checkOutDate = parseDate(checkOut);

    let nights = 0;
    let serviceFee = 0;
    let totalAmount = 0;

    if (checkInDate && checkOutDate && !isNaN(checkInDate.getTime()) && !isNaN(checkOutDate.getTime())) {
        nights = Math.ceil((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24));
        if (nights > 0) {
            serviceFee = Math.round(listing.price * nights * 0.1);
            totalAmount = (listing.price * nights) + serviceFee;
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
