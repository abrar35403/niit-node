const express = require("express");
const multer = require("multer");
const db = require("../config/db");
const verifyToken = require("../middleware/verifyToken");
const path = require("path");

const router = express.Router();

// Multer Config for File Uploads
const upload = multer({
  storage: multer.diskStorage({
    destination: "uploads/",
    filename: (req, file, cb) => {
      cb(null, Date.now() + path.extname(file.originalname));
    },
  }),
});

// Submit Student Form
router.post("/submit-student-form", verifyToken, upload.any(), (req, res) => {
  const {
    level,
    program,
    session,
    name,
    gender,
    cnic,
    maritalStatus,
    mobileNo,
    dob,
    email,
    religion,
    bloodGroup,
    address,
    country,
    province,
    city,
    fatherName,
    fatherOccupation,
    fatherCnic,
    fatherMobileNo,
    academicData,
  } = req.body;

  const image =
    req.files.find((file) => file.fieldname === "image")?.filename || null;

  // Insert student data
  const sql = `
        INSERT INTO students (level, program, session, name, gender, image, cnic, maritalStatus, mobileNo, dob, email, religion, bloodGroup, address, country, province, city, fatherName, fatherOccupation, fatherCnic, fatherMobileNo)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

  const values = [
    level,
    program,
    session,
    name,
    gender,
    image,
    cnic,
    maritalStatus,
    mobileNo,
    dob,
    email,
    religion,
    bloodGroup,
    address,
    country,
    province,
    city,
    fatherName,
    fatherOccupation,
    fatherCnic,
    fatherMobileNo,
  ];

  db.query(sql, values, (err, result) => {
    if (err) {
      console.error("Error inserting student data:", err);
      return res.status(500).json({ message: "Error inserting student data." });
    }

    // Insert Academic Records
    const academicValues = JSON.parse(academicData).map((record, index) => {
      const docFile = req.files.find(
        (file) => file.fieldname === `document_${index}`
      );
      return [
        email,
        record.degree,
        record.majorSubjects,
        record.totalMarks,
        record.obtainedMarks,
        record.percentage,
        record.passingYear,
        record.boardInstitution,
        docFile ? docFile.filename : null, // Save only the filename
      ];
    });

    const academicSql = `
          INSERT INTO academic_records (student_email, degree, majorSubjects, totalMarks, obtainedMarks, percentage, passingYear, boardInstitution, document)
          VALUES ?
        `;

    db.query(academicSql, [academicValues], (err, result) => {
      if (err) {
        console.error("Error inserting academic records:", err);
        return res
          .status(500)
          .json({ message: "Error inserting academic records." });
      }

      res.status(200).json({ message: "Student data submitted successfully!" });
    });
  });
});

// Fetch Student Info (with token verification)
router.get("/student-info", verifyToken, (req, res) => {
  const { email, allInfo } = req.query;

  if (!email) return res.status(400).json({ message: "Email is required" });

  const sql =
    allInfo === "1"
      ? "SELECT * FROM students WHERE email = ?"
      : "SELECT id, name , program , admit_card FROM students WHERE email = ?";
  db.query(sql, [email], (err, results) => {
    if (err) return res.status(500).json({ message: "Database error" });
    if (results.length === 0)
      return res.status(404).json({ message: "No student found" });

    res.status(200).json(results[0]);
  });
});

// Fetch All Students
router.get("/all_students", (req, res) => {
  const sql = `
    SELECT id, level, program, name, image, email, fee_voucher, admit_card 
    FROM students
  `;

  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ message: "Database error" });
    res.status(200).json(results);
  });
});

// Add a new endpoint to fetch academic records
router.get("/academic-records", (req, res) => {
  const { email } = req.query; // Get email from request query

  if (!email) {
    return res.status(400).json({ message: "Email is required" });
  }

  // Query to get the academic records of the student
  const sql = "SELECT * FROM academic_records WHERE student_email = ?";

  db.query(sql, [email], (err, results) => {
    if (err) {
      console.error("Database error:", err);
      return res.status(500).json({ message: "Database error" });
    }

    if (results.length === 0) {
      return res
        .status(404)
        .json({ message: "No academic records found for this email" });
    }

    res.status(200).json(results); // Return academic records
  });
});

// studets fee vocher approve
router.put("/approve-student", verifyToken, (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: "Student email is required" });
  }

  const sql = `
      UPDATE students 
      SET admit_card = '1' 
      WHERE email = ?
    `;

  db.query(sql, [email], (err, result) => {
    if (err) {
      console.error("Database error:", err);
      return res.status(500).json({ message: "Database error" });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Student not found" });
    }

    res.status(200).json({ message: "Student approved successfully!" });
  });
});

// Search Students
router.get("/search-students", verifyToken, (req, res) => {
  const { email, program, degree, status, action } = req.query;

  // Check if all parameters are empty
  const isAllEmpty =
    !email &&
    (!program || program === "All Programs") &&
    (!degree || degree === "All Degrees") &&
    (!status || status === "All Status") &&
    (!action || action === "All Actions");

  // If all parameters are empty, return all students
  if (isAllEmpty) {
    const allStudentsSql = `
      SELECT id, level, program, name, image, email, fee_voucher, admit_card 
      FROM students
    `;

    db.query(allStudentsSql, (err, results) => {
      if (err) {
        console.error("Database error:", err);
        return res.status(500).json({ message: "Database error" });
      }
      return res.status(200).json(results);
    });
  } else {
    // Proceed with filtered search if any parameter is not empty
    let sql = `
      SELECT id, level, program, name, image, email, fee_voucher, admit_card 
      FROM students
      WHERE 1=1
    `;
    const values = [];

    if (email) {
      sql += " AND email LIKE ?";
      values.push(`%${email}%`);
    }

    if (program && program !== "All Programs") {
      sql += " AND program = ?";
      values.push(program);
    }

    if (degree && degree !== "All Degrees") {
      sql += " AND program LIKE ?";
      values.push(`${degree}%`);
    }

    if (status && status !== "All Status") {
      if (status == "paid") {
        sql += " AND fee_voucher IS NOT NULL";
      } else {
        sql += " AND fee_voucher IS NULL";
      }
    }

    if (action && action !== "All Actions") {
      if (action === "Approve") {
        sql += " AND admit_card Is null ";
      } else if (action === "Approved") {
        sql += " AND admit_card = '1'";
      }
    }

    db.query(sql, values, (err, results) => {
      if (err) {
        console.error("Database error:", err);
        return res.status(500).json({ message: "Database error" });
      }
      res.status(200).json(results);
    });
  }
});

module.exports = router;
