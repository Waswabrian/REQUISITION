const mysql = require('mysql2');

const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',      // Your MySQL username
    password: 'yourpassword', 
    database: 'octagon_db'
});

module.exports = pool.promise();