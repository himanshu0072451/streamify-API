// Load environment variables from .env file
require("dotenv").config();

// Core modules
const express = require("express");
const cors = require("cors");

// Database connection
const connectDB = require("./config/db");

// Route handlers
const searchRoutes = require("./routes/search");
const mp3Routes = require("./routes/getMp3");
const trendingRoutes = require("./routes/trending");

// App initialization
const app = express();

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors()); // Enable CORS for cross-origin requests
app.use(express.json()); // Parse incoming JSON

// Routes
app.use("/api/search", searchRoutes);
app.use("/api/mp3", mp3Routes);
app.use("/api/trending", trendingRoutes);

// Health Check
app.get("/", (req, res) => {
  res.status(200).send("🎵 Music API is running...");
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server listening on port ${PORT}`);
});
