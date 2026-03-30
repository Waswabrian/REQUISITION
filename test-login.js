// test-login-direct.js
const bcrypt = require('bcrypt');
const db = require('./config/db');

async function testLogin() {
    console.log('=================================');
    console.log('TESTING LOGIN FOR ALL USERS');
    console.log('=================================\n');
    
    try {
        // Get all users
        const [users] = await db.execute('SELECT id, username, role, password_hash FROM users');
        
        if (users.length === 0) {
            console.log('❌ No users found in database!');
            return;
        }
        
        console.log(`Found ${users.length} user(s):\n`);
        
        for (const user of users) {
            console.log(`Testing: ${user.username} (${user.role})`);
            console.log(`   Hash length: ${user.password_hash.length}`);
            
            // Test with password123
            const match = await bcrypt.compare('password123', user.password_hash);
            
            if (match) {
                console.log(`   ✅ Login SUCCESSFUL with password: password123\n`);
            } else {
                console.log(`   ❌ Login FAILED with password: password123`);
                
                // Try to see what's wrong
                console.log(`   Hash preview: ${user.password_hash.substring(0, 30)}...`);
                console.log(`   Hash should start with: $2b$10$...`);
                console.log(`   Does it start with $2b$? ${user.password_hash.startsWith('$2b$') ? 'Yes' : 'No'}\n`);
            }
        }
        
        console.log('=================================');
        console.log('\n💡 TIP: If logins are failing, run: node fix-passwords.js');
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await db.end();
        process.exit();
    }
}

testLogin();