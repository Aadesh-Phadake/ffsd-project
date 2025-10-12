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
const { isLoggedIn } = require('./middleware');
const wrapAsync = require('./utils/wrapAsync');
const expressError = require('./utils/expressError');

const listingRouter = require('./routes/listing');
const reviewRouter = require('./routes/review');
const userRouter = require('./routes/user');
const paymentRouter = require('./routes/payment');
const taxiRouter = require('./routes/taxi');

const PORT = process.env.PORT || 8080;
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
        secret: process.env.SECRET || 'defaultsecret'
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
app.use('/', taxiRouter);

// Root
app.get('/', (req, res) => res.redirect('/listings'));

// Profile
app.get('/profile', isLoggedIn, wrapAsync(async (req, res) => {
    const bookings = await Booking.find({ user: req.user._id })
        .populate({ path: 'listing', options: { strictPopulate: false } })
        .sort('-createdAt');

    const validBookings = bookings.filter(b => b.listing !== null);

    res.render('users/profile', { bookings: validBookings });
}));

// Admin middleware
function requireAdmin(req, res, next) {
    if (req.user?.username === "TravelNest") return next();
    req.flash('error', 'You must be an admin to access this page');
    res.redirect("/login");
}

// Admin route
app.get("/admin", requireAdmin, async (req, res) => {
    const { startDate, endDate, filterType = 'createdAt' } = req.query;
    let filterQuery = {};

    if (startDate || endDate) {
        if (filterType === 'createdAt') {
            filterQuery.createdAt = {};
            if (startDate) filterQuery.createdAt.$gte = new Date(startDate);
            if (endDate) filterQuery.createdAt.$lte = new Date(endDate + 'T23:59:59.999Z');
        } else if (filterType === 'checkIn' || filterType === 'checkOut') {
            filterQuery[filterType] = {};
            if (startDate) filterQuery[filterType].$gte = startDate;
            if (endDate) filterQuery[filterType].$lte = endDate;
        }
    }

    const bookings = await Booking.find(filterQuery);
    const totalRevenue = bookings.reduce((sum, b) => sum + (b.totalAmount || 0), 0);
    const totalBookings = bookings.length;
    const avgBookingValue = totalBookings ? (totalRevenue / totalBookings) : 0;
    const totalHotels = await Listing.countDocuments();
    const occupancyRate = totalHotels ? ((totalBookings / totalHotels) * 100).toFixed(2) : 0;

    const recentBookings = await Booking.find(filterQuery)
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('user', 'username')
        .populate('listing', 'title');

    const mostBooked = await Booking.aggregate([
        { $match: filterQuery },
        { $group: { _id: "$listing", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 }
    ]);

    const mostBookedHotels = await Promise.all(mostBooked.map(async b => {
        const listing = await Listing.findById(b._id);
        return listing ? { title: listing.title, count: b.count } : null;
    }));

    res.render("admin", {
        stats: {
            revenue: totalRevenue.toFixed(2),
            bookings: totalBookings,
            avgBookingValue: avgBookingValue.toFixed(2),
            occupancyRate,
            hotels: totalHotels
        },
        recentBookings,
        mostBookedHotels: mostBookedHotels.filter(Boolean),
        startDate: startDate || '',
        endDate: endDate || '',
        filterType,
    });
});

// Cancel booking
app.delete('/profile/cancel/:id', isLoggedIn, wrapAsync(async (req, res) => {
    const booking = await Booking.findById(req.params.id);
    if (!booking || booking.user.toString() !== req.user._id.toString()) {
        req.flash('error', 'Booking not found or unauthorized');
        return res.redirect('/profile');
    }
    await Booking.findByIdAndDelete(req.params.id);
    req.flash('success', 'Booking cancelled successfully');
    res.redirect('/profile');
}));

// Logout
app.get("/logout", (req, res) => {
    req.logout(err => {
        if (err) {
            req.flash('error', 'Error logging out');
            return res.redirect('/admin');
        }
        req.flash('success', 'Successfully logged out');
        res.redirect('/login');
    });
});

// Static pages
app.get("/privacy", (req, res) => res.render("privacy"));
app.get("/terms", (req, res) => res.render("terms"));
app.get("/contact", (req, res) => res.render("contact"));

// 404
app.all('*', (req, res, next) => next(new expressError(404, 'Page Not Found.')));

// Error handler
app.use((err, req, res, next) => {
    const { statusCode = 500, message = 'Something went wrong' } = err;
    res.status(statusCode).render('error', { statusCode, message });
});

// Start server
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
