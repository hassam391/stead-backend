//imports express and the firebase auth middleware
const express = require("express");
const firebaseAuth = require("../middleware/firebaseAuth");
const User = require("../models/user");
const Log = require("../models/log");
const Metric = require("../models/metrics");

//creates a new router instance to define node routes separately
const router = express.Router();

//defines a protected route that needs a valid firebase token
router.get("/protected", firebaseAuth, async (req, res) => {
   try {
      //finds the user in database using email from the verified token
      const user = await User.findOne({ email: req.user.email });

      if (!user) {
         return res.status(404).json({ message: "user not found" });
      }
      //sends back a response showing the user is authenticated
      res.json({ message: `Hello ${req.user.email}, you are authenticated!` });
   } catch {
      res.status(500).json({ message: "server error" });
   }
});

//gets user journey info to decide page redirection
router.get("/info", firebaseAuth, async (req, res) => {
   try {
      //email verification for error handling
      const email = req.user.email;

      if (!email) {
         console.error("No email found in token:", req.user);
         return res.status(400).json({ message: "invalid token - email missing" });
      }

      const user = await User.findOne({ email });

      if (!user) {
         return res.status(404).json({ message: "user not found" });
      }

      //sends back all relevant info needed for the dashboard
      res.json({
         email: user.email,
         journey: user.journey || null,
         username: user.username,
         frequency: user.frequency,
         goal: user.goal,
         activity: user.activity,
         calorieGoal: user.calorieGoal,
         currentStreak: user.currentStreak, //to display on dashbaord
      });
   } catch (err) {
      console.error("GET /info error:", err);
      res.status(500).json({ message: "server error" });
   }
});

//saves user journey and frequency to database
router.post("/journey", firebaseAuth, async (req, res) => {
   const { journey, frequency, goal, activity, calorieGoal } = req.body;
   const email = req.user.email;

   //logs payload received by backend
   console.log("received journey data:", req.body);

   try {
      //finds user by email, creates new one if doesn't exist
      let user = await User.findOne({ email });
      if (!user) {
         user = new User({ email });
      }

      //sets new journey and frequency
      user.journey = journey;
      user.frequency = frequency;

      //resets all journey-related fields to avoid nulls
      user.journey = journey;
      user.frequency = frequency;
      user.goal = null;
      user.activity = null;
      user.calorieGoal = null;

      //assigns values only if they exist
      if (typeof goal !== "undefined") user.goal = goal;
      if (typeof activity !== "undefined") user.activity = activity;
      if (typeof calorieGoal !== "undefined" && !isNaN(calorieGoal)) {
         user.calorieGoal = calorieGoal;
      }

      //saves updated user data
      await user.save();

      //testing and validation
      console.log("received from frontend:", req.body);

      res.json({ message: "journey saved successfully" });
   } catch (err) {
      console.error("error saving journey:", err);
      res.status(500).json({ message: "failed to save journey" });
   }
});

//username registration
router.post("/register", firebaseAuth, async (req, res) => {
   const { email, username } = req.body;

   if (!username || !email) {
      return res.status(400).json({ message: "Missing required fields" });
   }

   try {
      //checks if username already exists
      const existingUsername = await User.findOne({ username });
      if (existingUsername) {
         return res.status(409).json({ message: "Username already taken" });
      }

      //create or updates user
      let user = await User.findOne({ email });
      if (!user) {
         user = new User({ email, username });
      } else {
         user.username = username;
      }

      await user.save();
      res.status(200).json({ message: "User registered successfully" });
   } catch (err) {
      console.error("register error:", err);
      res.status(500).json({ message: "server error" });
   }
});

//logs daily activity
router.post("/log", firebaseAuth, async (req, res) => {
   const { journey, details } = req.body;
   const email = req.user.email;

   //formats to YYYY-MM-DD
   const today = new Date().toISOString().split("T")[0];

   try {
      //checks if log already exists for today
      const existingLog = await Log.findOne({ email, date: today });
      if (existingLog) {
         return res.status(400).json({ message: "already logged today" });
      }

      //creates and saves new log
      const newLog = new Log({ email, journey, date: today, details });
      await newLog.save();

      res.json({ message: "log saved successfully" });
   } catch (err) {
      console.error("log saving failed:", err);
      res.status(500).json({ message: "failed to save log" });
   }
});

//creates user metrics upon sign up to avoid initial backend errors
router.post("/signup", async (req, res) => {
   try {
      // 1. Create user (existing code)
      const user = await User.create({ email: req.body.email });

      // 2. Initialize metrics document
      await Metric.create({
         userId: user._id,
         streak: 0,
         lastLoggedDate: null,
         missedDays: [],
      });

      res.status(201).json({ message: "User created" });
   } catch (err) {
      res.status(500).json({ message: "Signup failed" });
   }
});

//exports the router so it can be used in the main app
module.exports = router;
