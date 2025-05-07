require('dotenv').config();
const express = require('express');
const app = express();
const mongoose = require('mongoose');
const Listing = require('./models/listing');
const Review = require('./models/review');
const path = require('path');
const methodOverride = require('method-override');
const ejsMate = require('ejs-mate');
const wrapAsync = require('./utils/wrapAsync');
const expressError = require('./utils/expressError');
const { listingSchema, reviewSchema } = require('./schema');
const session = require('express-session');
const flash = require('connect-flash');
const passport = require('passport');
const LocalStrategy = require('passport-local');
const User = require('./models/user');
const Booking = require('./models/booking');
const { isLoggedIn } = require('./middleware');

const listingRouter = require('./routes/listing');
const reviewRouter = require('./routes/review');
const userRouter = require('./routes/user');
const MongoStore = require('connect-mongo');

const PORT = process.env.PORT || 8080; // Default to 8080 if no environment variable is set


// Middleware
app.use(express.static(path.join(__dirname, 'assets')));
app.set('view engine', 'ejs');
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride('_method'));
app.engine('ejs', ejsMate);

// MongoDB Connection with Error Handling
const MONGO_URL = process.env.MONGO_URL;

async function main() {
    try {
        await mongoose.connect(MONGO_URL);
        console.log('Connected to MongoDB');
    } catch (err) {
        console.error('MongoDB Connection Error:', err);
    }
}
main();

const store = MongoStore.create({
    mongoUrl: MONGO_URL,
    crypto: {
        secret : process.env.secret || 'defaultsecret'
    },
    touchAfter: 24 * 3600,
});
store.on('error', (e) => {
    console.log('Session Store Error', e);
});
// Session Configuration
const sessionOptions = {
    store,
    secret: process.env.SECRET || 'defaultsecret',
    resave: false,
    saveUninitialized: true,
    cookie: {
        expires: Date.now() + 1000 * 60 * 60 * 24 * 7,
        maxAge: 1000 * 60 * 60 * 24 * 7,
        httpOnly: true
    }
};

app.use(session(sessionOptions));
app.use(flash());

// Passport Authentication
app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

// Flash Messages Middleware
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

// Root Route
app.get('/', (req, res) => {
    res.redirect('/listings');
});

// Profile Route (explicit registration)
app.get('/profile', isLoggedIn, wrapAsync(async (req, res) => {
    const bookings = await Booking.find({ user: req.user._id })
        .populate('listing')
        .sort('-createdAt');
    res.render('users/profile', { bookings });
}));

// Admin middleware
function requireAdmin(req, res, next) {
    if (req.user && req.user.username === "TravelNest") {
        next();
    } else {
        req.flash('error', 'You must be an admin to access this page');
        res.redirect("/login");
    }
}

// Admin routes
app.get("/admin", requireAdmin, async (req, res) => {
    // Fetch filtered bookings
    const bookings = await Booking.find({});
    // Calculate total revenue
    const totalRevenue = bookings.reduce((sum, b) => sum + (b.totalAmount || 0), 0);
    // Total bookings
    const totalBookings = bookings.length;
    // Average booking value
    const avgBookingValue = totalBookings ? (totalRevenue / totalBookings) : 0;
    // Total hotels
    const totalHotels = await Listing.countDocuments();
    // Occupancy rate (simple version)
    const occupancyRate = totalHotels ? ((totalBookings / totalHotels) * 100).toFixed(2) : 0;

    // Recent Activity: last 5 bookings
    const recentBookings = await Booking.find({})
        .sort({ createdAt: -1 })
        .limit(5)
        .populate('user', 'username')
        .populate('listing', 'title');

    // Most Booked Hotels: aggregate top 5
    const mostBooked = await Booking.aggregate([
        { $group: { _id: "$listing", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 }
    ]);
    // Populate hotel titles
    const mostBookedHotels = await Promise.all(mostBooked.map(async (b) => {
        const listing = await Listing.findById(b._id);
        return listing ? { title: listing.title, count: b.count } : null;
    }));

    const stats = {
        revenue: totalRevenue.toFixed(2),
        bookings: totalBookings,
        avgBookingValue: avgBookingValue.toFixed(2),
        occupancyRate: occupancyRate,
        hotels: totalHotels,
    };

    res.render("admin", {
        stats: stats,
        currentUser: req.user,
        recentBookings,
        mostBookedHotels: mostBookedHotels.filter(Boolean)
    });
});

// 404 Route
app.all('*', (req, res, next) => {
    next(new expressError(404, 'Page Not Found.'));
});

// Error Handling Middleware
app.use((err, req, res, next) => {
    let { statusCode = 500, message = 'Something went wrong' } = err;
    res.status(statusCode).render('error.ejs', { statusCode, message });
});

app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
  });
  