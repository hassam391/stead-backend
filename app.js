//imports express for server setup, mongoose for database connection, and cors for requests from other places
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");

//loads environment variables from .env file
require("dotenv").config();

//imports the user routes which include endpoints
const userRoutes = require("./routes/user");

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
app.use("/api/user", userRoutes);

const logRoutes = require("./routes/log");

//registers all log-related routes
app.use("/api/log", logRoutes);

const logMetrics = require("./routes/metrics");

//registers all log-related routes
app.use("/api/metrics", logMetrics);

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
