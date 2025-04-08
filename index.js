const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
// Load environment variables
require("dotenv").config();

const app = express();

// Middleware
app.use(express.json());
app.use(cors());
app.use(cookieParser());
app.use(express.static("uploads"));



// Test API
app.get("/test", (req, res) => {
  res.status(200).json({
    message: "API is working!",
  });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
