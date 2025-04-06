//imports the firebase-admin SDK which allows secure access to firebase
const admin = require("firebase-admin");

//parses the firebase service account key from the base64-encoded environment variable
//using the regular method of ENV Vars was a lot of trouble
const serviceAccount = JSON.parse(Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, "base64").toString("utf-8"));

//initialises the firebase admin app using the decoded service account credentials
admin.initializeApp({
   credential: admin.credential.cert(serviceAccount),
});

//exports the initialized admin instance so it can be used in other backend files
module.exports = admin;
