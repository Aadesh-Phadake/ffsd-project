const Chat = require('../models/chat');
const User = require('../models/user');

// Get or create chat between traveller and customer care
module.exports.getOrCreateChat = async (req, res) => {
    try {
        const currentUser = req.user;
        let chat;
        
        if (currentUser.role === 'traveller') {
            // Find a customer care employee
            const customerCareEmployee = await User.findOne({ role: 'customer_care' });
            if (!customerCareEmployee) {
                req.flash('error', 'No customer care employee available at the moment');
                return res.redirect('/listings');
            }
            
            // Check if chat already exists
            chat = await Chat.findOne({
                participants: { $all: [currentUser._id, customerCareEmployee._id] }
            }).populate('participants', 'username role');
            
            if (!chat) {
                // Create new chat
                chat = new Chat({
                    participants: [currentUser._id, customerCareEmployee._id]
                });
                await chat.save();
                chat = await Chat.findById(chat._id).populate('participants', 'username role');
            }
        } else if (currentUser.role === 'customer_care') {
            // Get all chats for customer care employee
            const chats = await Chat.find({
                participants: currentUser._id
            }).populate('participants', 'username role').sort({ lastMessageTime: -1 });
            
            return res.render('chats/customer-care', { 
                chats, 
                currentUser 
            });
        } else {
            req.flash('error', 'Access denied');
            return res.redirect('/listings');
        }
        
        res.render('chats/chat', { 
            chat, 
            currentUser 
        });
    } catch (error) {
        console.error('Chat error:', error);
        req.flash('error', 'Error loading chat');
        res.redirect('/listings');
    }
};

// Send message
module.exports.sendMessage = async (req, res) => {
    try {
        const { chatId, message } = req.body;
        const currentUser = req.user;
        
        if (!message || !message.trim()) {
            return res.json({ success: false, error: 'Message cannot be empty' });
        }
        
        const chat = await Chat.findById(chatId);
        if (!chat) {
            return res.json({ success: false, error: 'Chat not found' });
        }
        
        // Check if user is participant
        if (!chat.participants.includes(currentUser._id)) {
            return res.json({ success: false, error: 'Unauthorized' });
        }
        
        // Add message to chat
        const newMessage = {
            sender: currentUser._id,
            message: message.trim(),
            timestamp: new Date()
        };
        
        chat.messages.push(newMessage);
        chat.lastMessage = message.trim();
        chat.lastMessageTime = new Date();
        await chat.save();
        
        // Populate sender info
        const populatedChat = await Chat.findById(chatId)
            .populate('participants', 'username role')
            .populate('messages.sender', 'username role');
        
        res.json({ 
            success: true, 
            message: newMessage,
            chat: populatedChat
        });
    } catch (error) {
        console.error('Send message error:', error);
        res.json({ success: false, error: 'Failed to send message' });
    }
};

// Get chat messages
module.exports.getChatMessages = async (req, res) => {
    try {
        const { chatId } = req.params;
        const currentUser = req.user;
        
        const chat = await Chat.findById(chatId)
            .populate('participants', 'username role')
            .populate('messages.sender', 'username role');
            
        if (!chat) {
            return res.json({ success: false, error: 'Chat not found' });
        }
        
        // Check if user is participant
        if (!chat.participants.some(p => p._id.toString() === currentUser._id.toString())) {
            return res.json({ success: false, error: 'Unauthorized' });
        }
        
        res.json({ 
            success: true, 
            chat 
        });
    } catch (error) {
        console.error('Get messages error:', error);
        res.json({ success: false, error: 'Failed to get messages' });
    }
};

// Get specific chat by ID
module.exports.getChatById = async (req, res) => {
    try {
        const { chatId } = req.params;
        const currentUser = req.user;
        
        const chat = await Chat.findById(chatId)
            .populate('participants', 'username role')
            .populate('messages.sender', 'username role');
            
        if (!chat) {
            req.flash('error', 'Chat not found');
            return res.redirect('/listings');
        }
        
        // Check if user is participant
        if (!chat.participants.some(p => p._id.toString() === currentUser._id.toString())) {
            req.flash('error', 'Access denied');
            return res.redirect('/listings');
        }
        
        res.render('chats/chat', { 
            chat, 
            currentUser 
        });
    } catch (error) {
        console.error('Get chat by ID error:', error);
        req.flash('error', 'Error loading chat');
        res.redirect('/listings');
    }
};

// Get all chats for customer care employee
module.exports.getCustomerCareChats = async (req, res) => {
    try {
        const currentUser = req.user;
        
        if (currentUser.role !== 'customer_care') {
            req.flash('error', 'Access denied');
            return res.redirect('/listings');
        }
        
        const chats = await Chat.find({
            participants: currentUser._id
        }).populate('participants', 'username role').sort({ lastMessageTime: -1 });
        
        
        // For AJAX requests, return JSON
        if (req.headers.accept && req.headers.accept.includes('application/json')) {
            return res.json({
                success: true,
                chats: chats.map(chat => {
                    const otherParticipant = chat.participants.find(p => p._id.toString() !== currentUser._id.toString());
                    const unreadCount = chat.messages.filter(msg => 
                        msg.sender.toString() !== currentUser._id.toString() && !msg.isRead
                    ).length;
                    
                    return {
                        _id: chat._id,
                        otherParticipant: otherParticipant,
                        lastMessage: chat.lastMessage,
                        lastMessageTime: chat.lastMessageTime,
                        unreadCount: unreadCount
                    };
                })
            });
        }
        
        res.render('chats/customer-care', { 
            chats, 
            currentUser 
        });
    } catch (error) {
        console.error('Get chats error:', error);
        req.flash('error', 'Error loading chats');
        res.redirect('/listings');
    }
};

// Mark messages as read
module.exports.markAsRead = async (req, res) => {
    try {
        const { chatId } = req.params;
        const currentUser = req.user;
        
        const chat = await Chat.findById(chatId);
        if (!chat) {
            return res.json({ success: false, error: 'Chat not found' });
        }
        
        // Check if user is participant
        if (!chat.participants.includes(currentUser._id)) {
            return res.json({ success: false, error: 'Unauthorized' });
        }
        
        // Mark messages as read for the current user
        chat.messages.forEach(msg => {
            if (msg.sender.toString() !== currentUser._id.toString()) {
                msg.isRead = true;
            }
        });
        
        await chat.save();
        
        res.json({ success: true });
    } catch (error) {
        console.error('Mark as read error:', error);
        res.json({ success: false, error: 'Failed to mark as read' });
    }
};

// API route for customer care chats (JSON only)
module.exports.getCustomerCareChatsApi = async (req, res) => {
    try {
        const currentUser = req.user;
        
        if (currentUser.role !== 'customer_care') {
            return res.json({ success: false, error: 'Access denied' });
        }
        
        const chats = await Chat.find({
            participants: currentUser._id
        }).populate('participants', 'username role').sort({ lastMessageTime: -1 });
        
        const chatData = chats.map(chat => {
            const otherParticipant = chat.participants.find(p => p._id.toString() !== currentUser._id.toString());
            const unreadCount = chat.messages.filter(msg => 
                msg.sender.toString() !== currentUser._id.toString() && !msg.isRead
            ).length;
            
            return {
                _id: chat._id,
                otherParticipant: otherParticipant,
                lastMessage: chat.lastMessage,
                lastMessageTime: chat.lastMessageTime,
                unreadCount: unreadCount
            };
        });
        
        res.json({
            success: true,
            chats: chatData
        });
    } catch (error) {
        console.error('Get chats API error:', error);
        res.json({ success: false, error: 'Error loading chats' });
    }
};
