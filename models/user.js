//gets mongoose for creating user schema
const mongoose = require("mongoose");

//defines user document in the database and its different attributes
const UserSchema = new mongoose.Schema({
   email: { type: String, required: true, unique: true },
   journey: { type: String, default: null },
   frequency: { type: Number, default: 0 },
   goal: { type: String, default: null },
   activity: { type: String, default: null },
});

module.exports = mongoose.model("User", UserSchema);
