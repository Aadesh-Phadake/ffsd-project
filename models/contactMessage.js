const mongoose = require('mongoose');

const contactMessageSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true },
        email: { type: String, required: true, trim: true },
        message: { type: String, required: true, trim: true, maxlength: 5000 },
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
    },
    { timestamps: true }
);

module.exports = mongoose.model('ContactMessage', contactMessageSchema);


