const express = require("express");
const multer = require("multer");
const db = require("../config/db");
const path = require("path");

const router = express.Router();

// Multer Config for File Uploads
const storage = multer.diskStorage({
  destination: "uploads/",
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(
      null,
      file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname)
    );
  },
});

const upload = multer({ storage: storage });

// Get all faculty members
router.get("/faculty", (req, res) => {
  const sql = `
    SELECT id, name, email, department, role, 
           image_url, google_scholar, linkedin_profile, room_number, education, articles, joining_date, bio
    FROM faculty
  `;

  db.query(sql, (err, result) => {
    if (err) {
      return res.status(500).json({
        message: "Error fetching faculty data",
        error: err.message,
      });
    }

    // Parse JSON strings back to arrays
    const faculty = result.map((member) => ({
      ...member,
      education: JSON.parse(member.education || "[]"),
      articles: JSON.parse(member.articles || "[]"),
    }));

    res.status(200).json(faculty);
  });
});

// Get a single faculty member by ID
router.get("/faculty/:id", (req, res) => {
  const sql = `
    SELECT id, name, email, department, role, 
           image_url, google_scholar, linkedin_profile, room_number, education, articles, joining_date, bio
    FROM faculty 
    WHERE id = ?
  `;

  db.query(sql, [req.params.id], (err, result) => {
    if (err) {
      return res.status(500).json({
        message: "Error fetching faculty member",
        error: err.message,
      });
    }
    if (result.length === 0) {
      return res.status(404).json({ message: "Faculty member not found" });
    }
    const faculty = result[0];
    faculty.education = JSON.parse(faculty.education || "[]");
    faculty.articles = JSON.parse(faculty.articles || "[]");
    res.status(200).json(faculty);
  });
});

// Add new faculty member
router.post("/add-faculty", upload.single("image"), async (req, res) => {
  try {
    const {
      name,
      email,
      department,
      role,
      bio,
      googleScholar,
      linkedinProfile,
      roomNumber,
      joiningDate,
      education,
      articles,
    } = req.body;

    if (!name || !email || !department || !role) {
      return res
        .status(400)
        .json({ message: "Name, email, department, and role are required." });
    }

    // Parse arrays if they're sent as strings
    const educationArray =
      typeof education === "string" ? JSON.parse(education) : education;
    const articlesArray =
      typeof articles === "string" ? JSON.parse(articles) : articles;

    const imagePath = req.file ? `${req.file.filename}` : null;

    const sql = `
      INSERT INTO faculty (
        name, email, department, role, bio, 
        image_url, google_scholar, linkedin_profile, room_number, joining_date, education, articles
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const values = [
      name,
      email,
      department,
      role,
      bio || null,
      imagePath,
      googleScholar || null,
      linkedinProfile || null,
      roomNumber || null,
      joiningDate || null,
      JSON.stringify(educationArray || []),
      JSON.stringify(articlesArray || []),
    ];

    db.query(sql, values, (err, result) => {
      if (err) {
        console.error("Database error:", err);
        return res.status(500).json({
          message: "Failed to add faculty member",
          error: err.message,
        });
      }
      res.status(201).json({
        message: "Faculty member added successfully!",
        id: result.insertId,
      });
    });
  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json({
      message: "Internal server error",
      error: error.message,
    });
  }
});

// Delete a faculty member by ID
router.delete("/delete-faculty/:id", (req, res) => {
  const facultyId = req.params.id;

  // SQL query to delete the faculty member
  const sql = `DELETE FROM faculty WHERE id = ?`;

  db.query(sql, [facultyId], (err, result) => {
    if (err) {
      console.error("Error deleting faculty member:", err);
      return res.status(500).json({
        message: "Error deleting faculty member",
        error: err.message,
      });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({
        message: "Faculty member not found",
      });
    }

    res.status(200).json({
      message: "Faculty member deleted successfully",
    });
  });
});

module.exports = router;
