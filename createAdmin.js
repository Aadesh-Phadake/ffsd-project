require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/user');

const MONGO_URL = 'mongodb://localhost:27017/ffsd-project';

async function createAdminUser() {
    try {
        await mongoose.connect(MONGO_URL);
        console.log('Connected to MongoDB');

        // Check if admin user already exists
        const existingUser = await User.findOne({ username: 'TravelNest' });
        if (existingUser) {
            console.log('Admin user already exists. Skipping creation.');
        } else {
            const adminUser = new User({ email: 'admin@travelnest.com', username: 'TravelNest' });
            await User.register(adminUser, 'admin123');
            console.log('Admin user created successfully!');
        }
    } catch (error) {
        console.error('Error creating admin user:', error);
    } finally {
        await mongoose.connection.close();
    }
}

createAdminUser();
