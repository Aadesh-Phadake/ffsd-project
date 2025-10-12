const mongoose = require('mongoose');
const schema = mongoose.Schema;
const passportLocalMongoose = require('passport-local-mongoose');

const userSchema = new schema({
    email: {
        type: String,
        required: true,
        unique: true
    },
    role: {
        type: String,
        enum: ['traveller', 'manager', 'admin', 'customer_care'],
        default: 'traveller'
    },
    // Membership fields
    isMember: {
        type: Boolean,
        default: false
    },
    membershipExpiresAt: {
        type: Date,
        default: null
    },
    // Cancellation tracking
    freeCancellationsUsed: {
        type: Number,
        default: 0
    },
    freeCancellationsResetAt: {
        type: Date,
        default: null
    }
}, {
    timestamps: true  // This will automatically add createdAt and updatedAt fields
});

userSchema.plugin(passportLocalMongoose);

module.exports = mongoose.model('User', userSchema);