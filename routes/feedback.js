//---------- CODE BELOW HANDLES IMPORTS ----------
const express = require("express");
const router = express.Router();
const Feedback = require("../models/feedback");

//---------- CODE BELOW HANDLES POSTING FEEDBACK ----------
router.post("/", async (req, res) => {
   try {
      //gets feedback message from request body
      const { message } = req.body;

      //validation
      if (!message || message.trim() === "") {
         return res.status(400).json({ message: "Feedback cannot be empty." });
      }

      //creates and saved feedback
      const feedback = new Feedback({ message: message.trim() });
      await feedback.save();

      //catches and retuens any errors
      res.status(200).json({ message: "Feedback submitted successfully." });
   } catch (err) {
      console.error("Feedback submission error:", err);
      res.status(500).json({ message: "Server error." });
   }
});

//exports the router to be used in app.js
module.exports = router;
