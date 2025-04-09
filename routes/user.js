//imports express and the firebase auth middleware
const express = require("express");
const firebaseAuth = require("../middleware/firebaseAuth");
const User = require("../models/user");

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
      //finds the user by email in the database
      const user = await User.findOne({ email: req.user.email });

      if (!user) {
         return res.status(404).json({ message: "user not found" });
      }

      //sends back the user's journey and frequency
      res.json({ journey: user.journey, frequency: user.frequency });
   } catch (err) {
      res.status(500).json({ message: "server error" });
   }
});

//saves user journey and frequency to database
router.post("/journey", firebaseAuth, async (req, res) => {
   const { journey, frequency, goal, activity, calorieGoal } = req.body;
   const email = req.user.email;

   try {
      //finds user by email, creates new one if doesn't exist
      let user = await User.findOne({ email });
      if (!user) {
         user = new User({ email });
      }

      //sets new journey and frequency
      user.journey = journey;
      user.frequency = frequency;

      //optional fields if they're needed
      if (goal) user.goal = goal;
      if (activity) user.activity = activity;
      if (calorieGoal) user.calorieGoal = calorieGoal;

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

//exports the router so it can be used in the main app
module.exports = router;
