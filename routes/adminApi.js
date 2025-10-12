const express = require('express');
const router = express.Router();
const User = require('../models/user');
const Listing = require('../models/listing');
const Booking = require('../models/booking');
const { isLoggedIn } = require('../middleware');

// Helper function to get week number that matches MongoDB $week operator
function getMongoWeek(date) {
    const startOfYear = new Date(date.getFullYear(), 0, 1);
    const dayOfYear = Math.floor((date - startOfYear) / (24 * 60 * 60 * 1000)) + 1;
    const startOfYearDay = startOfYear.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    
    // MongoDB $week starts week on Sunday and returns 0-based week number
    const week = Math.floor((dayOfYear + startOfYearDay - 1) / 7);
    return week;
}

// Admin middleware (legacy check for both username and role)
function requireAdmin(req, res, next) {
    if (req.user?.username === "TravelNest" || req.user?.role === 'admin') return next();
    return res.status(403).json({ error: 'Admin access required' });
}

// Get all users with statistics
router.get('/users', isLoggedIn, requireAdmin, async (req, res) => {
    try {
        const users = await User.find({ username: { $ne: "TravelNest" } })
            .sort('-createdAt');
        
        // Add booking statistics for each user
        const usersWithStats = await Promise.all(users.map(async (user) => {
            const bookings = await Booking.find({ user: user._id });
            const totalBookings = bookings.length;
            const totalSpent = bookings.reduce((sum, booking) => sum + (booking.totalAmount || 0), 0);
            const lastBooking = bookings.length > 0 ? 
                Math.max(...bookings.map(b => new Date(b.createdAt).getTime())) : null;
            
            return {
                _id: user._id,
                username: user.username,
                email: user.email,
                createdAt: user.createdAt,
                isMember: user.isMember || false,
                membershipExpiresAt: user.membershipExpiresAt,
                totalBookings,
                totalSpent,
                lastBooking: lastBooking ? new Date(lastBooking) : null
            };
        }));
        
        res.json({ success: true, users: usersWithStats });
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

// Get all hotels with statistics
router.get('/hotels', isLoggedIn, requireAdmin, async (req, res) => {
    try {
        const hotels = await Listing.find({})
            .populate('owner', 'username email')
            .sort('-createdAt');
        
        // Add booking count for each hotel
        const hotelsWithStats = await Promise.all(hotels.map(async (hotel) => {
            const bookingCount = await Booking.countDocuments({ listing: hotel._id });
            const totalRevenue = await Booking.aggregate([
                { $match: { listing: hotel._id } },
                { $group: { _id: null, total: { $sum: '$totalAmount' } } }
            ]);
            
            return {
                _id: hotel._id,
                title: hotel.title,
                location: hotel.location,
                country: hotel.country,
                price: hotel.price,
                owner: hotel.owner,
                createdAt: hotel.createdAt,
                lastUpdated: hotel.lastUpdated,
                bookingCount,
                revenue: totalRevenue[0] ? totalRevenue[0].total : 0,
                images: hotel.images
            };
        }));
        
        res.json({ success: true, hotels: hotelsWithStats });
    } catch (error) {
        console.error('Error fetching hotels:', error);
        res.status(500).json({ error: 'Failed to fetch hotels' });
    }
});

// Delete user
router.delete('/users/:id', isLoggedIn, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        
        // Also delete user's bookings
        await Booking.deleteMany({ user: id });
        const deletedUser = await User.findByIdAndDelete(id);
        
        if (!deletedUser) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        res.json({ success: true, message: 'User and their bookings deleted successfully' });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.status(500).json({ error: 'Failed to delete user' });
    }
});

// Delete hotel
router.delete('/hotels/:id', isLoggedIn, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        
        const deletedHotel = await Listing.findByIdAndDelete(id);
        
        if (!deletedHotel) {
            return res.status(404).json({ error: 'Hotel not found' });
        }
        
        res.json({ success: true, message: 'Hotel deleted successfully' });
    } catch (error) {
        console.error('Error deleting hotel:', error);
        res.status(500).json({ error: 'Failed to delete hotel' });
    }
});

// Update user membership status
router.patch('/users/:id/membership', isLoggedIn, requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const { isMember } = req.body;
        
        const updateData = { isMember };
        if (isMember) {
            // Activate membership for 30 days
            const now = new Date();
            updateData.membershipExpiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        } else {
            updateData.membershipExpiresAt = null;
        }
        
        const updatedUser = await User.findByIdAndUpdate(id, updateData, { new: true });
        
        if (!updatedUser) {
            return res.status(404).json({ error: 'User not found' });
        }
        
        res.json({ success: true, message: 'User membership updated successfully' });
    } catch (error) {
        console.error('Error updating user membership:', error);
        res.status(500).json({ error: 'Failed to update user membership' });
    }
});

// Helper function to generate consecutive periods
function generateConsecutivePeriods(period, count = 12) {
    const periods = [];
    const now = new Date();
    
    for (let i = count - 1; i >= 0; i--) {
        const date = new Date(now);
        let label, key;
        
        switch (period) {
            case 'day':
                date.setDate(now.getDate() - i);
                label = `${date.getDate()}/${date.getMonth() + 1}`;
                key = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
                break;
            case 'week':
                date.setDate(now.getDate() - (i * 7));
                const weekStart = new Date(date);
                weekStart.setDate(date.getDate() - date.getDay());
                // Use MongoDB-compatible week calculation
                const weekNumber = getMongoWeek(weekStart);
                label = `W${weekNumber}`;
                key = `${weekStart.getFullYear()}-W${weekNumber}`;
                break;
            case 'month':
                date.setMonth(now.getMonth() - i);
                const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                label = monthNames[date.getMonth()];
                key = `${date.getFullYear()}-${date.getMonth() + 1}`;
                break;
            case 'year':
                date.setFullYear(now.getFullYear() - i);
                label = `${date.getFullYear()}`;
                key = `${date.getFullYear()}`;
                break;
            default:
                date.setMonth(now.getMonth() - i);
                label = `${date.getMonth() + 1}/${date.getFullYear()}`;
                key = `${date.getFullYear()}-${date.getMonth() + 1}`;
        }
        
        periods.push({ label, key, revenue: 0, bookings: 0 });
    }
    
    return periods;
}

// Get chart data for dashboard
router.get('/charts/revenue', isLoggedIn, requireAdmin, async (req, res) => {
    try {
        const { period = 'month' } = req.query;
        let groupBy, matchConditions = {};
        
        // Set date range for the query
        const now = new Date();
        const startDate = new Date(now);
        
        switch (period) {
            case 'day':
                startDate.setDate(now.getDate() - 11);
                groupBy = {
                    year: { $year: '$createdAt' },
                    month: { $month: '$createdAt' },
                    day: { $dayOfMonth: '$createdAt' }
                };
                break;
            case 'week':
                startDate.setDate(now.getDate() - (11 * 7));
                groupBy = {
                    year: { $year: '$createdAt' },
                    week: { $week: '$createdAt' }
                };
                break;
            case 'month':
                startDate.setMonth(now.getMonth() - 11);
                groupBy = {
                    year: { $year: '$createdAt' },
                    month: { $month: '$createdAt' }
                };
                break;
            case 'year':
                startDate.setFullYear(now.getFullYear() - 11);
                groupBy = {
                    year: { $year: '$createdAt' }
                };
                break;
        }
        
        matchConditions.createdAt = { $gte: startDate, $lte: now };
        
        const revenueData = await Booking.aggregate([
            { $match: matchConditions },
            {
                $group: {
                    _id: groupBy,
                    totalRevenue: { $sum: '$totalAmount' },
                    totalBookings: { $sum: 1 }
                }
            },
            { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1, '_id.week': 1 } }
        ]);
        
        // Generate consecutive periods
        const consecutivePeriods = generateConsecutivePeriods(period, 12);
        
        // Map actual data to consecutive periods
        revenueData.forEach(item => {
            let key;
            switch (period) {
                case 'day':
                    key = `${item._id.year}-${item._id.month}-${item._id.day}`;
                    break;
                case 'week':
                    key = `${item._id.year}-W${item._id.week}`;
                    break;
                case 'month':
                    key = `${item._id.year}-${item._id.month}`;
                    break;
                case 'year':
                    key = `${item._id.year}`;
                    break;
            }
            
            const periodIndex = consecutivePeriods.findIndex(p => p.key === key);
            if (periodIndex !== -1) {
                consecutivePeriods[periodIndex].revenue = item.totalRevenue;
                consecutivePeriods[periodIndex].bookings = item.totalBookings;
            }
        });
        
        res.json({ success: true, data: consecutivePeriods });
    } catch (error) {
        console.error('Error fetching revenue chart data:', error);
        res.status(500).json({ error: 'Failed to fetch revenue data' });
    }
});

// Get top hotels data
router.get('/charts/top-hotels', isLoggedIn, requireAdmin, async (req, res) => {
    try {
        const topHotels = await Booking.aggregate([
            {
                $group: {
                    _id: '$listing',
                    totalBookings: { $sum: 1 },
                    totalRevenue: { $sum: '$totalAmount' }
                }
            },
            { $sort: { totalBookings: -1 } },
            { $limit: 5 },
            {
                $lookup: {
                    from: 'listings',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'hotel'
                }
            },
            { $unwind: '$hotel' }
        ]);
        
        let formattedData = topHotels.map(item => ({
            name: item.hotel.title,
            bookings: item.totalBookings,
            revenue: item.totalRevenue
        }));
        
        // If no bookings found, get top 5 hotels by creation date as fallback
        if (formattedData.length === 0) {
            const hotels = await Listing.find({})
                .sort('-createdAt')
                .limit(5)
                .select('title');
            
            formattedData = hotels.map(hotel => ({
                name: hotel.title,
                bookings: 0,
                revenue: 0
            }));
        }
        
        console.log('Top hotels data:', formattedData);
        res.json({ success: true, data: formattedData });
    } catch (error) {
        console.error('Error fetching top hotels data:', error);
        res.status(500).json({ error: 'Failed to fetch top hotels data' });
    }
});

// Get bookings trend data
router.get('/charts/bookings-trend', isLoggedIn, requireAdmin, async (req, res) => {
    try {
        const { period = 'month' } = req.query;
        let groupBy, matchConditions = {};
        
        // Set date range for the query
        const now = new Date();
        const startDate = new Date(now);
        
        switch (period) {
            case 'day':
                startDate.setDate(now.getDate() - 11);
                groupBy = {
                    year: { $year: '$createdAt' },
                    month: { $month: '$createdAt' },
                    day: { $dayOfMonth: '$createdAt' }
                };
                break;
            case 'week':
                startDate.setDate(now.getDate() - (11 * 7));
                groupBy = {
                    year: { $year: '$createdAt' },
                    week: { $week: '$createdAt' }
                };
                break;
            case 'month':
                startDate.setMonth(now.getMonth() - 11);
                groupBy = {
                    year: { $year: '$createdAt' },
                    month: { $month: '$createdAt' }
                };
                break;
            case 'year':
                startDate.setFullYear(now.getFullYear() - 11);
                groupBy = {
                    year: { $year: '$createdAt' }
                };
                break;
        }
        
        matchConditions.createdAt = { $gte: startDate, $lte: now };
        
        const bookingsTrend = await Booking.aggregate([
            { $match: matchConditions },
            {
                $group: {
                    _id: groupBy,
                    totalBookings: { $sum: 1 }
                }
            },
            { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1, '_id.week': 1 } }
        ]);
        
        // Generate consecutive periods
        const consecutivePeriods = generateConsecutivePeriods(period, 12);
        
        // Map actual data to consecutive periods
        bookingsTrend.forEach(item => {
            let key;
            switch (period) {
                case 'day':
                    key = `${item._id.year}-${item._id.month}-${item._id.day}`;
                    break;
                case 'week':
                    key = `${item._id.year}-W${item._id.week}`;
                    break;
                case 'month':
                    key = `${item._id.year}-${item._id.month}`;
                    break;
                case 'year':
                    key = `${item._id.year}`;
                    break;
            }
            
            const periodIndex = consecutivePeriods.findIndex(p => p.key === key);
            if (periodIndex !== -1) {
                consecutivePeriods[periodIndex].bookings = item.totalBookings;
            }
        });
        
        res.json({ success: true, data: consecutivePeriods });
    } catch (error) {
        console.error('Error fetching bookings trend data:', error);
        res.status(500).json({ error: 'Failed to fetch bookings trend data' });
    }
});

module.exports = router;
