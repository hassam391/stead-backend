//---------- CODE BELOW HANDLES IMPORTS ----------
const express = require("express");
const router = express.Router();
const firebaseAuth = require("../middleware/firebaseAuth");
const User = require("../models/user");
const Metric = require("../models/metrics");
const Log = require("../models/log");

//---------- CODE BELOW HANDLES GETTING USER METRICS ----------
//gets streak, log status, and penalty-related metrics
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
      }

      //---------- CODE BELOW HANDLES PENALTY LOGIC ----------
      //converts last date logged to string
      //only applies penalty if user did not log yesterday and hasnt already been penalised
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

            //-1 from streak for missing yesterday, doesn't go below 0
            metrics.streak = Math.max(0, metrics.streak - 1);
         }
      }

      // ---------- CHECKS WEEKLY LOG PROGRESS ----------
      //checks if user has met this weeks log frequency
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
      //checks whether user has logged or checked in today
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

      //sends combined metrics and logging status back to frontend
      res.json({
         ...metrics.toObject(),
         hasMetWeeklyLogTarget: metrics.hasMetWeeklyLogTarget || false,
         loggedToday,
         checkedInToday,
      });

      //catches and logs any server error
   } catch (err) {
      console.error("Error fetching metrics:", err);
      res.status(500).json({ message: "Server error" });
   }
});

// ---------- CODE BELOW HANDLES ACTIVITY LOGGING + STREAK CALCULATION ----------
//logs activity and calculates streaks based on user journey

router.post("/log-activity", firebaseAuth, async (req, res) => {
   //gets log data from request body
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

   //formats date as yyyymmdd
   const today = new Date().toISOString().split("T")[0];

   //---------- FETCH USER + INITIALISE METRIC ----------
   //creates new metric document if user has none yet
   let metric;
   try {
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

         //saves metrics
         await metric.save();
      }

      //---------- DUPLICATE LOG PREVENTION ----------
      //prevents multiple logs on the same day

      const existingLog = await Log.findOne({ userId: user._id.toString(), date: today });
      if (existingLog) {
         return res.status(400).json({ message: "Already logged today" });
      }

      //tracks if streak was increased this session
      let streakUpdated = false;

      //---------- STREAK OUTCOME CALCULATION LOGIC ----------

      //applies calorie goal logic based on user’s goal type
      if (user.journey === "calorie tracking") {
         //allows margin of +100 for losing weight
         if (user.goal === "lose weight" && numericLoggedValue <= user.calorieGoal + 100) {
            metric.streak += 1;
            streakUpdated = true;
            //allows margin of -200 for gaining weight
         } else if (user.goal === "gain weight" && numericLoggedValue >= user.calorieGoal - 200) {
            metric.streak += 1;
            streakUpdated = true;
         } else if (
            //allows +-200 margin for maintaining weight
            user.goal === "maintain weight" &&
            numericLoggedValue >= user.calorieGoal - 200 &&
            numericLoggedValue <= user.calorieGoal + 200
         ) {
            metric.streak += 1;
            streakUpdated = true;
         }
      } else if (user.journey === "exercise" || user.journey === "other") {
         //for exercise/activity always increase streak if logging or checking in occurs
         metric.streak += 1;
         streakUpdated = true;
         console.log(isCheckIn ? "Check-in registered" : "Log registered");
      }

      //---------- SAVE METRIC + CREATE LOG ENTRY ----------
      //stores streak update and saves daily log data
      metric.lastLoggedDate = today;
      await metric.save();

      //builds new log object with today's data
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
      //updates reward unlocking logic

      if (streakUpdated) {
         //initialize arrays if they don't exist
         metric.titlesUnlocked = [...new Set(metric.titlesUnlocked)];
         metric.rewardsUnlocked = [...new Set(metric.rewardsUnlocked)];

         //title awards for first 7 days
         const titleNames = {
            1: "Day 1 Achiever",
            2: "Day 2 Reacher",
            3: "Day 3 Streaker",
            4: "Day 4 Believer",
            5: "Day 5 Climber",
            6: "Day 6 Fighter",
            7: "Day 7 Champion",
         };

         //only award titles during first 7 days of streak
         if (metric.streak <= 7) {
            const title = titleNames[metric.streak];
            if (!metric.titlesUnlocked.includes(title)) {
               metric.titlesUnlocked.push(title);
               //pings new reward alert to show on frontend
               metric.newRewardAlert = true;
            }
         }

         //rewards awards
         if (metric.streak <= 7) {
            const reward = `day${metric.streak}`;
            if (!metric.rewardsUnlocked.includes(reward)) {
               metric.rewardsUnlocked.push(reward);
               metric.newRewardAlert = true;
            }
         }
      }

      //sends success message and updated streak
      res.json({
         message: isCheckIn ? "Check-in saved" : "Log saved",
         streak: metric.streak,
         newRewardAlert: metric.newRewardAlert || false,
      });

      //---------- FINAL OUTCOME ----------
      //catches and handles any logging errors
   } catch (err) {
      console.error("Log saving failed:", err);
      //line to catch error for debugging
      res.status(500).json({ message: "Failed to save log" });
   }
});

//---------- CODE BELOW HANDLES REWARDS PING ----------
//clears reward alert ping if user sees it
router.post("/rewards-seen", firebaseAuth, async (req, res) => {
   try {
      const email = req.user.email;
      const user = await User.findOne({ email });

      if (!user) return res.status(404).json({ message: "User not found" });

      const metric = await Metric.findOne({ userId: user._id });
      if (!metric) return res.status(404).json({ message: "Metrics not found" });

      if (metric.newRewardAlert) {
         metric.newRewardAlert = false;
         await metric.save();
         console.log(`cleared reward alert for ${user.username}`);
      }

      //sends success response to confirm alert was cleared
      res.json({ success: true });

      //catches and handles any logging errors
   } catch (err) {
      console.error("Error clearing reward alert:", err);
      res.status(500).json({ message: "Server error" });
   }
});

//---------- CODE BELOW HANDLES PROFILE TITLE ----------
router.get("/title-display", firebaseAuth, async (req, res) => {
   try {
      const user = await User.findOne({ email: req.user.email });
      const metric = (await Metric.findOne({ userId: user._id })) || {};

      //defaults title
      let displayTitle = "Beginner";

      //gets all unlocked titles
      const unlockedTitles = metric.titlesUnlocked || [];

      //finds highest day title
      if (unlockedTitles.length > 0) {
         //creates array of title and dayNumber pairs
         const titleDays = unlockedTitles.map((title) => {
            //regex gets number after word 'day' is case sensitive
            const dayMatch = title.match(/Day\s*(\d+)/i);
            return {
               title,
               day: dayMatch ? parseInt(dayMatch[1]) : 0,
            };
         });

         //sorts by day number highest first
         titleDays.sort((a, b) => b.day - a.day);

         //usess the highest title
         displayTitle = titleDays[0].title;
      }

      //sends username current title and all unlocked titles
      res.json({
         username: user.username,
         latestTitle: displayTitle,
         titlesUnlocked: metric.titlesUnlocked || [],
      });
      //catches and handles any logging errors
   } catch (err) {
      console.error("User info fetch failed:", err);
      res.status(500).json({ message: "Server error" });
   }
});

//---------- CODE BELOW FETCHES LOGS FOR RECENT ACTIVITY ----------
//fetches 5 most recent logs sorted by date

router.get("/recent-logs", firebaseAuth, async (req, res) => {
   try {
      const user = await User.findOne({ email: req.user.email });
      const logs = await Log.find({ userId: user._id.toString() }).sort({ date: -1 }).limit(5);

      //sends logs to frontend
      res.json(logs);

      //catches and handles any logging errors
   } catch (err) {
      console.error("Failed to fetch recent logs:", err);
      res.status(500).json({ message: "Server error" });
   }
});

//---------- CODE BELOW HANDLES ALL LEADERBOARD LOGIC ----------
router.get("/leaderboard", async (req, res) => {
   try {
      //fetchs all users and metrics
      const users = await User.find({});
      const metrics = await Metric.find({});

      //maps userId to username for easy lookup
      const userMap = {};
      users.forEach((user) => {
         userMap[user._id.toString()] = user.username;
      });

      //builds leaderboard entries
      const leaderboard = metrics.map((metric) => {
         const titles = metric.titlesUnlocked || [];
         const rewards = metric.rewardsUnlocked || [];

         //gets highest title based on day number
         let latestTitle = "Beginner";

         //sorts unlocked titles by day number to find the highest one
         if (titles.length > 0) {
            const sortedTitles = titles
               .map((title) => {
                  //regex matches 'day' with optional spaces and number
                  const match = title.match(/Day\s*(\d+)/i);
                  return { title, day: match ? parseInt(match[1]) : 0 };
               })
               .sort((a, b) => b.day - a.day);
            latestTitle = sortedTitles[0].title;
         }

         //gets highest reward based on day number
         let highestReward = null;

         //finds the most recent unlocked reward
         if (rewards.length > 0) {
            const sortedRewards = rewards
               .map((reward) => {
                  //regex gets day with no spaces and is case sensitive
                  const match = reward.match(/day(\d+)/i);
                  return { reward, day: match ? parseInt(match[1]) : 0 };
               })
               .sort((a, b) => b.day - a.day);

            const lastRewardNum = sortedRewards[0].day;
            highestReward = lastRewardNum ? `day_${lastRewardNum}` : null;
         }

         return {
            username: userMap[metric.userId.toString()] || "Unknown",
            streak: metric.streak || 0,
            latestTitle,
            highestReward,
         };
      });

      //sorts by streak descending
      leaderboard.sort((a, b) => b.streak - a.streak);

      //sends formatted leaderboard data to frontend
      res.json(leaderboard);

      //catches and handles any logging errors
   } catch (err) {
      console.error("Failed to build leaderboard:", err);
      res.status(500).json({ message: "Server error" });
   }
});

module.exports = router;
