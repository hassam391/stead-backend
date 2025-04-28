const mongoose = require("mongoose");

// Define the Metrics schema
const MetricsSchema = new mongoose.Schema({
   userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, //links to the user model
   username: { type: String, required: true },
   streak: { type: Number, default: 0 }, //current streak
   lastLoggedDate: { type: Date, default: Date.now }, //last logged date
   missedDays: { type: [Date], default: [] }, //list of missed days
   hasMetWeeklyLogTarget: false,
});

// Export the model
module.exports = mongoose.model("Metric", MetricsSchema);
