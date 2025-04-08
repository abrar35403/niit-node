const db = require("../config/db");
const fs = require("fs");
const path = require("path");

// Read the SQL file
const sqlFilePath = path.join(__dirname, "add_reset_token_column.sql");
const sql = fs.readFileSync(sqlFilePath, "utf8");

// Execute the SQL query
db.query(sql, (err, result) => {
  if (err) {
    console.error("Error updating users table:", err);
    process.exit(1);
  }

  console.log("Successfully added reset_token column to users table!");
  db.end(); // Close the database connection
  process.exit(0);
});
