const mongoose = require("mongoose");

const feedbackSchema = new mongoose.Schema({
   message: {
      type: String,
      required: true,
      maxlength: 500,
   },
   submittedAt: {
      type: Date,
      default: Date.now,
   },
});

module.exports = mongoose.model("Feedback", feedbackSchema);
