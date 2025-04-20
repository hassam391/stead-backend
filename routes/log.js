import express from "express";
import Log from "../models/log.js";
import authMiddleware from "../middleware/auth.js";

const router = express.Router();

router.post("/", authMiddleware, async (req, res) => {
   const { journeyType, data } = req.body;
   const userId = req.user.uid;
   const username = req.user.username;

   const today = new Date().toISOString().split("T")[0];

   try {
      //to avoid double logging
      const existing = await Log.findOne({ userId, date: today });
      if (existing) {
         return res.status(400).json({ message: "You've already logged today!" });
      }

      const newLog = new Log({
         userId,
         username,
         date: today,
         journeyType,
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
