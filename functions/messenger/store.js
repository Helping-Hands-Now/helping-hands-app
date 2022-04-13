/* eslint-disable promise/no-nesting */
const functions = require("firebase-functions");

module.exports = class Store {
  constructor(db) {
    this.db = db;
  }

  getUser(psid) {
    console.log("getUser " + psid);

    return this.db
      .collection("chat_users")
      .where("id", "==", psid)
      .get()
      .then((querySnapshot) => {
        var promises = [];
        querySnapshot.forEach((doc) => {
          promises.push(this.db.collection("chat_users").doc(doc.id).get());
        });
        return Promise.all(promises);
      })
      .then((docs) => {
        if (docs.length > 0) {
          return docs[0].data();
        }
        return null;
      })
      .catch(function (error) {
        console.log("Error getting documents: ", error);
      });
  }

  createUser(user) {
    console.log("createUser: " + user.psid);

    const userData = {
      id: user.psid,
      firstName: user.firstName,
      lastName: user.lastName,
      gender: user.gender,
      platform: "messenger",
    };

    const docRef = this.db
      .collection("chat_users")
      .where("id", "==", user.psid);
    const newDocRef = this.db.collection("chat_users").doc();

    return this.db.runTransaction((transaction) => {
      return transaction
        .get(docRef)
        .then((querySnapshot) => {
          console.log("createUser result size: ", querySnapshot.size);
          if (querySnapshot.size > 0) {
            console.log("createUser: user exists in DB");
            throw new functions.https.HttpsError(
              "permission-denied",
              "This user already exisits."
            );
          }
          console.log("createUser: add user to DB");
          return transaction.set(newDocRef, userData);
        })
        .then((docRef) => {
          console.log(
            `successfully create user ${user.psid}. doc: ${newDocRef.id}`
          );
          return { uid: newDocRef.id };
        })
        .catch((error) => {
          console.log("createUser Transaction failed: ", error);
        });
    });
  }

  updateUser(user, obj) {
    console.log("updating field: " + user.psid + " " + obj);
    return this.db
      .collection("chat_users")
      .where("id", "==", user.psid)
      .get()
      .then((querySnapshot) => {
        var promises = [];
        querySnapshot.forEach((doc) => {
          promises.push(
            this.db.collection("chat_users").doc(doc.id).update(obj)
          );
        });
        return Promise.all(promises);
      })
      .catch(function (error) {
        console.log("Error updating documents: ", error);
      });
  }
};
