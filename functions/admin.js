const functions = require("firebase-functions");

let admin;
let db;

// Lazy initialization
if (!admin) {
  admin = require("firebase-admin");
  admin.initializeApp();
}
db = db || admin.firestore();

module.exports = {
  admin,
  db,
};
