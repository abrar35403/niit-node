// Require dotenv to load environment variables
require("dotenv").config();

// Fetch the JWT_SECRET from environment variables
const JWT_SECRET = process.env.JWT_SECRET;

// Export it
module.exports = JWT_SECRET;
