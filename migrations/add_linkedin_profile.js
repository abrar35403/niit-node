const db = require("../config/db");

// Run this migration script to add the linkedin_profile column to the faculty table
db.query(
  "ALTER TABLE faculty ADD COLUMN linkedin_profile VARCHAR(255) AFTER google_scholar",
  (err, results) => {
    if (err) {
      console.error("Error adding linkedin_profile column:", err);
      process.exit(1);
    }
    console.log("linkedin_profile column added successfully!");
    process.exit(0);
  }
);
