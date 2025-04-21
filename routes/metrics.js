const express = require("express");
const firebaseAuth = require("../middleware/firebaseAuth");
const User = require("../models/user");
const Metric = require("../models/metrics"); // Import the Metrics model
const router = express.Router();

//gets current streak
router.get("/metrics", firebaseAuth, async (req, res) => {
   const email = req.user.email;
   try {
      const user = await User.findOne({ email });
      if (!user) {
         return res.status(404).json({ message: "User not found" });
      }

      const metrics = await Metric.findOne({ userId: user._id });
      if (!metrics) {
         return res.status(404).json({ message: "Metrics not found" });
      }

      res.json(metrics);
   } catch (err) {
      console.error("Error fetching metrics:", err);
      res.status(500).json({ message: "Server error" });
   }
});

//streaks logic
router.post("/log-activity", firebaseAuth, async (req, res) => {
   //gets calories logged from frontend
   const { caloriesLogged } = req.body.data;
   const email = req.user.email;

   //formats the date
   const today = new Date().toISOString().split("T")[0];

   try {
      //looks for user before anything
      const user = await User.findOne({ email });

      //404 error if user not found
      if (!user) {
         return res.status(404).json({ message: "User not found" });
      }

      //check if user has already logged for the day
      const existingLog = await Log.findOne({ email, date: today });

      if (existingLog) {
         return res.status(400).json({ message: "Already logged today" });
      }

      //streaks logic (only for calories for now)
      let streakUpdated = false;

      //if user eats less than or just 100 above caloriegoal, increase streak
      if (user.goal === "lose" && caloriesLogged <= user.calorieGoal + 100) {
         user.currentStreak += 1;
         streakUpdated = true;

         //if user eats more than the calorie gaol or just 200 below it, increase streak
      } else if (user.goal === "gain" && caloriesLogged >= user.calorieGoal - 200) {
         user.currentStreak += 1;
         streakUpdated = true;

         //if user eats the calorie goal or just 200 above and below, increase streak
      } else if (
         user.goal === "maintain" &&
         caloriesLogged >= user.calorieGoal - 200 &&
         caloriesLogged <= user.calorieGoal + 200
      ) {
         user.currentStreak += 1;
         streakUpdated = true;
      }

      //penalty logic
      //if streak was not updated, check value of missed day
      if (!streakUpdated) {
         //checks if today is already recorded as missed
         if (!user.missedDays.includes(today)) {
            //counts as missed, if not already missed, if missed
            user.missedDays.push(today);

            if (user.missedDays.length === 2) {
               //resets streak after 2 missed days
               user.currentStreak = 0;
            } else {
               //reduces streak by 1 after 1 missed day
               user.currentStreak -= 1;
            }
         }
      }

      //update last logged date and save user data
      user.lastLoggedDate = today;
      await user.save();

      //creates new log entry
      const newLog = new Log({ journey: "calorie tracking", date: today, details: req.body.data.details });
      await newLog.save();

      res.json({ message: "Log saved successfully", streak: user.currentStreak });
   } catch (err) {
      console.error("Log saving failed:", err);
      res.status(500).json({ message: "Failed to save log" });
   }
});

module.exports = router;
