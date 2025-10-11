const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Taxi booking for rides from a hotel to a nearby destination
const taxiBookingSchema = new Schema({
    user: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    listing: {
        type: Schema.Types.ObjectId,
        ref: 'Listing',
        required: true
    },
    pickupLocation: {
        type: String,
        required: true
    },
    dropLocation: {
        type: String,
        required: true
    },
    distanceKm: {
        type: Number,
        required: true,
        min: 0
    },
    estimatedTimeMin: {
        type: Number,
        required: true,
        min: 1
    },
    taxiType: {
        type: String,
        enum: ['Standard', 'SUV', 'Luxury'],
        required: true
    },
    fareAmount: {
        type: Number,
        required: true,
        min: 0
    },
    paymentStatus: {
        type: String,
        enum: ['Pending', 'Paid', 'Failed'],
        default: 'Pending'
    },
    bookingStatus: {
        type: String,
        enum: ['Created', 'Confirmed', 'Cancelled'],
        default: 'Created'
    },
    razorpayOrderId: String,
    razorpayPaymentId: String,
    createdAt: {
        type: Date,
        default: Date.now
    }
});

taxiBookingSchema.index({ user: 1, createdAt: -1 });
taxiBookingSchema.index({ listing: 1, createdAt: -1 });

module.exports = mongoose.model('TaxiBooking', taxiBookingSchema);


