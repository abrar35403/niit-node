const express = require("express");
const multer = require("multer");
const path = require("path");
const db = require("../config/db");
const verifyToken = require("../middleware/verifyToken");

const router = express.Router();

// Multer configuration for CV uploads
const upload = multer({
  storage: multer.diskStorage({
    destination: "uploads/cv",
    filename: (req, file, cb) => {
      cb(null, Date.now() + path.extname(file.originalname));
    },
  }),
});

// const upload = multer({ storage: storage });

// Route to get all job listings
router.get("/job-listings", (req, res) => {
  const sql = "SELECT * FROM job_listings";
  db.query(sql, (err, results) => {
    if (err) {
      console.error("Error fetching job listings:", err);
      return res.status(500).json({ message: "Error fetching job listings" });
    }
    res.json(results);
  });
});

// Route to handle job application submissions
router.post("/apply", upload.single("file"), (req, res) => {
  const { name, email, department, experiences } = req.body;
  const cvUrl = req.file ? req.file.path : null;

  const sql =
    "INSERT INTO job_applications (name, email, department, experiences, cv_url) VALUES (?, ?, ?, ?, ?)";
  db.query(
    sql,
    [name, email, department, experiences, cvUrl],
    (err, result) => {
      if (err) {
        console.error("Error submitting application:", err);
        return res
          .status(500)
          .json({ message: "Error submitting application" });
      }
      res.status(201).json({
        message: "Application submitted successfully",
        id: result.insertId,
      });
    }
  );
});

// Route to get all applications (admin only)
router.get("/applications", (req, res) => {
  const sql = "SELECT * FROM job_applications ORDER BY applied_at DESC";
  db.query(sql, (err, results) => {
    if (err) {
      console.error("Error fetching applications:", err);
      return res.status(500).json({ message: "Error fetching applications" });
    }
    res.json(results);
  });
});

// Route to download CV (admin only)
router.get("/download-cv/:id", (req, res) => {
  const sql = "SELECT cv_url FROM job_applications WHERE id = ?";
  db.query(sql, [req.params.id], (err, results) => {
    if (err) {
      console.error("Error fetching CV:", err);
      return res.status(500).json({ message: "Error fetching CV" });
    }
    if (results.length === 0 || !results[0].cv_url) {
      return res.status(404).json({ message: "CV not found" });
    }
    res.download(results[0].cv_url);
  });
});

module.exports = router;
