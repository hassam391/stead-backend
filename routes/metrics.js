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

         //---------- CODE BELOW HANDLES EOW PENALTY AND NEW USER CHECK ----------
         const todayCheck = new Date();
         const dayOfWeek = todayCheck.getUTCDay();

         if (dayOfWeek === 1) {
            //if today is monday
            const startOfLastWeek = new Date(todayCheck);

            //go back to last Monday
            startOfLastWeek.setUTCDate(todayCheck.getUTCDate() - todayCheck.getUTCDay() - 6);
            startOfLastWeek.setUTCHours(0, 0, 0, 0);

            const endOfLastWeek = new Date(startOfLastWeek);
            endOfLastWeek.setUTCDate(startOfLastWeek.getUTCDate() + 6);

            if (user.journey === "exercise" || user.journey === "other") {
               const lastWeekLogs = await Log.find({
                  userId: user._id.toString(),
                  journeyType: user.journey,
                  isCheckIn: false,
                  date: {
                     $gte: startOfLastWeek.toISOString().split("T")[0],
                     $lte: endOfLastWeek.toISOString().split("T")[0],
                  },
               });

               const metLastWeekTarget = lastWeekLogs.length >= user.frequency;

               if (!metLastWeekTarget && user.joinedDate < startOfLastWeek) {
                  //only penalise if user joined before last week
                  metrics.streak = Math.max(0, metrics.streak - 2);
                  await metrics.save();
                  console.log(`Penalty applied: ${user.username} missed last week's frequency goal.`);
               }
            }
         }

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

      // ---------- CHECKS WEEKLY LOG PROGRESS ----------
      if (user.journey === "exercise" || user.journey === "other") {
         const startOfWeek = new Date();
         startOfWeek.setUTCHours(0, 0, 0, 0);
         startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay()); // set to Sunday

         const logsThisWeek = await Log.find({
            userId: user._id.toString(),
            journeyType: user.journey,
            isCheckIn: false,
            date: { $gte: startOfWeek.toISOString().split("T")[0] },
         });

         const logCount = logsThisWeek.length;
         metrics.hasMetWeeklyLogTarget = logCount >= user.frequency;
      }

      // ---------- CHECK IF USER HAS LOGGED OR CHECKED IN TODAY ----------
      const todayDate = new Date().toISOString().split("T")[0];
      const todayLog = await Log.findOne({ userId: user._id.toString(), date: todayDate });

      let loggedToday = false;
      let checkedInToday = false;

      if (todayLog) {
         if (todayLog.isCheckIn) {
            checkedInToday = true;
         } else {
            loggedToday = true;
         }
      }

      res.json({
         ...metrics.toObject(),
         hasMetWeeklyLogTarget: metrics.hasMetWeeklyLogTarget || false,
         loggedToday,
         checkedInToday,
      });
   } catch (err) {
      console.error("Error fetching metrics:", err);
      res.status(500).json({ message: "Server error" });
   }
});

// ---------- CODE BELOW HANDLES ACTIVITY LOGGING + STREAK CALCULATION ----------
//logs activity and update streak
router.post("/log-activity", firebaseAuth, async (req, res) => {
   const { valueLogged, details, isCheckIn } = req.body.data;

   //esnure value logged is a number
   let numericLoggedValue = 0;
   if (!isCheckIn) {
      numericLoggedValue = parseInt(valueLogged);
      if (isNaN(numericLoggedValue)) {
         return res.status(400).json({ message: "Invalid value logged" });
      }
   }
   const email = req.user.email;
   const today = new Date().toISOString().split("T")[0];

   let metric;

   try {
      //---------- FETCH USER + INITIALISE METRIC ----------
      const user = await User.findOne({ email });
      if (!user) return res.status(404).json({ message: "User not found" });

      metric = await Metric.findOne({ userId: user._id });

      //updated to include username
      if (!metric) {
         metric = new Metric({
            userId: user._id,
            username: user.username,
            streak: 0,
            lastLoggedDate: null,
            missedDays: [],
            rewardsUnlocked: [],
            titlesUnlocked: [],
            newRewardAlert: false,
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
         //for exercise/activity, always increase streak if logging or checking in occurs!
         metric.streak += 1;
         streakUpdated = true;
         console.log(isCheckIn ? "Check-in registered" : "Log registered");
      }

      //---------- SAVE METRIC + CREATE LOG ENTRY ----------
      metric.lastLoggedDate = today;
      await metric.save();

      const newLog = new Log({
         userId: user._id.toString(),
         username: user.username,
         journeyType: user.journey,
         date: today,
         isCheckIn: isCheckIn || false,
         data: { valueLogged: numericLoggedValue, details },
      });
      await newLog.save();

      //---------- CODE BELOW HANDLES REWARD UNLOCKING ----------

      //checks if user reached a special streak to unlock rewards or titles
      // Updated reward unlocking logic
      if (streakUpdated) {
         //awards titles for first 7 days
         const titleMap = {
            1: "Day 1: Beginner",
            2: "Day 2: Fresh Starter",
            3: "Day 3: Gaining Momentum",
            4: "Day 4: Turning Point",
            5: "Day 5: Getting there",
            6: "Day 6: Hang of it",
            7: "Day 7: Consistency King",
         };

         if (metric.streak <= 7) {
            const title = titleMap[metric.streak];
            if (!metric.titlesUnlocked.includes(title)) {
               metric.titlesUnlocked.push(title);
               metric.newRewardAlert = true;
            }
         }

         if (metric.streak % 7 === 0) {
            const reward = `day${Math.min(7, metric.streak)}`;
            if (!metric.rewardsUnlocked.includes(reward)) {
               metric.rewardsUnlocked.push(reward);
               metric.newRewardAlert = true;
            }
         }

         if (metric.newRewardAlert) {
            await metric.save();
         }
      }

      res.json({
         message: isCheckIn ? "Check-in saved" : "Log saved",
         streak: metric.streak,
      });

      //---------- FINAL OUTCOME ----------
   } catch (err) {
      console.error("Log saving failed:", err);
      //line to catch error for debugging
      console.error(err.stack);
      res.status(500).json({ message: "Failed to save log" });
   }
});

module.exports = router;
