const Listing = require('../models/listing');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.resolve(__dirname, '../init/offers.db');
const db = new sqlite3.Database(dbPath);
module.exports.index = async (req, res) => {
    let { search, price, rating } = req.query;
    
    // Build the filter object
    let filter = {};
    
    // Combined search for title and location (case-insensitive)
    if (search) {
        filter.$or = [
            { title: { $regex: search, $options: 'i' } },
            { location: { $regex: search, $options: 'i' } }
        ];
    }
    
    // Price range filter
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

    // Get listings with populated reviews
    let listings = await Listing.find(filter).populate('reviews');

    // Filter by rating if specified
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

module.exports.new = async(req, res) => {
    res.render('listings/new.ejs');
};

module.exports.show = async (req, res) => { 
    try {
        const listing = await Listing.findById(req.params.id)
            .populate({path: 'reviews', populate: {path: 'author'}})
            .populate('owner')
            .populate('bookings');
            
        if(!listing){
            req.flash('error', 'Hotel not found!');
            return res.redirect('/listings');
        }

        // Check if the current user is the owner
        if (req.user && listing.owner.equals(req.user._id)) {
            const now = new Date();
            const lastUpdated = new Date(listing.lastUpdated);
            const twoMonths = 2 * 30 * 24 * 60 * 60 * 1000; // Approximation of 2 months in milliseconds
            const fiveDays = 5 * 24 * 60 * 60 * 1000; // 5 days in milliseconds

            const timeSinceLastUpdated = now - lastUpdated;

            // Show flash alert if within the last 5 days of 2 months
            if (timeSinceLastUpdated >= (twoMonths - fiveDays) && timeSinceLastUpdated < twoMonths) {
                req.flash('warning', 'Your hotel will be deleted in less than 5 days!');
            }

            // Delete the hotel if it has been more than 2 months
            if (timeSinceLastUpdated >= twoMonths) {
                await Listing.findByIdAndDelete(req.params.id);
                req.flash('error', 'Your hotel has been deleted due to inactivity.');
                return res.redirect('/listings');
            }
        }else{
            const now = new Date();
            const lastUpdated = new Date(listing.lastUpdated);
            const twoMonths = 2 * 30 * 24 * 60 * 60 * 1000; // Approximation of 2 months in milliseconds

            const timeSinceLastUpdated = now - lastUpdated;
            if (timeSinceLastUpdated >= twoMonths) {
                await Listing.findByIdAndDelete(req.params.id);
                req.flash('error', 'This hotel has been deleted due to inactivity.');
                return res.redirect('/listings');
            }
        }

        // Fetch the current offer
        db.get("SELECT * FROM offers WHERE isActive = 1", (err, offer) => {
            if (err) {
                console.error(err.message);
                return res.render('listings/show.ejs', { listing });
            }

            let discount = 0;
            if (offer) {
                discount = (listing.price * offer.discountPercentage) / 100;
            }

            const finalPrice = listing.price - discount;

            res.render('listings/show.ejs', { listing, offer, finalPrice });
        });
    } catch (error) {
        console.error(error);
        req.flash('error', 'An error occurred while fetching the listing.');
        res.redirect('/listings');
    }
};

module.exports.create  =async (req, res, next) => {
    if(!req.body)throw new expressError(400,'Send valid data.');
    const listing = new Listing(req.body);
    listing.owner = req.user._id;
    await listing.save();
    req.flash('success', 'Hotel listed successfully!');
    res.redirect(`/listings`);
};

module.exports.edit = async (req, res) => {
    const listing = await Listing.findById(req.params.id);
    if(!listing){
        req.flash('error', 'Hotel not found!');
        return res.redirect('/listings');
    }
    res.render('listings/edit.ejs', {listing: listing});
};

module.exports.update = async (req, res,next) => { 
    if(!req.body)throw new expressError(400,'Send valid data.');
    await Listing.findByIdAndUpdate(req.params.id, {...req.body,lastUpdated: Date.now()});
    req.flash('success', 'Hotel updated successfully!');
    res.redirect(`/listings/${req.params.id}`);
};

module.exports.delete = async (req, res) => {
    let deletedListing = await Listing.findByIdAndDelete(req.params.id);
    req.flash('error', 'Hotel deleted successfully!');
    console.log(deletedListing);
    res.redirect(`/listings`);
}

module.exports.renderPayment = async (req, res) => {
    const { id } = req.params;
    const { checkIn, checkOut, guests } = req.query;
    
    const listing = await Listing.findById(id);
    if (!listing) {
        req.flash('error', 'Listing not found');
        return res.redirect('/listings');
    }

    // Parse the dates
    const parseDate = (dateStr) => {
        const parts = dateStr.split('-');
        if (parts.length !== 3) return null;
        const [day, month, year] = parts;
        // Month is 0-based in JavaScript Date
        return new Date(year, month - 1, day);
    };

    const checkInDate = parseDate(checkIn);
    const checkOutDate = parseDate(checkOut);

    let nights = 0;
    let serviceFee = 0;
    let totalAmount = 0;

    // Calculate values if dates are valid, otherwise use 0
    if (checkInDate && checkOutDate && !isNaN(checkInDate.getTime()) && !isNaN(checkOutDate.getTime())) {
        nights = Math.ceil((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24));
        if (nights > 0) {
            serviceFee = Math.round(listing.price * nights * 0.1);
            totalAmount = (listing.price * nights) + serviceFee;
        }
    }

    // Proceed with rendering even if calculations resulted in NaN
    res.render('listings/payment', {
        listing,
        checkIn,
        checkOut,
        guests: parseInt(guests) || 1, // Default to 1 guest if parsing fails
        nights: nights || 0, // Use 0 if calculation failed
        serviceFee: serviceFee || 0, // Use 0 if calculation failed
        totalAmount: totalAmount || 0 // Use 0 if calculation failed
    });
};

