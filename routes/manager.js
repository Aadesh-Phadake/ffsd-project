const express = require('express');
const router = express.Router();
const { isLoggedIn, requireManager } = require('../middleware');
const Listing = require('../models/listing');
const Booking = require('../models/booking');
const wrapAsync = require('../utils/wrapAsync');

// Manager Dashboard
router.get('/dashboard', isLoggedIn, requireManager, wrapAsync(async (req, res) => {
    res.render('manager/dashboard', { currentUser: req.user });
}));

// API Routes for Manager Dashboard (AJAX)
router.get('/api/hotels', isLoggedIn, requireManager, wrapAsync(async (req, res) => {
    try {
        const hotels = await Listing.find({ owner: req.user._id })
            .sort('-createdAt');
        
        // Add booking statistics for each hotel
        const hotelsWithStats = await Promise.all(hotels.map(async (hotel) => {
            const bookings = await Booking.find({ listing: hotel._id });
            const totalBookings = bookings.length;
            const totalRevenue = bookings.reduce((sum, booking) => sum + (booking.totalAmount || 0), 0);
            const recentBookings = bookings.slice(0, 5); // Last 5 bookings
            
            return {
                _id: hotel._id,
                title: hotel.title,
                location: hotel.location,
                country: hotel.country,
                price: hotel.price,
                images: hotel.images,
                createdAt: hotel.createdAt,
                totalBookings,
                totalRevenue,
                recentBookings
            };
        }));
        
        res.json({ success: true, hotels: hotelsWithStats });
    } catch (error) {
        console.error('Error fetching manager hotels:', error);
        res.status(500).json({ error: 'Failed to fetch hotels' });
    }
}));

// API to get all bookings for manager's hotels
router.get('/api/bookings', isLoggedIn, requireManager, wrapAsync(async (req, res) => {
    try {
        const managerHotels = await Listing.find({ owner: req.user._id }, '_id');
        const hotelIds = managerHotels.map(hotel => hotel._id);
        
        const bookings = await Booking.find({ listing: { $in: hotelIds } })
            .populate('user', 'username email')
            .populate('listing', 'title location images')
            .sort('-createdAt');
        
        res.json({ success: true, bookings });
    } catch (error) {
        console.error('Error fetching manager bookings:', error);
        res.status(500).json({ error: 'Failed to fetch bookings' });
    }
}));

// API to get taxi bookings for manager's hotels
router.get('/api/taxi-bookings', isLoggedIn, requireManager, wrapAsync(async (req, res) => {
    try {
        const managerHotels = await Listing.find({ owner: req.user._id }, '_id');
        const hotelIds = managerHotels.map(hotel => hotel._id);
        
        const TaxiBooking = require('../models/taxiBooking');
        const taxiBookings = await TaxiBooking.find({ listing: { $in: hotelIds } })
            .populate('user', 'username email')
            .populate('listing', 'title location images')
            .sort('-createdAt');
        
        res.json({ success: true, taxiBookings });
    } catch (error) {
        console.error('Error fetching manager taxi bookings:', error);
        res.status(500).json({ error: 'Failed to fetch taxi bookings' });
    }
}));

// API to get dashboard stats
router.get('/api/stats', isLoggedIn, requireManager, wrapAsync(async (req, res) => {
    try {
        const managerHotels = await Listing.find({ owner: req.user._id }, '_id');
        const hotelIds = managerHotels.map(hotel => hotel._id);
        
        const totalHotels = managerHotels.length;
        
        const bookings = await Booking.find({ listing: { $in: hotelIds } });
        const totalBookings = bookings.length;
        const totalRevenue = bookings.reduce((sum, booking) => sum + (booking.totalAmount || 0), 0);
        const avgBookingValue = totalBookings > 0 ? (totalRevenue / totalBookings) : 0;
        
        // Recent bookings (last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const recentBookings = bookings.filter(booking => new Date(booking.createdAt) > thirtyDaysAgo);
        
        res.json({
            success: true,
            stats: {
                totalHotels,
                totalBookings,
                totalRevenue,
                avgBookingValue: Math.round(avgBookingValue),
                recentBookings: recentBookings.length
            }
        });
    } catch (error) {
        console.error('Error fetching manager stats:', error);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
}));

module.exports = router;