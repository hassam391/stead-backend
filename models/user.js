//gets mongoose for creating user schema
const mongoose = require("mongoose");

//defines user document in the database and its different attributes to send to mongodb
const UserSchema = new mongoose.Schema({
   username: { type: String, required: true, unique: true },
   email: { type: String, required: true, unique: true },
   journey: { type: String, default: null },
   frequency: { type: Number, default: 0 },
   goal: { type: String, default: null },
   activity: { type: String, default: null },
   calorieGoal: { type: Number, default: null },
   currentStreak: { type: Number, default: 0 }, //track the current streak
   missedDays: { type: [Date], default: [] }, //array to store missed days
   lastLoggedDate: { type: Date, default: Date.now }, //last day activity logged
});

module.exports = mongoose.model("User", UserSchema);
