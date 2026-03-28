// const mysql = require('mysql2');

// const pool = mysql.createPool({
//     host: 'localhost',
//     user: 'root',      // Your MySQL username
//     password: 'yourpassword', 
//     database: 'octagon_db'
// });

// module.exports = pool.promise();

const mysql = require('mysql2');

// Create the connection pool
const pool = mysql.createPool({
  host: 'localhost',
  port: 3306,
  user: 'root',          // Your MySQL username
  password: 'your_password', // Your MySQL password
  database: 'octagon_requisition',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Export the promise-based version for async/await
module.exports = pool.promise();