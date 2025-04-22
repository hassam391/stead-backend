//imports express for server setup, mongoose for database connection, and cors for requests from other places
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

//loads environment variables from .env file
require("dotenv").config();

//initializes the express app
const app = express();

//allows testing with local live server
app.use(
   cors({
      origin: [
         //local live server
         "http://127.0.0.1:5500",

         //deployed frontend
         "https://stead-app.netlify.app",
      ],
      methods: ["GET", "POST"],
      allowedHeaders: ["Content-Type", "Authorization"],
   })
);

//uses middleware to handle cross-origin requests and parse incoming json
app.use(express.json());

//registers all user-related routes
const userRoutes = require("./routes/user");
app.use("/api/user", userRoutes);

//registers all log-related routes
const logRoutes = require("./routes/log");
app.use("/api/log", logRoutes);

//registers all metric-related routes
const metricsRoutes = require("./routes/metrics");
app.use("/api", metricsRoutes);

//sets the port from env or defaults to 5000 if not already
const PORT = process.env.PORT || 5000;

//connects to the mongodb database using credentials from the environment
mongoose
   .connect(process.env.MONGO_URI)
   .then(() => {
      //starts the server only after successful database connection
      console.log("MongoDB connected");
      app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
   })
   .catch((err) => console.error(err));
