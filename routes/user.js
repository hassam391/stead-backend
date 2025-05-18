//---------- CODE BELOW HANDLES IMPORTS ----------
//imports express and the firebase auth middleware
const express = require("express");
const firebaseAuth = require("../middleware/firebaseAuth");
const User = require("../models/user");
const Log = require("../models/log");
const Metric = require("../models/metrics");

//creates a new router instance to define node routes separately
const router = express.Router();

//---------- CODE BELOW HANDLES PROTECTED ROUTE CHECK ----------
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

      //catches and handles any logging errors
   } catch {
      res.status(500).json({ message: "server error" });
   }
});

//---------- CODE BELOW HANDLES DASHBOARD USER INFO ----------
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

      //catches and handles any logging errors
   } catch (err) {
      console.error("GET /info error:", err);
      res.status(500).json({ message: "server error" });
   }
});

//---------- CODE BELOW HANDLES SAVING USER JOURNEY ----------
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

      //resets all journey-related fields to avoid nulls
      user.journey = journey;
      user.frequency = null;
      user.goal = null;
      user.activity = null;
      user.calorieGoal = null;

      //new journey code to match new logic for exercise and other - plus some validation
      if (journey === "calorie tracking") {
         if (!goal || typeof calorieGoal !== "number") {
            return res.status(400).json({ message: "Goal and calorieGoal are required for calorie tracking." });
         }
         user.goal = goal;
         user.calorieGoal = calorieGoal;
         user.frequency = 7;
      } else if (journey === "exercise") {
         if (typeof frequency !== "number") {
            return res.status(400).json({ message: "Frequency is required for exercise journey." });
         }
         user.frequency = frequency;
      } else if (journey === "other") {
         if (!activity || typeof frequency !== "number") {
            return res.status(400).json({ message: "Activity name and frequency are required for 'other' journey." });
         }
         user.activity = activity;
         user.frequency = frequency;
      } else {
         return res.status(400).json({ message: "Invalid journey type." });
      }

      //saves updated user data
      await user.save();

      //testing and validation
      console.log("received from frontend:", req.body);
      res.json({ message: "journey saved successfully" });

      //catches and handles any logging errors
   } catch (err) {
      console.error("error saving journey:", err);
      res.status(500).json({ message: "failed to save journey" });
   }
});

//---------- CODE BELOW HANDLES USERNAME REGISTRATION ----------
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

      //checks if user already exists
      const existingUser = await User.findOne({ email });

      if (existingUser) {
         return res.status(400).json({ message: "Account already exists. Please log in instead." });
      }

      //creates new user
      const newUser = new User({ email, username });
      await newUser.save();

      //creates associated metrics
      await Metric.create({
         userId: newUser._id,
         username: newUser.username,
         streak: 0,
         lastLoggedDate: null,
         missedDays: [],
      });

      res.status(201).json({ message: "User registered and metrics created successfully." });

      //catches and handles any logging errors
   } catch (err) {
      console.error("Register error:", err);
      res.status(500).json({ message: "Server error during registration." });
   }
});

//exports the router so it can be used in the main app
module.exports = router;
