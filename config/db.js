const mysql = require("mysql");
require("dotenv").config();

// Log environment for debugging (you can remove this in production)
console.log("Node Environment:", process.env.NODE_ENV);

// Get database config from environment variables
const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
};

// Create a connection pool instead of a single connection
const pool = mysql.createPool({
  host: dbConfig.host,
  user: dbConfig.user,
  password: dbConfig.password,
  database: dbConfig.database,
  connectionLimit: 10,
  waitForConnections: true,
  queueLimit: 0,
});

// Test the connection on startup
pool.getConnection((err, connection) => {
  if (err) {
    console.error("Database connection failed:", err);
    return;
  }
  console.log(
    `Connected to the database '${dbConfig.database}' on ${dbConfig.host}`
  );
  connection.release();
});

// Promisify the query method for easier async/await usage
const db = {
  query: (sql, args) => {
    return new Promise((resolve, reject) => {
      pool.query(sql, args, (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    });
  },
  // Add the pool to allow direct access if needed
  pool: pool,
};

module.exports = db;
