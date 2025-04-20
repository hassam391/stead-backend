//gets mongoose to define the log schema
const mongoose = require("mongoose");

//defines the log schema
const LogSchema = new mongoose.Schema({
   email: { type: String, required: true },
   journey: { type: String, required: true },
   date: { type: String, required: true },

   //tracking details such as number of calories, minutes exercised etc
   details: { type: mongoose.Schema.Types.Mixed },
});

//exports the model
module.exports = mongoose.model("Log", LogSchema);
