const mongoose = require('mongoose');
const schema = mongoose.Schema;

const ReviewSchema = new schema({
    comment: {
        type: String
    },
    rating: {
        type: Number,
        min: 1,
        max: 5,
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    author: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
});

module.exports = mongoose.model('Review', ReviewSchema);    