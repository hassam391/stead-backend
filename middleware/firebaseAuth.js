const admin = require("../config/firebase");

const firebaseAuth = async (req, res, next) => {
   const token = req.headers.authorization?.split(" ")[1];
   if (!token) return res.status(401).send({ message: "No token provided" });

   try {
      const decoded = await admin.auth().verifyIdToken(token);
      req.user = decoded;
      next();
   } catch {
      res.status(401).send({ message: "Invalid token" });
   }
};

module.exports = firebaseAuth;
