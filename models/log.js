//gets mongoose to define the log schema
const mongoose = require("mongoose");

//defines the log schema
const LogSchema = new mongoose.Schema({
   userId: { type: String, required: true },
   username: { type: String, required: true },
   journeyType: { type: String, required: true },
   date: { type: String, required: true },
   data: { type: mongoose.Schema.Types.Mixed },
   isCheckIn: { type: Boolean, default: false },
});

//exports the model
module.exports = mongoose.model("Log", LogSchema);
