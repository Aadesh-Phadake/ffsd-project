const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const requestSchema = new Schema({
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
    booking: {
        type: Schema.Types.ObjectId,
        ref: 'Booking',
        required: true
    },
    type: {
        type: String,
        enum: ['service', 'complaint'],
        required: true
    },
    message: {
        type: String,
        required: true,
        trim: true,
        maxlength: 1000
    },
    status: {
        type: String,
        enum: ['open', 'in_progress', 'resolved'],
        default: 'open'
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Request', requestSchema);



