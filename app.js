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
const Razorpay = require('razorpay');

const listingRouter = require('./routes/listing');
const reviewRouter = require('./routes/review');
const userRouter = require('./routes/user');

const PORT = process.env.PORT || 8080; // Default to 8080 if no environment variable is set

// Initialize Razorpay
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

// Verify Razorpay is properly initialized
try {
    razorpay.orders.all().then(() => {
        console.log('Razorpay initialized successfully');
    }).catch((err) => {
        console.error('Razorpay initialization error:', err);
    });
} catch (error) {
    console.error('Razorpay setup error:', error);
}

// Make razorpay instance available to all routes
app.locals.razorpay = razorpay;

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
const MONGO_URL = process.env.MONGODB_URI || 'mongodb://localhost:27017/ffsd-project';

mongoose.connect(MONGO_URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
    socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
})
.then(() => {
    console.log('Connected to MongoDB');
})
.catch(err => {
    console.error('MongoDB Connection Error:', err);
});

mongoose.connection.on('error', err => {
    console.error('MongoDB connection error:', err);
});

mongoose.connection.on('disconnected', () => {
    console.log('MongoDB disconnected');
});

mongoose.connection.on('connected', () => {
    console.log('MongoDB connected');
});

// Session Configuration
const sessionOptions = {
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

// Admin stats
let stats = {
    revenue: "5000",
    bookings: "120",
    avgBookingValue: "420",
    occupancyRate: "78",
    hotels: "15",
};

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
app.get("/admin", requireAdmin, (req, res) => {
    res.render("admin", {
        stats: stats,
        currentUser: req.user
    });
});

app.post("/update-stats", requireAdmin, (req, res) => {
    stats.revenue = req.body.revenue;
    stats.bookings = req.body.bookings;
    stats.hotels = req.body.hotels;
    stats.avgBookingValue = req.body.avgBookingValue;
    stats.occupancyRate = req.body.occupancyRate;
    req.flash('success', 'Stats updated successfully!');
    res.redirect("/admin");
});

// Razorpay order creation route
app.post('/create-razorpay-order', isLoggedIn, async (req, res) => {
    try {
        const options = {
            amount: req.body.amount,
            currency: req.body.currency,
            receipt: `booking_${Date.now()}`,
            notes: {
                listing_id: req.body.listing_id,
                checkIn: req.body.checkIn,
                checkOut: req.body.checkOut,
                guests: req.body.guests
            }
        };

        const order = await razorpay.orders.create(options);
        res.json(order);
    } catch (error) {
        console.error('Error creating Razorpay order:', error);
        res.status(500).json({ error: 'Could not create order' });
    }
});

// 404 Route
app.all('*', (req, res, next) => {
    next(new expressError(404, 'Page Not Found.'));
});

// Error Handling Middleware
app.use((err, req, res, next) => {
    console.error(err);
    let { statusCode = 500, message = 'Something went wrong' } = err;
    res.status(statusCode).render('error.ejs', { statusCode, message });
});

app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
  });
  