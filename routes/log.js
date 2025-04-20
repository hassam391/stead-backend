const express = require("express");
const Log = require("../models/log");
const authMiddleware = require("../middleware/firebaseAuth");

const router = express.Router();

router.post("/", authMiddleware, async (req, res) => {
   const { journeyType, data } = req.body;
   const userId = req.user.uid;

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

export default router;
