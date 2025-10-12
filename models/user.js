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
        enum: ['user', 'manager', 'admin'],
        default: 'user'
    },
    // Manager-specific fields
    businessName: {
        type: String,
        required: function() {
            return this.role === 'manager';
        }
    },
    phoneNumber: {
        type: String,
        required: function() {
            return this.role === 'manager';
        }
    },
    businessDescription: {
        type: String,
        required: function() {
            return this.role === 'manager';
        }
    }
});

userSchema.plugin(passportLocalMongoose);

module.exports = mongoose.model('User', userSchema);