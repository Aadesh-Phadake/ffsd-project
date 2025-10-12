const express = require('express');
const router = express.Router();
const wrapAsync = require('../utils/wrapAsync');
const { isLoggedIn } = require('../middleware');

const chatController = require('../controllers/chat');

// Customer care specific route
router.get('/customer-care/chats', isLoggedIn, wrapAsync(chatController.getCustomerCareChats));

// API route for customer care chats (JSON)
router.get('/api/customer-care/chats', isLoggedIn, wrapAsync(chatController.getCustomerCareChatsApi));

// Get specific chat by ID (must come before /chats)
router.get('/chats/:chatId', isLoggedIn, wrapAsync(chatController.getChatById));

// Get or create chat (must come after /chats/:chatId)
router.get('/chats', isLoggedIn, wrapAsync(chatController.getOrCreateChat));

// Send message
router.post('/chats/:chatId/message', isLoggedIn, wrapAsync(chatController.sendMessage));

// Get chat messages
router.get('/chats/:chatId/messages', isLoggedIn, wrapAsync(chatController.getChatMessages));

// Mark messages as read
router.post('/chats/:chatId/read', isLoggedIn, wrapAsync(chatController.markAsRead));

module.exports = router;
