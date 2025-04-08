const jwt = require("jsonwebtoken");
const JWT_SECRET = require("../config/jwt");

const verifyToken = (req, res, next) => {
  const token = req.header("Authorization")?.replace("Bearer ", "");

  if (!token) {
    return res
      .status(403)
      .json({ message: "Access denied. No token provided." });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    console.error("Invalid token:", err);
    return res.status(401).json({ message: "Invalid or expired token." });
  }
};

module.exports = verifyToken;
