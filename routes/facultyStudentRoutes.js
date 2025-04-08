const express = require("express");
const db = require("../config/db");
const jwt = require("jsonwebtoken");
const JWT_SECRET = require("../config/jwt");
const nodemailer = require("nodemailer");

const router = express.Router();

// Configure nodemailer
const transporter = nodemailer.createTransport({
  service: "gmail", // Replace with your email service
  auth: {
    user: process.env.EMAIL_USER, // Your email
    pass: process.env.EMAIL_PASSWORD, // Your email password or app password
  },
});

// Faculty/Student Login
router.post("/faculty-student-login", (req, res) => {
  const { email, password } = req.body;

  db.query("SELECT * FROM users WHERE email = ?", [email], (err, results) => {
    if (err) return res.status(500).json({ message: "Database error" });

    if (results.length === 0) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    const user = results[0];
    if (user.password !== password) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    const token = jwt.sign(
      { email: user.email, id: user.id, role: user.role },
      JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.status(200).json({
      message: "Login successful!",
      role: user.role,
      token,
      userName: `${user.first_name} ${user.last_name}`,
    });
  });
});

// Generate and send reset password token for faculty/students
router.post("/forgot-password", async (req, res) => {
  const { email } = req.body;

  try {
    // Check if user exists
    db.query(
      "SELECT * FROM users WHERE email = ?",
      [email],
      async (err, results) => {
        if (err) return res.status(500).json({ message: "Database error" });

        if (results.length === 0) {
          return res.status(404).json({ message: "User not found." });
        }

        const user = results[0];

        // Generate a reset token
        const resetToken = jwt.sign({ email: user.email }, JWT_SECRET, {
          expiresIn: "1h",
        });

        // Store the reset token in the database
        db.query(
          "UPDATE users SET reset_token = ? WHERE email = ?",
          [resetToken, email],
          (updateErr) => {
            if (updateErr) {
              console.error("Database error:", updateErr);
              return res
                .status(500)
                .json({ message: "Error updating reset token." });
            }

            // Send reset password email
            const resetLink = `/portal/reset-password/${resetToken}`;
            const mailOptions = {
              from: process.env.EMAIL_USER,
              to: email,
              subject: "Reset Your Password - NIIT Portal",
              html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
                <h2 style="color: #333;">Reset Your NIIT Portal Password</h2>
                <p>You have requested to reset your password. Click the link below to set a new password:</p>
                <a href="${resetLink}" style="display: inline-block; padding: 10px 20px; background-color: #007bff; color: #ffffff; text-decoration: none; border-radius: 5px;">Reset Password</a>
                <p>This link will expire in 1 hour.</p>
                <p>If you didn't request this, please ignore this email or contact support.</p>
              </div>
            `,
            };

            transporter.sendMail(mailOptions, (error, info) => {
              if (error) {
                console.error("Email sending error:", error);
                return res
                  .status(500)
                  .json({ message: "Failed to send reset password email" });
              }
              res
                .status(200)
                .json({ message: "Reset password link sent successfully" });
            });
          }
        );
      }
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Reset password for faculty/students
router.post("/reset-password", async (req, res) => {
  const { token, newPassword } = req.body;

  try {
    // Verify the token
    const decoded = jwt.verify(token, JWT_SECRET);
    const { email } = decoded;

    // Check if the token exists in the database
    db.query(
      "SELECT * FROM users WHERE email = ? AND reset_token = ?",
      [email, token],
      (err, results) => {
        if (err) return res.status(500).json({ message: "Database error" });

        if (results.length === 0) {
          return res.status(400).json({ message: "Invalid or expired token." });
        }

        // Update the password and clear the reset token
        db.query(
          "UPDATE users SET password = ?, reset_token = NULL WHERE email = ?",
          [newPassword, email],
          (updateErr) => {
            if (updateErr) {
              console.error("Database error:", updateErr);
              return res
                .status(500)
                .json({ message: "Error updating password." });
            }

            res.status(200).json({ message: "Password updated successfully." });
          }
        );
      }
    );
  } catch (error) {
    console.error("Token verification error:", error);
    res.status(400).json({ message: "Invalid or expired token." });
  }
});

module.exports = router;
