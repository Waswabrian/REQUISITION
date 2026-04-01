const fs = require('fs');
const path = require('path');

console.log('🔍 Checking database configuration...\n');

// Check if config directory exists
const configDir = path.join(__dirname, 'config');
if (!fs.existsSync(configDir)) {
    console.log('📁 Creating config directory...');
    fs.mkdirSync(configDir);
}

// Check db.js
const dbFile = path.join(configDir, 'db.js');
if (!fs.existsSync(dbFile)) {
    console.log('📝 Creating db.js...');
    
    const dbContent = `const mysql = require('mysql2/promise');

const pool = mysql.createPool({
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: '',  // ⚠️ Add your MySQL password if you have one
    database: 'octagon_requisition',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Test connection
pool.getConnection()
    .then(conn => {
        console.log('✅ Database connected');
        conn.release();
    })
    .catch(err => {
        console.error('❌ Database connection failed:', err.message);
    });

module.exports = {
    pool,
    execute: async (sql, params) => {
        const [rows] = await pool.execute(sql, params);
        return rows;
    },
    query: async (sql, params) => {
        const [rows] = await pool.query(sql, params);
        return rows;
    }
};`;
    
    fs.writeFileSync(dbFile, dbContent);
    console.log('✅ Created db.js');
} else {
    console.log('✅ db.js exists');
}

// Check index.js for proper db import
const indexFile = path.join(__dirname, 'index.js');
if (fs.existsSync(indexFile)) {
    let content = fs.readFileSync(indexFile, 'utf8');
    
    // Check if db is imported
    if (!content.includes("require('./config/db')") && !content.includes('require("./config/db")')) {
        console.log('\n⚠️ Warning: index.js might not be importing the database correctly');
        console.log('Make sure you have: const db = require(\'./config/db\'); at the top');
    }
}

console.log('\n✅ Setup complete! Now run: node index.js');