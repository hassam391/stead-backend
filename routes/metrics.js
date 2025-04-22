const express = require("express");
const router = express.Router();
const firebaseAuth = require("../middleware/firebaseAuth");
const User = require("../models/user");
const Metric = require("../models/metrics");
const Log = require("../models/log");

//get current streak + metrics
router.get("/metrics", firebaseAuth, async (req, res) => {
   const email = req.user.email;

   try {
      const user = await User.findOne({ email });
      if (!user) return res.status(404).json({ message: "User not found" });

      const metrics = await Metric.findOne({ userId: user._id });
      if (!metrics) return res.status(404).json({ message: "Metrics not found" });

      res.json(metrics); //streak, missedDays, etc.
   } catch (err) {
      console.error("Error fetching metrics:", err);
      res.status(500).json({ message: "Server error" });
   }
});

//logs activity and update streak
router.post("/log-activity", firebaseAuth, async (req, res) => {
   const { valueLogged, details } = req.body.data;

   //esnure value logged is a number
   const numericLoggedValue = parseInt(valueLogged);
   const email = req.user.email;
   const today = new Date().toISOString().split("T")[0];

   try {
      const user = await User.findOne({ email });
      if (!user) return res.status(404).json({ message: "User not found" });

      let metric = await Metric.findOne({ userId: user._id });
      if (!metric) {
         metric = new Metric({ userId: user._id });
      }

      const existingLog = await Log.findOne({ userId: user._id.toString(), date: today });
      if (existingLog) {
         return res.status(400).json({ message: "Already logged today" });
      }

      let streakUpdated = false;

      //simple debugging code
      console.log("Goal:", user.goal);
      console.log("Target:", user.calorieGoal);
      console.log("Logged:", numericLoggedValue);
      console.log("Streak before:", metric.streak);

      if (user.goal === "lose" && numericLoggedValue <= user.calorieGoal + 100) {
         metric.streak += 1;
         streakUpdated = true;
      } else if (user.goal === "gain" && numericLoggedValue >= user.calorieGoal - 200) {
         metric.streak += 1;
         streakUpdated = true;
      } else if (
         user.goal === "maintain" &&
         numericLoggedValue >= user.calorieGoal - 200 &&
         numericLoggedValue <= user.calorieGoal + 200
      ) {
         metric.streak += 1;
         streakUpdated = true;
      }

      //debug code
      console.log("Streak after:", metric.streak);

      if (!streakUpdated) {
         const missedAlready = metric.missedDays.find((d) => new Date(d).toISOString().split("T")[0] === today);
         if (!missedAlready) {
            metric.missedDays.push(today);
            if (metric.missedDays.length === 2) {
               metric.streak = 0;
            } else {
               //prevents streak from going below 0
               metric.streak = Math.max(0, metric.streak - 1);
            }
         }
      }

      metric.lastLoggedDate = today;
      await metric.save();

      const newLog = new Log({
         userId: user._id.toString(),
         username: user.username,
         journeyType: "calorie tracking",
         date: today,
         data: { valueLogged: numericLoggedValue, details },
      });
      await newLog.save();

      res.json({ message: "Log saved successfully", streak: metric.streak });
   } catch (err) {
      console.error("Log saving failed:", err);
      //line to catch error for debugging
      console.error(err.stack);
      res.status(500).json({ message: "Failed to save log" });
   }
});

module.exports = router;
