//gets mongoose to define the feedback schema
const mongoose = require("mongoose");

//defines the feedback schema
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
//exports the model
module.exports = mongoose.model("Feedback", feedbackSchema);
