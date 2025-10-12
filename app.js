require('dotenv').config();
const express = require('express');
const app = express();
const mongoose = require('mongoose');
const path = require('path');
const methodOverride = require('method-override');
const ejsMate = require('ejs-mate');
const session = require('express-session');
const flash = require('connect-flash');
const passport = require('passport');
const LocalStrategy = require('passport-local');
const MongoStore = require('connect-mongo');

const Listing = require('./models/listing');
const Review = require('./models/review');
const User = require('./models/user');
const Booking = require('./models/booking');
const { isLoggedIn, isOwner, isOwnerOrAdmin, saveRedirectUrl, requireAdmin, requireManager, requireManagerOrAdmin, requireManagerForListing } = require('./middleware');

const listingRouter = require('./routes/listing');
const reviewRouter = require('./routes/review');
const userRouter = require('./routes/user');
const paymentRouter = require('./routes/payment');
const MongoStore = require('connect-mongo');

const PORT = process.env.PORT || 8080; // Default to 8080 if no environment variable is set

const MONGO_URL = process.env.MONGO_URL;

// Middleware
app.use(express.static(path.join(__dirname, 'assets')));
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride('_method'));
app.engine('ejs', ejsMate);

// MongoDB Connection
async function main() {
    try {
        await mongoose.connect(MONGO_URL);
        console.log('Connected to MongoDB');
    } catch (err) {
        console.error('MongoDB Connection Error:', err);
    }
}
main();

// Session store
const store = MongoStore.create({
    mongoUrl: MONGO_URL,
    crypto: {
        secret : process.env.secret || 'defaultsecret'
    },
    touchAfter: 24 * 3600
});
store.on('error', e => console.log('Session Store Error', e));

const sessionOptions = {
    store,
    secret: process.env.SECRET || 'defaultsecret',
    resave: false,
    saveUninitialized: true,
    cookie: {
        httpOnly: true,
        expires: Date.now() + 1000 * 60 * 60 * 24 * 7,
        maxAge: 1000 * 60 * 60 * 24 * 7
    }
};
app.use(session(sessionOptions));
app.use(flash());

// Passport
app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

// Flash & currentUser middleware
app.use((req, res, next) => {
    res.locals.success = req.flash('success');
    res.locals.error = req.flash('error');
    res.locals.currentUser = req.user;
    next();
});

// Routes
app.use('/listings', listingRouter);
app.use('/listings/:id/reviews', reviewRouter);
app.use('/', userRouter);
app.use('/payment', paymentRouter);

// Root
app.get('/', (req, res) => res.redirect('/listings'));

// Profile
app.get('/profile', isLoggedIn, wrapAsync(async (req, res) => {
    const bookings = await Booking.find({ user: req.user._id })
        .populate('listing')
        .sort('-createdAt');
    res.render('users/profile', { bookings });
}));

// Admin routes
app.get("/admin", requireAdmin, async (req, res) => {
    try {
        // Fetch all data
        const bookings = await Booking.find({})
            .populate({
                path: 'user',
                select: 'username email',
                options: { allowNull: true }
            })
            .populate({
                path: 'listing',
                select: 'title location price',
                options: { allowNull: true }
            });
        const users = await User.find({});
        const listings = await Listing.find({}).populate('owner', 'username');
        
        // All bookings with user data for calculations
        const allBookings = await Booking.find({})
            .populate({
                path: 'user',
                select: 'username email',
                options: { allowNull: true }
            })
            .populate({
                path: 'listing',
                select: 'title location',
                options: { allowNull: true }
            });
        
        // Calculate comprehensive stats
        const totalRevenue = allBookings.reduce((sum, b) => sum + (b.totalAmount || 0), 0);
        const totalBookings = allBookings.length;
        const avgBookingValue = totalBookings ? (totalRevenue / totalBookings) : 0;
        const totalHotels = listings.length;
        const totalUsers = users.length;
        
        // Calculate occupancy rate (bookings per hotel)
        const occupancyRate = totalHotels ? ((totalBookings / totalHotels) * 100).toFixed(2) : 0;
        
        // Monthly revenue for the last 6 months
        const monthlyRevenue = [];
        const monthlyBookings = [];
        for (let i = 5; i >= 0; i--) {
            const date = new Date();
            date.setMonth(date.getMonth() - i);
            const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
            const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);
            
            const monthBookings = allBookings.filter(b => 
                new Date(b.createdAt) >= startOfMonth && new Date(b.createdAt) <= endOfMonth
            );
            
            monthlyRevenue.push(monthBookings.reduce((sum, b) => sum + (b.totalAmount || 0), 0));
            monthlyBookings.push(monthBookings.length);
        }
        
        // Top performing hotels with revenue
        const hotelPerformance = await Booking.aggregate([
            {
                $group: {
                    _id: "$listing",
                    bookings: { $sum: 1 },
                    revenue: { $sum: "$totalAmount" }
                }
            },
            { $sort: { revenue: -1 } },
            { $limit: 10 }
        ]);
        
        const topHotels = await Promise.all(hotelPerformance.map(async (h) => {
            const listing = await Listing.findById(h._id);
            return listing ? { 
                title: listing.title, 
                bookings: h.bookings, 
                revenue: h.revenue,
                location: listing.location 
            } : null;
        }));
        
        // Recent Activity: last 10 bookings
        const recentBookings = await Booking.find({})
            .sort({ createdAt: -1 })
            .limit(10)
            .populate({
                path: 'user',
                select: 'username email',
                options: { allowNull: true }
            })
            .populate({
                path: 'listing',
                select: 'title location',
                options: { allowNull: true }
            });
        
        // User registration trends (last 6 months)
        const userTrends = [];
        for (let i = 5; i >= 0; i--) {
            const date = new Date();
            date.setMonth(date.getMonth() - i);
            const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
            const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);
            
            const monthUsers = users.filter(u => 
                new Date(u.createdAt || u._id.getTimestamp()) >= startOfMonth && 
                new Date(u.createdAt || u._id.getTimestamp()) <= endOfMonth
            );
            
            userTrends.push(monthUsers.length);
        }
        
        // Active users (users with bookings)
        const activeUsers = new Set(allBookings.filter(b => b.user && b.user._id).map(b => b.user._id.toString())).size;
        
        // Average booking duration (in days) with detailed analytics
        let avgDuration = 0;
        let validBookings = 0;
        let totalNights = 0;
        let minStay = 0;
        let maxStay = 0;
        
        if (allBookings.length > 0) {
            const durations = [];
            
            allBookings.forEach(b => {
                try {
                    // Parse dates with fallback for old format
                    let checkIn, checkOut;
                    
                    // Try parsing as YYYY-MM-DD first (new format)
                    checkIn = new Date(b.checkIn);
                    checkOut = new Date(b.checkOut);
                    
                    // If invalid, try parsing as DD-MM-YYYY (old format)
                    if (isNaN(checkIn.getTime()) && b.checkIn && typeof b.checkIn === 'string' && b.checkIn.match(/^\d{2}-\d{2}-\d{4}$/)) {
                        const [day, month, year] = b.checkIn.split('-');
                        checkIn = new Date(year, month - 1, day);
                    }
                    
                    if (isNaN(checkOut.getTime()) && b.checkOut && typeof b.checkOut === 'string' && b.checkOut.match(/^\d{2}-\d{2}-\d{4}$/)) {
                        const [day, month, year] = b.checkOut.split('-');
                        checkOut = new Date(year, month - 1, day);
                    }
                    
                    // Validate dates
                    if (isNaN(checkIn.getTime()) || isNaN(checkOut.getTime())) {
                        console.warn('Invalid date in booking:', b._id, 'checkIn:', b.checkIn, 'checkOut:', b.checkOut);
                        return; // Skip invalid dates
                    }
                    
                    // Calculate duration in days
                    const duration = (checkOut - checkIn) / (1000 * 60 * 60 * 24);
                    
                    // Only include positive durations
                    if (duration > 0) {
                        durations.push(duration);
                        totalNights += duration;
                        validBookings++;
                    }
                } catch (error) {
                    console.warn('Error calculating duration for booking:', b._id, error);
                }
            });
            
            if (durations.length > 0) {
                avgDuration = totalNights / durations.length;
                minStay = Math.min(...durations);
                maxStay = Math.max(...durations);
            }
        }

        const stats = {
            revenue: totalRevenue.toFixed(2),
            bookings: totalBookings,
            avgBookingValue: avgBookingValue.toFixed(2),
            occupancyRate: occupancyRate,
            hotels: totalHotels,
            users: totalUsers,
            activeUsers: activeUsers,
            avgDuration: avgDuration.toFixed(1),
            totalNights: totalNights.toFixed(0),
            validBookings: validBookings,
            minStay: minStay.toFixed(1),
            maxStay: maxStay.toFixed(1)
        };

        // Calculate bookings per hotel
        const hotelBookings = {};
        allBookings.forEach(booking => {
            if (booking.listing && booking.listing._id) {
                const hotelId = booking.listing._id.toString();
                hotelBookings[hotelId] = (hotelBookings[hotelId] || 0) + 1;
            }
        });

        res.render("admin", {
            stats: stats,
            currentUser: req.user,
            recentBookings,
            allBookings: allBookings, // Pass all bookings with populated user data
            topHotels: topHotels.filter(Boolean),
            monthlyRevenue,
            monthlyBookings,
            userTrends,
            allUsers: users,
            allListings: listings,
            hotelBookings: hotelBookings
        });
    } catch (error) {
        console.error('Admin dashboard error:', error);
        req.flash('error', 'Error loading admin dashboard');
        res.redirect('/listings');
    }
});

// Admin management routes
app.delete("/admin/users/:id", requireAdmin, wrapAsync(async (req, res) => {
    const { id } = req.params;
    await User.findByIdAndDelete(id);
    req.flash('success', 'User deleted successfully');
    res.json({ success: true });
}));

app.delete("/admin/listings/:id", requireAdmin, wrapAsync(async (req, res) => {
    const { id } = req.params;
    await Listing.findByIdAndDelete(id);
    req.flash('success', 'Hotel deleted successfully');
    res.json({ success: true });
}));

app.get("/admin/export/bookings", requireAdmin, wrapAsync(async (req, res) => {
    const bookings = await Booking.find({})
        .populate('user', 'username email')
        .populate('listing', 'title location');
    
    const csvData = bookings.map(booking => ({
        'Booking ID': booking._id,
        'User': booking.user.username,
        'Email': booking.user.email,
        'Hotel': booking.listing.title,
        'Location': booking.listing.location,
        'Check-in': booking.checkIn,
        'Check-out': booking.checkOut,
        'Guests': booking.guests,
        'Amount': booking.totalAmount,
        'Date': booking.createdAt
    }));
    
    res.json(csvData);
}));

app.get("/privacy", (req, res) => {
    res.render("privacy");
});
app.get("/terms", (req, res) => {
    res.render("terms");
});
app.get("/contact", (req, res) => {
    res.render("contact");
});

// Debug page
app.get("/debug", (req, res) => {
    res.render("debug");
});

app.get("/debug/bookings", async (req, res) => {
    try {
        const allBookings = await Booking.find({})
            .populate({
                path: 'user',
                select: 'username email',
                options: { allowNull: true }
            })
            .populate({
                path: 'listing',
                select: 'title location',
                options: { allowNull: true }
            });
        
        const users = await User.find({});
        const listings = await Listing.find({});
        
        res.json({
            totalBookings: allBookings.length,
            bookingsWithUsers: allBookings.filter(b => b.user).length,
            bookingsWithListings: allBookings.filter(b => b.listing).length,
            totalUsers: users.length,
            totalListings: listings.length,
            sampleBooking: allBookings[0] ? {
                id: allBookings[0]._id,
                user: allBookings[0].user ? {
                    id: allBookings[0].user._id,
                    username: allBookings[0].user.username
                } : null,
                listing: allBookings[0].listing ? {
                    id: allBookings[0].listing._id,
                    title: allBookings[0].listing.title
                } : null
            } : null,
            userBookingsCount: users.map(user => ({
                username: user.username,
                bookings: allBookings.filter(b => b.user && b.user._id.toString() === user._id.toString()).length
            }))
        });
    } catch (error) {
        res.json({ error: error.message });
    }
});

// AJAX Routes for Admin Panel
app.get("/admin/users/:id", requireAdmin, wrapAsync(async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) {
            return res.json({ success: false, message: 'User not found' });
        }
        res.json({ success: true, user: { _id: user._id, username: user.username, email: user.email } });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
}));

app.put("/admin/users/:id", requireAdmin, wrapAsync(async (req, res) => {
    try {
        const { username, email } = req.body;
        const user = await User.findByIdAndUpdate(req.params.id, { username, email }, { new: true });
        if (!user) {
            return res.json({ success: false, message: 'User not found' });
        }
        res.json({ success: true, message: 'User updated successfully' });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
}));

app.get("/admin/users/search", requireAdmin, wrapAsync(async (req, res) => {
    try {
        const query = req.query.q;
        const users = await User.find({
            $or: [
                { username: { $regex: query, $options: 'i' } },
                { email: { $regex: query, $options: 'i' } }
            ]
        }).limit(10);
        
        res.json({ users });
    } catch (error) {
        res.json({ error: error.message });
    }
}));

app.post("/admin/analytics/refresh", requireAdmin, wrapAsync(async (req, res) => {
    try {
        // Simulate analytics refresh
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Get fresh analytics data
        const bookings = await Booking.find({});
        const users = await User.find({});
        const listings = await Listing.find({});
        
        const analytics = {
            totalBookings: bookings.length,
            totalUsers: users.length,
            totalListings: listings.length,
            totalRevenue: bookings.reduce((sum, b) => sum + (b.totalAmount || 0), 0)
        };
        
        res.json({ success: true, message: 'Analytics refreshed successfully', analytics });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
}));

// User Profile AJAX Routes
app.put("/profile/update", isLoggedIn, wrapAsync(async (req, res) => {
    try {
        const { username, email } = req.body;
        const user = await User.findByIdAndUpdate(req.user._id, { username, email }, { new: true });
        if (!user) {
            return res.json({ success: false, message: 'User not found' });
        }
        res.json({ success: true, message: 'Profile updated successfully' });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
}));

app.get("/profile/bookings/refresh", isLoggedIn, wrapAsync(async (req, res) => {
    try {
        const bookings = await Booking.find({ user: req.user._id })
            .populate('listing', 'title location price');
        
        res.json({ success: true, bookings });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
}));

app.delete("/profile/cancel/:id", isLoggedIn, wrapAsync(async (req, res) => {
    try {
        const booking = await Booking.findOneAndDelete({ 
            _id: req.params.id, 
            user: req.user._id 
        });
        
        if (!booking) {
            return res.json({ success: false, message: 'Booking not found or not authorized' });
        }
        
        res.json({ success: true, message: 'Booking cancelled successfully' });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
}));

app.get("/profile/bookings/export", isLoggedIn, wrapAsync(async (req, res) => {
    try {
        const bookings = await Booking.find({ user: req.user._id })
            .populate('listing', 'title location');
        
        const csvData = bookings.map(booking => ({
            'Property': booking.listing.title,
            'Location': booking.listing.location,
            'Check-in': booking.checkIn,
            'Check-out': booking.checkOut,
            'Guests': booking.guests,
            'Total Amount': booking.totalAmount,
            'Status': 'Confirmed',
            'Booking Date': booking.createdAt
        }));
        
        res.json(csvData);
    } catch (error) {
        res.json({ error: error.message });
    }
}));

// Manager Dashboard AJAX Routes
app.get("/manager/dashboard/data", requireManager, wrapAsync(async (req, res) => {
    try {
        // Get user's properties
        const properties = await Listing.find({ owner: req.user._id });
        const propertyIds = properties.map(p => p._id);
        
        // Get bookings for user's properties
        const bookings = await Booking.find({ listing: { $in: propertyIds } })
            .populate('user', 'username email')
            .populate('listing', 'title location price')
            .sort({ createdAt: -1 })
            .limit(10);
        
        // Calculate stats
        const totalProperties = properties.length;
        const totalBookings = bookings.length;
        const totalRevenue = bookings.reduce((sum, b) => sum + (b.totalAmount || 0), 0);
        const avgRating = 4.5; // Placeholder - would need review system
        
        // Prepare chart data
        const chartData = {
            labels: properties.map(p => p.title),
            data: properties.map(p => 
                bookings.filter(b => b.listing._id.toString() === p._id.toString()).length
            )
        };
        
        res.json({
            success: true,
            stats: { totalProperties, totalBookings, totalRevenue, avgRating },
            bookings,
            properties,
            chartData
        });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
}));

app.get("/manager/bookings/refresh", requireManager, wrapAsync(async (req, res) => {
    try {
        const properties = await Listing.find({ owner: req.user._id });
        const propertyIds = properties.map(p => p._id);
        
        const bookings = await Booking.find({ listing: { $in: propertyIds } })
            .populate('user', 'username email')
            .populate('listing', 'title location price')
            .sort({ createdAt: -1 })
            .limit(10);
        
        res.json({ success: true, bookings });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
}));

app.get("/manager/bookings/:id", requireManager, wrapAsync(async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.id)
            .populate('user', 'username email')
            .populate('listing', 'title location price');
        
        if (!booking) {
            return res.json({ success: false, message: 'Booking not found' });
        }
        
        // Check if user owns the property
        const property = await Listing.findById(booking.listing._id);
        if (property.owner.toString() !== req.user._id.toString()) {
            return res.json({ success: false, message: 'Not authorized' });
        }
        
        res.json({ success: true, booking });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
}));

app.get("/manager/properties/:id/stats", requireManager, wrapAsync(async (req, res) => {
    try {
        const property = await Listing.findById(req.params.id);
        if (!property || property.owner.toString() !== req.user._id.toString()) {
            return res.json({ success: false, message: 'Property not found or not authorized' });
        }
        
        const bookings = await Booking.find({ listing: req.params.id });
        const totalBookings = bookings.length;
        const totalRevenue = bookings.reduce((sum, b) => sum + (b.totalAmount || 0), 0);
        const avgRating = 4.5; // Placeholder
        
        res.json({
            success: true,
            stats: { totalBookings, totalRevenue, avgRating }
        });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
}));

// Manager dashboard route
app.get("/manager", requireManager, wrapAsync(async (req, res) => {
    try {
        res.render("manager", { currentUser: req.user });
    } catch (error) {
        req.flash('error', 'Error loading manager dashboard');
        res.redirect('/listings');
    }
}));

// Debug route to check admin user
app.get("/debug/admin", async (req, res) => {
    try {
        const adminUser = await User.findOne({ username: "TravelNest" });
        if (adminUser) {
            res.json({ 
                exists: true, 
                username: adminUser.username, 
                email: adminUser.email,
                id: adminUser._id,
                role: adminUser.role || 'user'
            });
        } else {
            res.json({ exists: false, message: "Admin user not found" });
        }
    } catch (error) {
        res.json({ error: error.message });
    }
});

// Route to update existing admin user role
app.post("/debug/update-admin-role", async (req, res) => {
    try {
        const adminUser = await User.findOne({ username: "TravelNest" });
        if (adminUser) {
            adminUser.role = 'admin';
            await adminUser.save();
            res.json({ 
                success: true, 
                message: "Admin role updated successfully",
                user: { username: adminUser.username, role: adminUser.role }
            });
        } else {
            res.json({ success: false, message: "Admin user not found" });
        }
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
});

// Route to promote user to manager
app.post("/admin/promote-to-manager/:id", requireAdmin, wrapAsync(async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) {
            return res.json({ success: false, message: 'User not found' });
        }
        
        user.role = 'manager';
        await user.save();
        
        res.json({ success: true, message: 'User promoted to manager successfully' });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
}));

// Route to create admin user if it doesn't exist
app.post("/debug/create-admin", async (req, res) => {
    try {
        const { username, email, password } = req.body;
        
        // Check if user already exists
        const existingUser = await User.findOne({ username });
        if (existingUser) {
            return res.json({ success: false, message: "User already exists" });
        }
        
        // Create new user with admin role
        const user = new User({ username, email, role: 'admin' });
        const registeredUser = await User.register(user, password);
        
        res.json({ 
            success: true, 
            message: "Admin user created successfully",
            user: {
                username: registeredUser.username,
                email: registeredUser.email,
                id: registeredUser._id
            }
        });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

// 404
app.all('*', (req, res, next) => next(new expressError(404, 'Page Not Found.')));

// Error handler
app.use((err, req, res, next) => {
    const { statusCode = 500, message = 'Something went wrong' } = err;
    res.status(statusCode).render('error', { statusCode, message });
});

// Start server
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
