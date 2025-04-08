const express = require("express");
const db = require("../config/db");
const router = express.Router();

// Get current application status
router.get("/application-status", async (req, res) => {
  try {
    // Check if the setting exists
    db.query(
      "SELECT * FROM settings WHERE name = 'application_status'",
      (err, results) => {
        if (err) {
          console.error("Database error:", err);
          return res
            .status(500)
            .json({ message: "Error retrieving application status" });
        }

        // If the setting exists, return its value
        if (results.length > 0) {
          return res.status(200).json({ isOpen: results[0].value === "open" });
        } else {
          // If setting doesn't exist, create it with default value "closed"
          db.query(
            "INSERT INTO settings (name, value) VALUES ('application_status', 'closed')",
            (insertErr) => {
              if (insertErr) {
                console.error("Database error:", insertErr);
                return res.status(500).json({
                  message: "Error creating application status setting",
                });
              }

              return res.status(200).json({ isOpen: false });
            }
          );
        }
      }
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Update application status
router.post("/application-status", async (req, res) => {
  try {
    const { isOpen } = req.body;
    const status = isOpen ? "open" : "closed";

    // Update or insert the setting
    db.query(
      "INSERT INTO settings (name, value) VALUES ('application_status', ?) ON DUPLICATE KEY UPDATE value = ?",
      [status, status],
      (err) => {
        if (err) {
          console.error("Database error:", err);
          return res
            .status(500)
            .json({ message: "Error updating application status" });
        }

        return res.status(200).json({
          isOpen: isOpen,
          message: `Applications are now ${isOpen ? "open" : "closed"}`,
        });
      }
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
