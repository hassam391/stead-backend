//---------- CODE BELOW HANDLES IMPORTS ----------
const express = require("express");
const router = express.Router();
const firebaseAuth = require("../middleware/firebaseAuth");
const User = require("../models/user");
const Metric = require("../models/metrics");
const Log = require("../models/log");

//---------- CODE BELOW HANDLES GETTING USER METRICS ----------
//get current streak + metrics
router.get("/metrics", firebaseAuth, async (req, res) => {
   const email = req.user.email;
   const today = new Date().toISOString().split("T")[0];

   try {
      const user = await User.findOne({ email });
      if (!user) return res.status(404).json({ message: "User not found" });

      //attempts to find existing metrics for user
      let metrics = await Metric.findOne({ userId: user._id });

      //creates metrics if they don't exist
      if (!metrics) {
         metrics = new Metric({
            userId: user._id,
            username: user.username,
            streak: 0,
            missedDays: [],
            lastLoggedDate: null,
         });

         //saves metrics
         await metrics.save();
      }

      //---------- CODE BELOW HANDLES PENALTY LOGIC ----------
      //converts last date logged to string
      //skipped if there is no lastdatelogged (new user)
      const lastDate = metrics.lastLoggedDate ? new Date(metrics.lastLoggedDate).toISOString().split("T")[0] : null;

      //ensures lastloggeddate is not today, meaning today has not been logged yet
      if (lastDate && lastDate !== today) {
         //calculates yesterday's date in yyyymmdd format - done in ms
         const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];

         //checks if user has already missed yesterday or not - duplicate prevention
         const missedAlready = metrics.missedDays.find((d) => new Date(d).toISOString().split("T")[0] === yesterday);

         //checks to see if user actually logged yesterday - only those who forogt to log enitely will be penalised
         const loggedYesterday = await Log.findOne({ userId: user._id.toString(), date: yesterday });

         //if user did not log yesterday and its not already recorded, it gets recorded as missed
         if (!loggedYesterday && !missedAlready) {
            metrics.missedDays.push(yesterday);

            //checks if used has missed 2 days now, resets streak if so
            if (metrics.missedDays.length === 2) {
               metrics.streak = 0;

               //clears missed days
               metrics.missedDays = [];
            } else {
               //-1 from streaks for 1 missed day, doesnt go below 0
               metrics.streak = Math.max(0, metrics.streak - 1);
            }
         }
      }

      res.json(metrics); //streak, missedDays, etc.
   } catch (err) {
      console.error("Error fetching metrics:", err);
      res.status(500).json({ message: "Server error" });
   }
});

//---------- CODE BELOW HANDLES ACTIVITY LOGGING + STREAK CALCULATION ----------
//logs activity and update streak
router.post("/log-activity", firebaseAuth, async (req, res) => {
   const { valueLogged, details } = req.body.data;

   //esnure value logged is a number
   numericLoggedValue = parseInt(valueLogged);
   const email = req.user.email;
   const today = new Date().toISOString().split("T")[0];

   try {
      //---------- FETCH USER + INITIALISE METRIC ----------
      const user = await User.findOne({ email });
      if (!user) return res.status(404).json({ message: "User not found" });

      let metric = await Metric.findOne({ userId: user._id });

      //updated to include username
      if (!metric) {
         metric = new Metric({
            userId: user._id,
            username: user.username,
            streak: 0,
            lastLoggedDate: null,
            missedDays: [],
         });
      }

      //---------- DUPLICATE LOG PREVENTION ----------
      const existingLog = await Log.findOne({ userId: user._id.toString(), date: today });
      if (existingLog) {
         return res.status(400).json({ message: "Already logged today" });
      }

      //---------- STREAK UPDATE LOGIC ----------
      let streakUpdated = false;

      //---------- STREAK OUTCOME CALCULATION LOGIC ----------
      if (user.journey === "calorie tracking") {
         if (user.goal === "lose weight" && numericLoggedValue <= user.calorieGoal + 100) {
            metric.streak += 1;
            streakUpdated = true;
         } else if (user.goal === "gain weight" && numericLoggedValue >= user.calorieGoal - 200) {
            metric.streak += 1;
            streakUpdated = true;
         } else if (
            user.goal === "maintain weight" &&
            numericLoggedValue >= user.calorieGoal - 200 &&
            numericLoggedValue <= user.calorieGoal + 200
         ) {
            metric.streak += 1;
            streakUpdated = true;
         }
      } else if (user.journey === "exercise" || user.journey === "other") {
         //for exercise/activity, always increase streak if logging or checking in occurs
         if (!isCheckIn || (isCheckIn && shouldCheckInToday(user))) {
            metric.streak += 1;
            streakUpdated = true;
         }
      }

      //---------- SAVE METRIC + CREATE LOG ENTRY ----------
      metric.lastLoggedDate = today;
      await metric.save();

      const newLog = new Log({
         userId: user._id.toString(),
         username: user.username,
         journeyType: "calorie tracking",
         date: today,
         isCheckIn: isCheckIn || false,
         data: { valueLogged: numericLoggedValue, details },
      });
      await newLog.save();

      //---------- FINAL OUTCOME ----------
      res.json({
         message: isCheckIn ? "Check-in saved" : "Log saved",
         streak: metric.streak,
      });
   } catch (err) {
      console.error("Log saving failed:", err);
      //line to catch error for debugging
      console.error(err.stack);
      res.status(500).json({ message: "Failed to save log" });
   }
});

module.exports = router;
