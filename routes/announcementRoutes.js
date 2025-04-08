const express = require("express");
const db = require("../config/db");

const router = express.Router();

// Get Announcements
router.get("/", (req, res) => {
  db.query("SELECT text, link FROM announcements", (err, results) => {
    if (err) return res.status(500).json({ message: "Database error" });
    res.status(200).json(results);
  });
});

module.exports = router;
