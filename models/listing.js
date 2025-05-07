const mongoose = require('mongoose');
const schema = mongoose.Schema;
const Review = require('./review');

const ListingSchema = new schema({
    title: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    images: {
        type: [String],
        default: ["https://images.unsplash.com/photo-1657002865844-c4127d542c41?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTV8fGhvdGVscyUyMGRlZmF1bHR8ZW58MHx8MHx8fDA%3D"],
        validate: {
            validator: function(v) {
                return v.length <= 20; // Maximum 20 images allowed
            },
            message: 'Maximum 20 images allowed'
        }
    },
    price: {
        type: Number,
        required: true
    },
    location: {
        type: String,
        required: true
    },
    country: {
        type: String,
        required: true
    },
    reviews: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Review'
        }
    ],
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    lastUpdated: {
        type: Date,
        default: Date.now
    }
});

ListingSchema.post('findOneAndDelete', async function (listing) {
    if (listing) {
        await Review.deleteMany({
            _id: {
                $in: listing.reviews
            }
        })
    }
});

const Listing = mongoose.model('Listing', ListingSchema);
module.exports = Listing;