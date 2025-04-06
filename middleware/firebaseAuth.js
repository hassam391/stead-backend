//imports the initialized firebase admin
const admin = require("../config/firebase");

//'middleware' checks for a valid firebase token in the request headers
const firebaseAuth = async (req, res, next) => {
   //extracts the token from the 'authorization' header if present
   const token = req.headers.authorization?.split(" ")[1];
   if (!token) return res.status(401).send({ message: "No token provided" });

   try {
      //verifies the token using firebase admin and attaches user data to the request
      const decoded = await admin.auth().verifyIdToken(token);
      req.user = decoded;
      next(); //continues to the next middleware or route
   } catch {
      //sends an error if the token is invalid or expired
      res.status(401).send({ message: "Invalid token" });
   }
};

//exports the middleware so it can be used in protected routes
module.exports = firebaseAuth;
