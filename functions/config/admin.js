const admin = require('firebase-admin');

let serviceAccount = require("../serviceAccount.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://socialapp-69777.firebaseio.com",
  storageBucket: "socialapp-69777.appspot.com"
});

const db = admin.firestore();

module.exports = { admin, db }
