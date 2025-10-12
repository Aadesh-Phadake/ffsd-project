const User = require('../models/user');
const Booking = require('../models/booking');
const Listing = require('../models/listing');
const Request = require('../models/request');

module.exports.renderSignup = (req, res) => {
    res.render('users/signup');
};

module.exports.signup = async (req, res) => {
    try{
    let {username, email, password, role} = req.body;
    
    // Validate role
    if (!['traveller', 'manager', 'customer_care'].includes(role)) {
        req.flash('error', 'Please select a valid account type');
        return res.redirect('/signup');
    }
    
    let user = new User({username, email, role});
    let registeredUser = await User.register(user, password);
    req.login(registeredUser, err => {
        if(err) return next(err);
        req.flash('success', `Welcome to TravelNest! Your ${role} account has been created.`);
        
        // Redirect based on role
        if (role === 'manager') {
            res.redirect('/manager/dashboard');
        } else if (role === 'customer_care') {
            res.redirect('/customer-care/dashboard');
        } else {
            res.redirect('/listings');
        }
    });
    
    } catch(e){
        req.flash('error', e.message);
        res.redirect('/signup');
    }
};

module.exports.renderLogin = (req, res) => {
    res.render('users/login');
};

module.exports.login = async (req, res) => {
    req.flash('success', 'Welcome back to TravelNest!');
    res.redirect(res.locals.redirectUrl || '/listings');
};

module.exports.logout = (req, res,next) => {
    req.logout((err)=>{
        if(err) return next(err);
    });
    req.flash('success', 'Logged out successfully!');
    res.redirect('/listings');
};

module.exports.renderProfile = async (req, res) => {
    const bookings = await Booking.find({ user: req.user._id })
        .populate('listing')
        .sort('-createdAt');
    res.render('users/profile', { bookings });
};

module.exports.activateMembership = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        if (!user) {
            req.flash('error', 'User not found');
            return res.redirect('/profile');
        }
        const now = new Date();
        const expires = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        user.isMember = true;
        user.membershipExpiresAt = expires;
        
        // Initialize cancellation tracking for new members
        if (!user.freeCancellationsResetAt) {
            user.freeCancellationsResetAt = new Date(now.getFullYear(), now.getMonth() + 1, 1);
            user.freeCancellationsUsed = 0;
        }
        
        await user.save();
        req.flash('success', 'Membership activated for 30 days!');
        res.redirect('/profile');
    } catch (e) {
        req.flash('error', 'Could not activate membership');
        res.redirect('/profile');
    }
};

module.exports.createBooking = async (req, res) => {
    const listing = await Listing.findById(req.params.id);
    if (!listing) {
        req.flash('error', 'Listing not found');
        return res.redirect('/listings');
    }

    const { checkIn, checkOut, guests } = req.body;
    
    // Parse the dates
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

    // Calculate values if dates are valid, otherwise use 0
    const numGuests = parseInt(guests) || 1;
    if (checkInDate && checkOutDate && !isNaN(checkInDate.getTime()) && !isNaN(checkOutDate.getTime())) {
        nights = Math.ceil((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24));
        if (nights > 0) {
            // Calculate base amount: price per night * nights (for up to 2 guests)
            let baseAmount = listing.price * nights;
            
            // Add ₹500 per night for each guest beyond 2
            if (numGuests > 2) {
                const additionalGuestFee = (numGuests - 2) * 500 * nights;
                baseAmount += additionalGuestFee;
            }
            
            // Check if user has active membership for service fee discount
            const isActiveMember = req.user && req.user.isMember && req.user.membershipExpiresAt && new Date(req.user.membershipExpiresAt) > new Date();
            serviceFee = isActiveMember ? 0 : Math.round(baseAmount * 0.1); // 10% service fee or free for members
            totalAmount = baseAmount + serviceFee;
        }
    }

    const booking = new Booking({
        user: req.user._id,
        listing: listing._id,
        checkIn,
        checkOut,
        guests: parseInt(guests) || 1,
        totalAmount: totalAmount || 0
    });

    await booking.save();
    req.flash('success', 'Booking confirmed successfully!');
    res.redirect('/profile');
};

// Create service request or complaint for a booking
module.exports.createRequest = async (req, res) => {
    const { bookingId } = req.params;
    const { type, message } = req.body;

    const booking = await Booking.findById(bookingId).populate('listing');
    if (!booking) {
        req.flash('error', 'Booking not found');
        return res.redirect('/profile');
    }
    if (String(booking.user) !== String(req.user._id)) {
        req.flash('error', 'Unauthorized');
        return res.redirect('/profile');
    }

    // Basic check-in gate: allow once current date >= check-in date (supports DD-MM-YYYY)
    const parseDMY = (dmy) => {
        const [day, month, year] = (dmy || '').split('-').map(Number);
        if (!day || !month || !year) return null;
        return new Date(year, month - 1, day);
    };
    const now = new Date();
    const checkInDate = parseDMY(booking.checkIn);
    if (checkInDate && now < checkInDate) {
        req.flash('error', 'You can request services/complaints after check-in.');
        return res.redirect('/profile');
    }

    const newRequest = new Request({
        user: req.user._id,
        listing: booking.listing._id,
        booking: booking._id,
        type: type === 'complaint' ? 'complaint' : 'service',
        message: (message || '').trim()
    });
    await newRequest.save();
    req.flash('success', 'Submitted successfully. The hotel manager has been notified.');
    res.redirect('/profile');
};

// Fetch requests for manager/owner across their listings
module.exports.getOwnerRequests = async (req, res) => {
    const ownerId = req.user._id;
    const ownerListings = await Listing.find({ owner: ownerId }, '_id');
    const listingIds = ownerListings.map(l => l._id);
    const requests = await Request.find({ listing: { $in: listingIds } })
        .populate('user', 'username email')
        .populate('listing', 'title')
        .populate('booking', 'checkIn checkOut')
        .sort({ createdAt: -1 });
    res.render('listings/dashboard', { bookings: [], currentUser: req.user, requests });
};

// Simple owner dashboard
module.exports.ownerDashboard = async (req, res) => {
    try {
        const ownerId = req.user._id;
        
        // Find listings owned by this user
        const ownerListings = await Listing.find({ owner: ownerId });
        const listingIds = ownerListings.map(l => l._id);

        // Find bookings for these listings
        const bookings = await Booking.find({ listing: { $in: listingIds } })
            .populate('user', 'username email')
            .populate('listing', 'title location')
            .sort({ createdAt: -1 })
            .limit(20); // Show only recent 20 bookings

        // Find taxi bookings for these listings
        const TaxiBooking = require('../models/taxiBooking');
        const taxiBookings = await TaxiBooking.find({ listing: { $in: listingIds } })
            .populate('user', 'username email')
            .populate('listing', 'title location')
            .sort({ createdAt: -1 })
            .limit(20); // Show only recent 20 taxi bookings

        res.render('listings/dashboard', {
            bookings,
            taxiBookings,
            currentUser: req.user
        });
    } catch (error) {
        console.error('Dashboard error:', error);
        req.flash('error', 'Error loading dashboard');
        res.redirect('/listings');
    }
};

module.exports.searchDashboard = async (req, res) => {
    try {
        const userId = req.user._id;
        const { search, status, dateRange } = req.query;
        
        if (!userId) {
            return res.status(401).json({ message: 'Unauthorized: No user ID found' });
        }

        // Find listings owned by this user
        const userListings = await Listing.find({ owner: userId }, '_id');
        const listingIds = userListings.map(listing => listing._id);

        // Build search filter
        let filter = { listing: { $in: listingIds } };

        // Add search filter for hotel name, user name, or location
        if (search) {
            const bookings = await Booking.find(filter)
                .populate('user', 'username email')
                .populate('listing', 'title location')
                .exec();
            
            // Filter by search term
            const filteredBookings = bookings.filter(booking => {
                const searchLower = search.toLowerCase();
                return (
                    booking.listing.title.toLowerCase().includes(searchLower) ||
                    booking.listing.location.toLowerCase().includes(searchLower) ||
                    booking.user.username.toLowerCase().includes(searchLower) ||
                    booking.user.email.toLowerCase().includes(searchLower)
                );
            });

            return res.json({ 
                success: true, 
                bookings: filteredBookings,
                count: filteredBookings.length 
            });
        }

        // Add status filter (if needed in future)
        if (status) {
            // You can add status logic here if you have booking statuses
        }

        // Add date range filter (if needed in future)
        if (dateRange) {
            // You can add date range logic here
        }

        // Default: return all bookings
        const bookings = await Booking.find(filter)
            .populate('user', 'username email')
            .populate('listing', 'title location')
            .sort('-createdAt')
            .exec();

        res.json({ 
            success: true, 
            bookings: bookings,
            count: bookings.length 
        });

    } catch (error) {
        console.error('Dashboard search error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error searching dashboard data' 
        });
    }
};

module.exports.getUserHotels = async (req, res) => {
    try {
        const ownerId = req.user._id;
        const hotels = await Listing.find({ owner: ownerId }).sort({ createdAt: -1 });
        res.json({ success: true, hotels });
    } catch (error) {
        console.error('Error fetching user hotels:', error);
        res.status(500).json({ success: false, error: 'Server error' });
    }
};

// Admin dashboard with taxi fare details
module.exports.adminDashboard = async (req, res) => {
    try {
        const TaxiBooking = require('../models/taxiBooking');
        
        // Get all taxi bookings with user and listing details
        const taxiBookings = await TaxiBooking.find({})
            .populate('user', 'username email')
            .populate('listing', 'title location owner')
            .sort({ createdAt: -1 })
            .limit(50); // Show recent 50 bookings

        // Calculate total revenue
        const totalRevenue = taxiBookings
            .filter(booking => booking.paymentStatus === 'Paid')
            .reduce((sum, booking) => sum + booking.fareAmount, 0);

        // Calculate revenue by taxi type
        const revenueByType = taxiBookings
            .filter(booking => booking.paymentStatus === 'Paid')
            .reduce((acc, booking) => {
                if (!acc[booking.taxiType]) {
                    acc[booking.taxiType] = 0;
                }
                acc[booking.taxiType] += booking.fareAmount;
                return acc;
            }, {});

        res.render('admin/dashboard', {
            taxiBookings,
            totalRevenue,
            revenueByType,
            currentUser: req.user
        });
    } catch (error) {
        console.error('Admin dashboard error:', error);
        req.flash('error', 'Error loading admin dashboard');
        res.redirect('/listings');
    }
};


// Update a request status (owner-only)
module.exports.updateRequestStatus = async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    const valid = ['open', 'in_progress', 'resolved'];
    if (!valid.includes(status)) {
        req.flash('error', 'Invalid status');
        return res.redirect('/dashboard');
    }
    const requestDoc = await Request.findById(id).populate('listing');
    if (!requestDoc) {
        req.flash('error', 'Request not found');
        return res.redirect('/dashboard');
    }
    if (String(requestDoc.listing.owner) !== String(req.user._id)) {
        req.flash('error', 'Not authorized');
        return res.redirect('/dashboard');
    }
    requestDoc.status = status;
    await requestDoc.save();
    req.flash('success', 'Request updated');
    res.redirect('/dashboard');
};
module.exports.deleteBooking = async (req, res) => {
    const { id } = req.params;
    const booking = await Booking.findById(id).populate('listing');
    
    if (!booking) {
        req.flash('error', 'Booking not found');
        return res.redirect('/profile');
    }

    // Check if user owns this booking
    if (!booking.user.equals(req.user._id)) {
        req.flash('error', 'Unauthorized');
        return res.redirect('/profile');
    }

    // Calculate cancellation fee
    const isActiveMember = req.user && req.user.isMember && req.user.membershipExpiresAt && new Date(req.user.membershipExpiresAt) > new Date();
    const now = new Date();
    
    // Initialize cancellation tracking if not set (for existing members)
    if (isActiveMember && !req.user.freeCancellationsResetAt) {
        req.user.freeCancellationsResetAt = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        req.user.freeCancellationsUsed = 0;
        await req.user.save();
    }
    
    // Reset free cancellations if it's a new month for members
    if (isActiveMember && req.user.freeCancellationsResetAt && now > req.user.freeCancellationsResetAt) {
        req.user.freeCancellationsUsed = 0;
        req.user.freeCancellationsResetAt = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        await req.user.save();
    }

    let cancellationFee = 0;
    let canUseFreeCancellation = false;

    if (isActiveMember && req.user.freeCancellationsUsed < 2) {
        canUseFreeCancellation = true;
        cancellationFee = 0;
    } else {
        cancellationFee = Math.round(booking.totalAmount * 0.1); // 10% fee
    }

    // Store cancellation details in session for confirmation
    req.session.cancellationDetails = {
        bookingId: id,
        cancellationFee,
        canUseFreeCancellation,
        bookingAmount: booking.totalAmount
    };

    res.redirect(`/profile/cancel/confirm/${id}`);
};

module.exports.renderCancelConfirm = async (req, res) => {
    const { id } = req.params;
    const booking = await Booking.findById(id).populate('listing');
    
    if (!booking) {
        req.flash('error', 'Booking not found');
        return res.redirect('/profile');
    }

    const cancellationDetails = req.session.cancellationDetails;
    if (!cancellationDetails || cancellationDetails.bookingId !== id) {
        req.flash('error', 'Invalid cancellation request');
        return res.redirect('/profile');
    }

    res.render('users/cancel-confirm', { 
        booking, 
        cancellationDetails,
        currentUser: req.user 
    });
};

module.exports.confirmCancellation = async (req, res) => {
    const { id } = req.params;
    const cancellationDetails = req.session.cancellationDetails;
    
    if (!cancellationDetails || cancellationDetails.bookingId !== id) {
        req.flash('error', 'Invalid cancellation request');
        return res.redirect('/profile');
    }

    const booking = await Booking.findById(id);
    if (!booking) {
        req.flash('error', 'Booking not found');
        return res.redirect('/profile');
    }

    // Update user's free cancellation count if applicable
    if (cancellationDetails.canUseFreeCancellation) {
        req.user.freeCancellationsUsed += 1;
        if (!req.user.freeCancellationsResetAt) {
            const now = new Date();
            req.user.freeCancellationsResetAt = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        }
        await req.user.save();
    }

    // Delete the booking
    await Booking.findByIdAndDelete(id);
    
    // Clear session data
    delete req.session.cancellationDetails;

    if (cancellationDetails.cancellationFee > 0) {
        req.flash('success', `Booking cancelled successfully! Cancellation fee: ₹${cancellationDetails.cancellationFee}`);
    } else {
        req.flash('success', 'Booking cancelled successfully! No cancellation fee (free cancellation used).');
    }
    
    res.redirect('/profile');
};

// AJAX API Methods

// Get cancellation details for AJAX modal
module.exports.getCancellationDetails = async (req, res) => {
    try {
        const { id } = req.params;
        const booking = await Booking.findById(id).populate('listing');
        
        if (!booking) {
            return res.json({ success: false, error: 'Booking not found' });
        }

        // Check if user owns this booking
        if (!booking.user.equals(req.user._id)) {
            return res.json({ success: false, error: 'Unauthorized' });
        }

        // Calculate cancellation fee
        const isActiveMember = req.user && req.user.isMember && req.user.membershipExpiresAt && new Date(req.user.membershipExpiresAt) > new Date();
        const now = new Date();
        
        // Initialize cancellation tracking if not set (for existing members)
        if (isActiveMember && !req.user.freeCancellationsResetAt) {
            req.user.freeCancellationsResetAt = new Date(now.getFullYear(), now.getMonth() + 1, 1);
            req.user.freeCancellationsUsed = 0;
            await req.user.save();
        }
        
        // Reset free cancellations if it's a new month for members
        if (isActiveMember && req.user.freeCancellationsResetAt && now > req.user.freeCancellationsResetAt) {
            req.user.freeCancellationsUsed = 0;
            req.user.freeCancellationsResetAt = new Date(now.getFullYear(), now.getMonth() + 1, 1);
            await req.user.save();
        }

        let cancellationFee = 0;
        let canUseFreeCancellation = false;

        if (isActiveMember && req.user.freeCancellationsUsed < 2) {
            canUseFreeCancellation = true;
            cancellationFee = 0;
        } else {
            cancellationFee = Math.round(booking.totalAmount * 0.1); // 10% fee
        }

        res.json({ 
            success: true, 
            booking: {
                _id: booking._id,
                checkIn: booking.checkIn,
                checkOut: booking.checkOut,
                totalAmount: booking.totalAmount,
                listing: {
                    title: booking.listing.title
                }
            },
            cancellationDetails: {
                cancellationFee,
                canUseFreeCancellation,
                freeCancellationsUsed: req.user.freeCancellationsUsed || 0,
                bookingAmount: booking.totalAmount
            }
        });
    } catch (error) {
        res.json({ success: false, error: 'Server error' });
    }
};

// Confirm cancellation via AJAX
module.exports.confirmCancellationAjax = async (req, res) => {
    try {
        const { id } = req.params;
        const booking = await Booking.findById(id).populate('listing');
        
        if (!booking) {
            return res.json({ success: false, error: 'Booking not found' });
        }

        // Check if user owns this booking
        if (!booking.user.equals(req.user._id)) {
            return res.json({ success: false, error: 'Unauthorized' });
        }

        // Calculate cancellation fee
        const isActiveMember = req.user && req.user.isMember && req.user.membershipExpiresAt && new Date(req.user.membershipExpiresAt) > new Date();
        const now = new Date();
        
        // Initialize cancellation tracking if not set (for existing members)
        if (isActiveMember && !req.user.freeCancellationsResetAt) {
            req.user.freeCancellationsResetAt = new Date(now.getFullYear(), now.getMonth() + 1, 1);
            req.user.freeCancellationsUsed = 0;
            await req.user.save();
        }
        
        // Reset free cancellations if it's a new month for members
        if (isActiveMember && req.user.freeCancellationsResetAt && now > req.user.freeCancellationsResetAt) {
            req.user.freeCancellationsUsed = 0;
            req.user.freeCancellationsResetAt = new Date(now.getFullYear(), now.getMonth() + 1, 1);
            await req.user.save();
        }

        let cancellationFee = 0;
        let canUseFreeCancellation = false;

        if (isActiveMember && req.user.freeCancellationsUsed < 2) {
            canUseFreeCancellation = true;
            cancellationFee = 0;
        } else {
            cancellationFee = Math.round(booking.totalAmount * 0.1); // 10% fee
        }

        // Update user's free cancellation count if applicable
        if (canUseFreeCancellation) {
            req.user.freeCancellationsUsed += 1;
            if (!req.user.freeCancellationsResetAt) {
                req.user.freeCancellationsResetAt = new Date(now.getFullYear(), now.getMonth() + 1, 1);
            }
            await req.user.save();
        }

        // Delete the booking
        await Booking.findByIdAndDelete(id);

        let message = 'Booking cancelled successfully!';
        if (cancellationFee > 0) {
            message += ` Cancellation fee: ₹${cancellationFee}`;
        } else {
            message += ' No cancellation fee (free cancellation used).';
        }

        res.json({
            success: true,
            message: message,
            user: {
                isMember: req.user.isMember,
                membershipExpiresAt: req.user.membershipExpiresAt,
                freeCancellationsUsed: req.user.freeCancellationsUsed
            }
        });
    } catch (error) {
        res.json({ success: false, error: 'Server error' });
    }
};

// Activate membership via AJAX
module.exports.activateMembershipAjax = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        if (!user) {
            return res.json({ success: false, error: 'User not found' });
        }
        
        const now = new Date();
        const expires = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        user.isMember = true;
        user.membershipExpiresAt = expires;
        
        // Initialize cancellation tracking for new members
        if (!user.freeCancellationsResetAt) {
            user.freeCancellationsResetAt = new Date(now.getFullYear(), now.getMonth() + 1, 1);
            user.freeCancellationsUsed = 0;
        }
        
        await user.save();
        
        res.json({
            success: true,
            message: 'Membership activated for 30 days!',
            user: {
                isMember: user.isMember,
                membershipExpiresAt: user.membershipExpiresAt,
                freeCancellationsUsed: user.freeCancellationsUsed
            }
        });
    } catch (error) {
        res.json({ success: false, error: 'Could not activate membership' });
    }
};

// Customer care dashboard
module.exports.customerCareDashboard = async (req, res) => {
    try {
        if (req.user.role !== 'customer_care') {
            req.flash('error', 'Access denied');
            return res.redirect('/listings');
        }
        
        res.render('customer-care/dashboard', { 
            currentUser: req.user 
        });
    } catch (error) {
        console.error('Customer care dashboard error:', error);
        req.flash('error', 'Error loading dashboard');
        res.redirect('/listings');
    }
};