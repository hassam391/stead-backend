//imports express and the firebase auth middleware
const express = require("express");
const firebaseAuth = require("../middleware/firebaseAuth");

//creates a new router instance to define node routes separately
const router = express.Router();

//defines a protected route that needs a valid firebase token
router.get("/protected", firebaseAuth, (req, res) => {
   //sends back a response showing the user is authenticated
   res.json({ message: `Hello ${req.user.email}, you are authenticated!` });
});

//exports the router so it can be used in the main app
module.exports = router;
