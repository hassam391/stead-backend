const express = require("express");
const router = express.Router();
const Feedback = require("../models/feedback");

//---------- CODE BELOW HANDLES POSTING FEEDBACK ----------
router.post("/", async (req, res) => {
   try {
      const { message } = req.body;

      if (!message || message.trim() === "") {
         return res.status(400).json({ message: "Feedback cannot be empty." });
      }

      const feedback = new Feedback({ message: message.trim() });
      await feedback.save();

      res.status(200).json({ message: "Feedback submitted successfully." });
   } catch (err) {
      console.error("Feedback submission error:", err);
      res.status(500).json({ message: "Server error." });
   }
});

module.exports = router;
