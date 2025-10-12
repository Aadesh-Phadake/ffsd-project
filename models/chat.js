const mongoose = require('mongoose');
const schema = mongoose.Schema;

const chatSchema = new schema({
    participants: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }],
    messages: [{
        sender: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        message: {
            type: String,
            required: true,
            trim: true
        },
        timestamp: {
            type: Date,
            default: Date.now
        },
        isRead: {
            type: Boolean,
            default: false
        }
    }],
    lastMessage: {
        type: String,
        default: ''
    },
    lastMessageTime: {
        type: Date,
        default: Date.now
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

// Index for efficient querying
chatSchema.index({ participants: 1 });
chatSchema.index({ lastMessageTime: -1 });

module.exports = mongoose.model('Chat', chatSchema);
