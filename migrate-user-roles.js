require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/user');

// Connect to MongoDB
async function main() {
    try {
        await mongoose.connect(process.env.MONGO_URL);
        console.log('Connected to MongoDB for migration');
        
        // Set admin role for TravelNest user
        const adminResult = await User.updateOne(
            { username: 'TravelNest' },
            { $set: { role: 'admin' } }
        );
        console.log(`Admin user updated: ${adminResult.modifiedCount} user(s)`);
        
        // Set default role for users without roles (excluding TravelNest)
        const defaultResult = await User.updateMany(
            { 
                role: { $exists: false },
                username: { $ne: 'TravelNest' }
            },
            { $set: { role: 'traveller' } }
        );
        console.log(`Default roles set: ${defaultResult.modifiedCount} user(s)`);
        
        // Show updated users
        const users = await User.find({}, 'username role').sort('username');
        console.log('\nUser roles after migration:');
        users.forEach(user => {
            console.log(`- ${user.username}: ${user.role}`);
        });
        
        console.log('\nMigration completed successfully!');
        process.exit(0);
        
    } catch (err) {
        console.error('Migration error:', err);
        process.exit(1);
    }
}

main();