const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const db = require("../config/db");
const JWT_SECRET = require("../config/jwt");

const router = express.Router();

// Store verification codes temporarily (in production, use Redis or a database)
const verificationCodes = {};

// Configure nodemailer
const transporter = nodemailer.createTransport({
  service: "gmail", // Replace with your email service
  auth: {
    user: process.env.EMAIL_USER, // Your email
    pass: process.env.EMAIL_PASSWORD, // Your email password or app password
  },
});

// Send verification code
router.post("/send-verification", async (req, res) => {
  const { email } = req.body;

  try {
    // Check if email already exists
    db.query(
      "SELECT * FROM login WHERE email = ?",
      [email],
      async (err, results) => {
        if (err) return res.status(500).json({ message: "Database error" });

        if (results.length > 0) {
          return res.status(400).json({ message: "Email already exists." });
        }

        // Generate a random 6-digit verification code
        const verificationCode = Math.floor(
          100000 + Math.random() * 900000
        ).toString();

        // Store the code with expiration (15 minutes)
        verificationCodes[email] = {
          code: verificationCode,
          expiresAt: Date.now() + 15 * 60 * 1000, // 15 minutes
        };

        // Send verification email
        const mailOptions = {
          from: process.env.EMAIL_USER,
          to: email,
          subject: "Email Verification",
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
              <h2 style="color: #333;">Verify Your Email</h2>
              <p>Thank you for signing up! Please use the following code to verify your email address:</p>
              <div style="background-color: #f5f5f5; padding: 10px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; margin: 20px 0;">
                ${verificationCode}
              </div>
              <p>This code will expire in 15 minutes.</p>
              <p>If you didn't request this verification, please ignore this email.</p>
            </div>
          `,
        };

        transporter.sendMail(mailOptions, (error, info) => {
          if (error) {
            console.error("Email sending error:", error);
            return res
              .status(500)
              .json({ message: "Failed to send verification email" });
          }
          res
            .status(200)
            .json({ message: "Verification code sent successfully" });
        });
      }
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Verify code and complete signup
router.post("/verify-and-signup", async (req, res) => {
  const { firstName, lastName, email, password, verificationCode } = req.body;

  try {
    // Check if verification code exists and is valid
    const storedVerification = verificationCodes[email];

    if (!storedVerification) {
      return res.status(400).json({
        message: "Verification code not found. Please request a new one.",
      });
    }

    if (Date.now() > storedVerification.expiresAt) {
      // Remove expired code
      delete verificationCodes[email];
      return res.status(400).json({
        message: "Verification code has expired. Please request a new one.",
      });
    }

    if (storedVerification.code !== verificationCode) {
      return res.status(400).json({ message: "Invalid verification code." });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert user into database
    db.query(
      "INSERT INTO login (f_name, s_name, email, password, is_verified) VALUES (?, ?, ?, ?, ?)",
      [firstName, lastName, email, hashedPassword, 1],
      (err, result) => {
        if (err) {
          console.error("Database error:", err);
          return res
            .status(500)
            .json({ message: "Error inserting user data." });
        }

        // Remove verification code after successful signup
        delete verificationCodes[email];

        res.status(200).json({ message: "User registered successfully!" });
      }
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Login Route
router.post("/login", (req, res) => {
  const { email, password } = req.body;

  db.query(
    "SELECT * FROM login WHERE email = ?",
    [email],
    async (err, results) => {
      if (err) return res.status(500).json({ message: "Database error" });

      if (results.length === 0) {
        return res.status(401).json({ message: "Invalid email or password." });
      }

      const user = results[0];

      // Check if user is verified
      if (!user.is_verified) {
        return res.status(401).json({
          message:
            "Email not verified. Please verify your email before logging in.",
        });
      }

      const isPasswordValid = await bcrypt.compare(password, user.password);

      if (!isPasswordValid) {
        return res.status(401).json({ message: "Invalid email or password." });
      }

      const token = jwt.sign({ email: user.email, id: user.id }, JWT_SECRET, {
        expiresIn: "1d",
      });

      res
        .status(200)
        .json({ message: "Login successful!", email: user.email, token });
    }
  );
});

// Generate and send reset password token
router.post("/forgot-password", async (req, res) => {
  const { email } = req.body;

  try {
    // Check if user exists
    db.query(
      "SELECT * FROM login WHERE email = ?",
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
          "UPDATE login SET reset_token = ? WHERE email = ?",
          [resetToken, email],
          (updateErr) => {
            if (updateErr) {
              console.error("Database error:", updateErr);
              return res
                .status(500)
                .json({ message: "Error updating reset token." });
            }

            // Send reset password email
            const resetLink = `/reset-password/${resetToken}`;
            const mailOptions = {
              from: process.env.EMAIL_USER,
              to: email,
              subject: "Reset Your Password",
              html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
                <h2 style="color: #333;">Reset Your Password</h2>
                <p>You have requested to reset your password. Click the link below to set a new password:</p>
                <a href="${resetLink}" style="display: inline-block; padding: 10px 20px; background-color: #007bff; color: #ffffff; text-decoration: none; border-radius: 5px;">Reset Password</a>
                <p>This link will expire in 1 hour.</p>
                <p>If you didn't request this, please ignore this email.</p>
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

// Reset password
router.post("/reset-password", async (req, res) => {
  const { token, newPassword } = req.body;

  try {
    // Verify the token
    const decoded = jwt.verify(token, JWT_SECRET);

    // Check if the token exists in the database
    db.query(
      "SELECT * FROM login WHERE email = ? AND reset_token = ?",
      [decoded.email, token],
      async (err, results) => {
        if (err) return res.status(500).json({ message: "Database error" });

        if (results.length === 0) {
          return res
            .status(400)
            .json({ message: "Invalid or expired reset token." });
        }

        const user = results[0];

        // Hash the new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update the password and clear the reset token
        db.query(
          "UPDATE login SET password = ?, reset_token = NULL WHERE email = ?",
          [hashedPassword, user.email],
          (updateErr) => {
            if (updateErr) {
              console.error("Database error:", updateErr);
              return res
                .status(500)
                .json({ message: "Error updating password." });
            }

            res.status(200).json({ message: "Password reset successfully." });
          }
        );
      }
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    res.status(500).json({ message: "Invalid or expired token" });
  }
});

module.exports = router;
