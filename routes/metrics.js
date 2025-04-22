const express = require("express");
const firebaseAuth = require("../middleware/firebaseAuth");
const User = require("../models/user");
const Metric = require("../models/metrics");
const router = express.Router();
const Log = require("../models/log");
const Metric = require("../models/metrics");

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

      //check for existing metric, make one if it does not exist
      let metric = await Metric.findOne({ userId: user._id });
      if (!metric) {
         metric = new Metric({ userId: user._id });
      }

      //check if user has already logged for the day
      const existingLog = await Log.findOne({ userId: user._id.toString(), date: today });

      if (existingLog) {
         router.post("/log-activity", firebaseAuth, async (req, res) => {
            const { caloriesLogged } = req.body.data;
            const email = req.user.email;
            const today = new Date().toISOString().split("T")[0];

            try {
               const user = await User.findOne({ email });
               if (!user) return res.status(404).json({ message: "User not found" });

               let metrics = await Metric.findOne({ userId: user._id });
               if (!metrics) {
                  metrics = new Metric({ userId: user._id });
               }

               const existingLog = await Log.findOne({ userId: user._id.toString(), date: today });
               if (existingLog) return res.status(400).json({ message: "Already logged today" });

               let streakUpdated = false;

               if (user.goal === "lose" && caloriesLogged <= user.calorieGoal + 100) {
                  metrics.streak += 1;
                  streakUpdated = true;
               } else if (user.goal === "gain" && caloriesLogged >= user.calorieGoal - 200) {
                  metrics.streak += 1;
                  streakUpdated = true;
               } else if (
                  user.goal === "maintain" &&
                  caloriesLogged >= user.calorieGoal - 200 &&
                  caloriesLogged <= user.calorieGoal + 200
               ) {
                  metrics.streak += 1;
                  streakUpdated = true;
               }

               if (!streakUpdated) {
                  if (!metrics.missedDays.includes(today)) {
                     metrics.missedDays.push(today);
                     if (metrics.missedDays.length === 2) {
                        metrics.streak = 0;
                     } else {
                        metrics.streak -= 1;
                     }
                  }
               }

               metrics.lastLoggedDate = today;
               await metrics.save();

               const newLog = new Log({
                  userId: user._id.toString(),
                  username: user.username,
                  journeyType: "calorie tracking",
                  date: today,
                  data: req.body.data,
               });

               await newLog.save();

               res.json({ message: "Log saved successfully", streak: metrics.streak });
            } catch (err) {
               console.error("Log saving failed:", err);
               res.status(500).json({ message: "Failed to save log" });
            }
         });

         return res.status(400).json({ message: "Already logged today" });
      }

      //streaks logic (only for calories for now)
      let streakUpdated = false;

      //if user eats less than or just 100 above caloriegoal, increase streak
      if (user.goal === "lose" && caloriesLogged <= user.calorieGoal + 100) {
         metric.streak += 1;
         streakUpdated = true;

         //if user eats more than the calorie gaol or just 200 below it, increase streak
      } else if (user.goal === "gain" && caloriesLogged >= user.calorieGoal - 200) {
         metric.streak += 1;
         streakUpdated = true;

         //if user eats the calorie goal or just 200 above and below, increase streak
      } else if (
         user.goal === "maintain" &&
         caloriesLogged >= user.calorieGoal - 200 &&
         caloriesLogged <= user.calorieGoal + 200
      ) {
         metric.streak += 1;
         streakUpdated = true;
      }

      //penalty logic
      //if streak was not updated, check value of missed day
      if (!streakUpdated) {
         const missedAlready = metric.missedDays.find((d) => d === today);
         if (!missedAlready) {
            metric.missedDays.push(today);
            if (metric.missedDays.length === 2) {
               metric.streak = 0;
            } else {
               metric.streak -= 1;
            }
         }
      }

      //update last logged date and save user data
      metric.lastLoggedDate = today;
      await user.save();

      //creates new log entry
      const newLog = new Log({
         userId: user._id.toString(),
         username: user.username,
         journeyType: "calorie tracking",
         date: today,
         data: { caloriesLogged, details },
      });
      await newLog.save();

      res.json({ message: "Log saved successfully", streak: user.currentStreak });
   } catch (err) {
      console.error("Log saving failed:", err);
      res.status(500).json({ message: "Failed to save log" });
   }
});

module.exports = router;
