const admin = require('firebase-admin');

let serviceAccount = require("../serviceAccount.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: yourfirebase database url,
  storageBucket: your storage bucket name
});

const db = admin.firestore();

module.exports = { admin, db }
