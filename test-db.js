// test-db.js
const db = require('./config/db');

async function testConnection() {
    try {
        console.log('Testing database connection...');
        const [result] = await db.execute('SELECT 1');
        console.log('✓ Database connection successful');
        
        console.log('\nChecking users table...');
        const [tables] = await db.execute("SHOW TABLES LIKE 'users'");
        if (tables.length > 0) {
            console.log('✓ Users table exists');
            
            const [users] = await db.execute('SELECT username, role FROM users');
            console.log('\nUsers in database:');
            users.forEach(user => {
                console.log(`  - ${user.username} (${user.role})`);
            });
        } else {
            console.log('✗ Users table does not exist');
        }
        
    } catch (error) {
        console.error('✗ Database error:', error.message);
    }
    process.exit();
}

testConnection();