// fix-passwords.js
const bcrypt = require('bcrypt');
const db = require('../config/db');

async function fixPasswords() {
    console.log('=================================');
    console.log('FIXING PASSWORDS');
    console.log('=================================');
    
    try {
        // Generate a fresh hash for 'password123'
        const password = 'password123';
        const hashedPassword = await bcrypt.hash(password, 10);
        
        console.log('\nGenerated hash:', hashedPassword);
        console.log('Length:', hashedPassword.length);
        
        // List all users
        console.log('\nCurrent users:');
        const [users] = await db.execute('SELECT id, username, role FROM users');
        users.forEach(u => {
            console.log(`   ${u.username} (${u.role})`);
        });
        
        // Update all users with the new hash
        console.log('\nUpdating passwords...');
        for (const user of users) {
            await db.execute(
                'UPDATE users SET password_hash = ? WHERE id = ?',
                [hashedPassword, user.id]
            );
            console.log(`   ✅ Updated: ${user.username}`);
        }
        
        // Verify the passwords work
        console.log('\nVerifying passwords...');
        let allGood = true;
        
        for (const user of users) {
            const [rows] = await db.execute('SELECT password_hash FROM users WHERE id = ?', [user.id]);
            const storedHash = rows[0].password_hash;
            const match = await bcrypt.compare(password, storedHash);
            
            console.log(`   ${user.username}: ${match ? '✅ OK' : '❌ FAILED'}`);
            if (!match) allGood = false;
        }
        
        if (allGood) {
            console.log('\n✅ ALL PASSWORDS FIXED!');
            console.log('\n🔐 Login credentials:');
            console.log('   Username: ANY of the users above');
            console.log('   Password: password123');
        } else {
            console.log('\n❌ Some passwords still not working');
        }
        
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await db.end();
        process.exit();
    }
}

fixPasswords();