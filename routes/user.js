const express = require("express");
const firebaseAuth = require("../middleware/firebaseAuth");

const router = express.Router();

router.get("/protected", firebaseAuth, (req, res) => {
   res.json({ message: `Hello ${req.user.email}, you are authenticated!` });
});

module.exports = router;
