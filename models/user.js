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
   joinedDate: { type: Date, default: Date.now },
});

//exports the model
module.exports = mongoose.model("User", UserSchema);
