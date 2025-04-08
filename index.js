const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
// Load environment variables
require("dotenv").config();

const app = express();

// Import routes
const authRoutes = require("./routes/authRoutes");
const studentRoutes = require("./routes/studentRoutes");
const announcementRoutes = require("./routes/announcementRoutes");
const feeRoutes = require("./routes/feeRoutes");
const facultyStudentRoutes = require("./routes/facultyStudentRoutes");
const careerRouts = require("./routes/careerRoutes");
const documentRoutes = require("./routes/documents");
const settingsRoutes = require("./routes/settingsRoutes");

// Middleware
app.use(express.json());
app.use(cors());
app.use(cookieParser());
app.use(express.static("uploads"));

// Use routes
app.use("/auth", authRoutes);
app.use("/students", studentRoutes);
app.use("/announcements", announcementRoutes);
app.use("/fees", feeRoutes);
app.use("/faculty-students", facultyStudentRoutes);
app.use("/careers", careerRouts);
app.use("/documents", documentRoutes);
app.use("/settings", settingsRoutes);

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
