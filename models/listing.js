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
    image: {
        type: String,
        default: "https://images.unsplash.com/photo-1657002865844-c4127d542c41?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTV8fGhvdGVscyUyMGRlZmF1bHR8ZW58MHx8MHx8fDA%3D",
        set:(v)=>v===""
        ?"https://images.unsplash.com/photo-1657002865844-c4127d542c41?w=500&auto=format&fit=crop&q=60&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxzZWFyY2h8MTV8fGhvdGVscyUyMGRlZmF1bHR8ZW58MHx8MHx8fDA%3D"
        :v
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
}
)
const Listing = mongoose.model('listing', ListingSchema);
module.exports = Listing;