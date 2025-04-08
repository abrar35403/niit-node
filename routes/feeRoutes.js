const express = require("express");
const multer = require("multer");
const db = require("../config/db");
const path = require("path");
const verifyToken = require("../middleware/verifyToken");

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

// Upload Fee Voucher
router.post(
  "/upload-fee-voucher",
  verifyToken,
  upload.single("file"),
  (req, res) => {
    const { email } = req.body;
    const filePath = req.file ? req.file.filename : null;

    if (!email || !filePath) {
      return res.status(400).json({ message: "Email and file are required." });
    }

    const sql = `
    UPDATE students
    SET fee_voucher = ?
    WHERE email = ?
  `;
    const values = [filePath, email];

    db.query(sql, values, (err, result) => {
      if (err)
        return res.status(500).json({ message: "Failed to update student" });
      res.status(200).json({ message: "Fee voucher uploaded successfully!" });
    });
  }
);

module.exports = router;
