const db = require("../config/db");

// Run this migration script to add the room_number column to the faculty table
db.query(
  "ALTER TABLE faculty ADD COLUMN room_number VARCHAR(50) AFTER linkedin_profile",
  (err, results) => {
    if (err) {
      console.error("Error adding room_number column:", err);
      process.exit(1);
    }
    console.log("room_number column added successfully!");
    process.exit(0);
  }
);
