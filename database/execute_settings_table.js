const db = require("../config/db");
const fs = require("fs");
const path = require("path");

// Read the SQL file
const sqlFilePath = path.join(__dirname, "create_settings_table.sql");
const sql = fs.readFileSync(sqlFilePath, "utf8");

// Execute the SQL query
db.query(sql, (err, result) => {
  if (err) {
    console.error("Error creating settings table:", err);
    process.exit(1);
  }

  console.log("Successfully created settings table!");

  // Set default application status to closed
  db.query(
    "INSERT IGNORE INTO settings (name, value) VALUES ('application_status', 'closed')",
    (insertErr) => {
      if (insertErr) {
        console.error("Error setting default application status:", insertErr);
        process.exit(1);
      }

      console.log("Default application status set to closed");
      db.end(); // Close the database connection
      process.exit(0);
    }
  );
});
