//---------- CODE BELOW HANDLES IMPORTS ----------
const express = require("express");
const Log = require("../models/log");
const User = require("../models/user");
const authMiddleware = require("../middleware/firebaseAuth");

const router = express.Router();

//---------- CODE BELOW HANDLES DAILY LOG CREATION ----------
router.post("/", authMiddleware, async (req, res) => {
   const { journeyType, data } = req.body;
   const email = req.user.email;

   const today = new Date().toISOString().split("T")[0];

   try {
      const user = await User.findOne({ email });
      //user validation
      if (!user) {
         return res.status(400).json({ message: "User not found" });
      }

      //to avoid double logging
      const existing = await Log.findOne({ userId: user._id.toString(), date: today });
      if (existing) {
         return res.status(400).json({ message: "You've already logged today!" });
      }

      const newLog = new Log({
         userId: user._id.toString(),
         username: user.username,
         journeyType,
         date: today,
         data,
      });

      await newLog.save();
      res.status(201).json({ message: "Log saved successfully!" });
   } catch (err) {
      console.error("Log error:", err);
      res.status(500).json({ message: "Server error." });
   }
});

//---------- CODE BELOW HANDLES LOGGING STATUS CHECK ----------
//checks whether user has logged for the day or not
router.get("/check", authMiddleware, async (req, res) => {
   const email = req.user.email;
   const today = new Date().toISOString().split("T")[0];

   try {
      const user = await User.findOne({ email });

      if (!user) {
         return res.status(404).json({ message: "User not found" });
      }

      const existingLog = await Log.findOne({ userId: user._id.toString(), date: today });
      res.json({ loggedToday: !!existingLog });
   } catch (err) {
      console.error("Log check error:", err);
      res.status(500).json({ message: "Server error" });
   }
});

module.exports = router;
