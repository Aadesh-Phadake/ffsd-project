# Chat System Features

## Overview
The TravelNest application now includes a comprehensive chat system that allows travelers to communicate with customer care employees for booking assistance and support.

## Features Implemented

### 1. User Roles
- **Traveller**: Can initiate chats with customer care employees
- **Customer Care Employee**: Can view and respond to all traveler chats
- **Manager**: Hotel managers (no chat access)
- **Admin**: System administrators (no chat access)

### 2. Chat Functionality
- **Real-time Messaging**: Messages are sent and received instantly
- **Message History**: All conversations are stored and can be viewed
- **Read Status**: Messages can be marked as read/unread
- **Auto-refresh**: Messages automatically refresh every 3 seconds
- **Responsive Design**: Works on desktop and mobile devices

### 3. User Interface
- **Traveller View**: Clean chat interface with customer support
- **Customer Care Dashboard**: Overview of all active chats
- **Chat List**: Customer care employees can see all conversations
- **Message Indicators**: Unread message counts and visual indicators

### 4. Navigation
- **Traveller**: "Customer Support" link in header
- **Customer Care**: "Chats" link in header + dedicated dashboard

## How to Use

### For Travelers
1. Sign up as a "Traveller" or log in with existing account
2. Click "Customer Support" in the header
3. Start typing messages to get help with bookings
4. Customer care employees will respond to your queries

### For Customer Care Employees
1. Sign up as "Customer Care Employee" or log in with existing account
2. Access the "Customer Care Dashboard" from the header
3. Click "Chats" to see all active conversations
4. Select a chat to view and respond to traveler messages

## Technical Implementation

### Models
- **Chat Model**: Stores chat conversations and messages
- **User Model**: Updated to include 'customer_care' role

### Routes
- `/chats` - Main chat interface
- `/customer-care/chats` - Customer care chat list
- `/chats/:chatId/message` - Send message
- `/chats/:chatId/messages` - Get messages
- `/chats/:chatId/read` - Mark as read

### Controllers
- **Chat Controller**: Handles all chat-related operations
- **User Controller**: Updated to handle customer care role

## Database Schema

### Chat Collection
```javascript
{
  participants: [ObjectId], // Array of user IDs
  messages: [{
    sender: ObjectId,
    message: String,
    timestamp: Date,
    isRead: Boolean
  }],
  lastMessage: String,
  lastMessageTime: Date,
  isActive: Boolean
}
```

## Security Features
- User authentication required for all chat operations
- Users can only access chats they participate in
- Role-based access control for customer care features

## Future Enhancements
- Real-time notifications using WebSockets
- File sharing capabilities
- Chat history search
- Typing indicators
- Message reactions
- Chat transcripts export
