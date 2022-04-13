/* eslint-disable promise/no-nesting */
var functions = require("firebase-functions");

// Email domains that are allowed for admin access:
// All Helping Hands volunteers, with helpinghands.community
// email addresses are allowed to have admin access.
// Additionally, the consulting company Stemmler Technologies
// also has admin access with their stemmler.tech emails.
const emailDomainHelpingHands = "helpinghands.community";
const emailDomainStemTech = "stemmler.tech";
const adminAccessEmailDomains = new Set([
  emailDomainHelpingHands,
  emailDomainStemTech,
]);

async function getUserCreationData(admin, data, context) {
  async function getDateMap(admin, map, nextPageToken) {
    let month;
    let day;
    return await admin
      .auth()
      .listUsers(1000, nextPageToken)
      .then(async function (listUsersResult) {
        listUsersResult.users.forEach(function (userRecord) {
          var creationTime = new Date(
            userRecord.toJSON().metadata.creationTime
          );
          month = creationTime.getMonth() + 1;
          month = month < 10 ? `0${month}` : month;
          day = creationTime.getDate();
          day = day < 10 ? `0${day}` : day;
          var date = `${creationTime.getFullYear()}-${month}-${day}`;
          if (map.has(date)) {
            map.set(date, map.get(date) + 1);
          } else {
            map.set(date, 1);
          }
        });
        if (listUsersResult.pageToken) {
          // list next batch
          await getDateMap(admin, map, listUsersResult.pageToken);
        }
        return;
      })
      .catch(function (error) {
        console.log("Error listing users:", error);
      });
  }

  if (!context.auth.token.admin) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "User not authorized for this action."
    );
  }

  // Lazy initialization
  if (!admin) {
    admin = require("firebase-admin");
    admin.initializeApp();
  }

  let map = new Map();
  await getDateMap(admin, map);
  var dates = [];
  map.forEach((value, key) => {
    dates.push({
      date: key,
      value: value,
    });
  });
  dates.sort((a, b) => (a.date > b.date ? 1 : -1));

  return dates;
}

function getUsers(db, admin, data, context) {
  // data = {
  //   search: search
  // }
  //
  if (!context.auth.token.admin) {
    return { status: "error", message: "user not authorized" };
  }

  // Lazy initialization
  if (!admin) {
    admin = require("firebase-admin");
    admin.initializeApp();
  }
  db = db || admin.firestore();

  const usersData = {};

  const search = data.search;

  let queries = [
    db.collection("users").where("firstName", "==", search),
    db.collection("users").where("lastName", "==", search),
    db.collection("users").where("phoneNumber", "==", search),
  ];

  let users = [];
  let promises = [];

  queries.forEach((query) => {
    let promise = query.get().then((querySnapshot) => {
      querySnapshot.forEach((doc) => {
        var data = doc.data();
        data.uid = doc.id;
        users.push(data);
      });
      return;
    });
    promises.push(promise);
  });

  return Promise.all(promises).then(() => {
    let promises = [];
    users.forEach((user) => {
      var promise = admin.auth().getUser(user.uid);
      promises.push(promise);
    });

    return Promise.all(promises.map((p) => p.catch((e) => e)))
      .then((authUserRecords) => {
        users.map((user, i) => {
          var record = authUserRecords[i];
          if (!(record instanceof Error)) {
            record.phoneNumber = user.phoneNumber;
            if (record.customClaims) {
              record.isAdmin = record.customClaims.admin;
              record.isSuperAdmin = record.customClaims.superAdmin;
            }
            usersData[user.uid] = Object.assign({}, record, user);
          }
          return usersData;
        });
        return usersData;
      })
      .catch((error) => {
        console.log(error);
      });
  });
}

async function getAdmins(db, admin, data, context) {
  if (!context.auth.token.admin) {
    return { status: "error", message: "user not authorized" };
  }

  // Lazy initialization
  if (!admin) {
    admin = require("firebase-admin");
    admin.initializeApp();
  }
  db = db || admin.firestore();

  const userAuthRecords = [];

  async function listAllUsers(nextPageToken) {
    // list users by batch, 1000 is the limit
    return await admin
      .auth()
      .listUsers(1000, nextPageToken)
      .then(async (listUsersResult) => {
        listUsersResult.users.forEach((userRecord) => {
          if (!(userRecord instanceof Error)) {
            if (userRecord.customClaims && userRecord.customClaims.admin) {
              userRecord.isAdmin = userRecord.customClaims.admin;
              userRecord.isSuperAdmin = userRecord.customClaims.superAdmin;
              userAuthRecords.push(userRecord);
            }
          }
        });

        if (listUsersResult.pageToken) {
          // list next batch
          await listAllUsers(listUsersResult.pageToken);
        }
        return userAuthRecords;
      })
      .catch(function (error) {
        console.log("Error listing users:", error);
      });
  }
  await listAllUsers();

  const promises = [];
  const usersData = {};

  for (const record of userAuthRecords) {
    const userDocRef = db.collection("users").doc(record.uid);
    const promise = userDocRef.get().then((userDocSnapshot) => {
      if (userDocSnapshot.exists) {
        const user = userDocSnapshot.data();
        usersData[userDocSnapshot.id] = Object.assign({}, user, record);
      }
      return;
    });
    promises.push(promise);
  }
  await Promise.all(promises);

  return usersData;
}

function makeAdminImpl(admin) {
  // Lazy initialization
  if (!admin) {
    admin = require("firebase-admin");
    admin.initializeApp();
  }
  const admins = functions.config().admin.emails.split(",");
  admins.forEach((email) => {
    admin
      .auth()
      .getUserByEmail(email)
      .then((user) => {
        return makeUserAdminImpl(admin, user, true, false);
      })
      .catch((error) => {
        console.log("Could not make user " + email + " an admin", error);
      });
  });
}

function makeUserAdminImpl(admin, user, isAdmin, isSuperAdmin, adminRecordId) {
  let row = isSuperAdmin
    ? { admin: true, superAdmin: true }
    : isAdmin
    ? { admin: true, superAdmin: false }
    : { admin: false, superAdmin: false };
  if (row) {
    row.adminRecordId = adminRecordId;
  }

  return admin
    .auth()
    .setCustomUserClaims(user.uid, row)
    .then(() => {
      // Update real-time database to notify client to force refresh.
      const metadataRef = admin.database().ref("metadata/" + user.uid);
      // Set the refresh time to the current UTC timestamp.
      // This will be captured on the client to force a token refresh.
      return metadataRef.set({ refreshTime: new Date().getTime() });
    })
    .catch((error) => {
      console.log("Could not notify client to force refresh", error);
    });
}

// todo clean this up as it is not used any more
function makeUserAdmin(admin, data, context) {
  if (!context.auth.token.admin) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "User not authorized for this action."
    );
  }

  // Lazy initialization
  if (!admin) {
    admin = require("firebase-admin");
    admin.initializeApp();
  }

  return admin
    .auth()
    .getUser(data.uid)
    .then((user) => {
      if (data.isAdmin) {
        if (!user.email) {
          throw new functions.https.HttpsError(
            "invalid-argument",
            "user needs an email"
          );
        }
        const emailAddress = require("email-addresses");
        const result = emailAddress.parseOneAddress(user.email);
        if (!result || !adminAccessEmailDomains.has(result.domain)) {
          throw new functions.https.HttpsError(
            "invalid-argument",
            "can only make users with email addresses [" +
              Array.from(adminAccessEmailDomains).join(", ") +
              "] an admin"
          );
        }
      }
      return makeUserAdminImpl(
        admin,
        user,
        data.isAdmin,
        data.isSuperAdmin,
        data.adminRecordId
      );
    })
    .catch((error) => {
      console.log("error trying to make user admin", error);
      throw new functions.https.HttpsError(
        "internal",
        "error trying to make user admin"
      );
    });
}

function closeRequestGivenOutcome(db, admin, data, context) {
  if (!admin) {
    admin = require("firebase-admin");
    admin.initializeApp();
  }
  db = db || admin.firestore();

  if (!context.auth.token.admin) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "User not authorized for this action."
    );
  }

  const requestId = data.requestId;
  const outcome = data.outcome;

  return db
    .collection("requests")
    .doc(requestId)
    .get()
    .then((requestDoc) => {
      data = requestDoc.data();

      if (data.status === "closed") {
        throw new functions.https.HttpsError(
          "permission-denied",
          "This request is already closed."
        );
      }

      var updatedObj = {
        status: "closed",
        outcome: outcome,
        timeClosed: new Date(),
        closedMethod: "Ops",
      };

      return db.collection("requests").doc(requestId).update(updatedObj);
    });
}

function formatAMPM(date) {
  var hours = date.getHours();
  var minutes = date.getMinutes();
  var ampm = hours >= 12 ? "pm" : "am";
  hours = hours % 12;
  hours = hours ? hours : 12; // the hour '0' should be '12'
  minutes = minutes < 10 ? "0" + minutes : minutes;
  var strTime = hours + ":" + minutes + " " + ampm;
  return strTime;
}

function customAdminRowParts(data) {
  switch (data.action) {
    case "ban":
      return {
        banReason: data.reason,
      };
    case "flag":
      return {
        flagReason: data.reason,
      };
    case "editProfile":
      return {
        profileChanges: data.profileChanges,
      };
    default:
      return {};
  }
}

function customUserRowParts(data) {
  switch (data.action) {
    case "flag":
    case "unflag":
      return {
        isFlagged: data.action === "flag",
      };
    case "ban":
    case "unban":
      return {
        isBanned: data.action === "ban",
      };
    case "editProfile":
      return data.userRow;
  }
  return null;
}

function validateAdminUsers(admin, uids, action) {
  let validatedAdminUsers = {};
  let promises = [];

  uids.map((uid) => {
    promises.push(admin.auth().getUser(uid));
  });

  return Promise.all(promises)
    .then((promises) => {
      promises.forEach((user) => {
        if (action === "makeAdmin" || action === "makeSuperAdmin") {
          if (!user.email) {
            throw new functions.https.HttpsError(
              "invalid-argument",
              "user needs an email"
            );
          }
          const emailAddress = require("email-addresses");
          const result = emailAddress.parseOneAddress(user.email);
          if (!result || !adminAccessEmailDomains.has(result.domain)) {
            throw new functions.https.HttpsError(
              "invalid-argument",
              "can only make users with email addresses [" +
                Array.from(adminAccessEmailDomains).join(", ") +
                "] an admin"
            );
          }
        }
        validatedAdminUsers[user.uid] = user;
      });
      return;
    })
    .then(() => {
      return validatedAdminUsers;
    });
}

function performAdminActionImpl(
  db,
  admin,
  data,
  context,
  adminFlow,
  validatedAdminUsers
) {
  var promises = [];

  data.uids.forEach((uid) => {
    const adminRecord = {
      ...customAdminRowParts(data),
      uid: uid,
      action: data.action,
      actionTs: Date.now(),
      actionBy: context.auth.token.user_id,
    };

    promises.push(
      createAdminRecordImpl(db, adminRecord, (adminRef, record) => {
        let adminRecordId = adminRef.id;
        let userRow = customUserRowParts(data);
        if (userRow) {
          userRow = {
            ...userRow,
            adminRecord: adminRecordId,
          };
          return db
            .collection("users")
            .doc(record.uid)
            .update(userRow)
            .catch((error) => console.error(error));
        } else if (adminFlow) {
          // special case. make or remove admin privileges...
          makeUserAdminImpl(
            admin,
            validatedAdminUsers[record.uid],
            data.action === "makeAdmin",
            data.action === "makeSuperAdmin",
            adminRecordId
          );
          console.log("makeUserAdmin for " + record.uid);
        }
        return null;
      })
    );
  });
  return Promise.all(promises);
}

function performAdminAction(db, admin, data, context) {
  if (!context.auth.token.admin) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "User not authorized for this action."
    );
  }

  if (!data.uids || !data.uids.length || !data.action) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "invalid data passed"
    );
  }

  // Lazy initialization
  if (!admin) {
    admin = require("firebase-admin");
    admin.initializeApp();
  }
  db = db || admin.firestore();

  let adminFlow =
    data.action === "makeAdmin" ||
    data.action === "removeAdmin" ||
    data.action === "makeSuperAdmin";

  // validate that email is valid first...
  if (adminFlow) {
    if (!context.auth.token.superAdmin) {
      throw new functions.https.HttpsError(
        "unauthenticated",
        "User not authorized for this action."
      );
    }

    return validateAdminUsers(admin, data.uids, data.action)
      .then((validatedAdminUsers) => {
        return performAdminActionImpl(
          db,
          admin,
          data,
          context,
          true,
          validatedAdminUsers
        );
      })
      .catch((error) => {
        // rethrow.
        throw error;
      });
  } else {
    return performAdminActionImpl(db, admin, data, context, false);
  }
}

function createAdminRecordImpl(db, record, thenFunc) {
  record.banReason = record.banReason || "";
  record.flagReason = record.flagReason || "";
  record.actionTs = record.actionTs || "";
  record.actionBy = record.actionBy || "";
  //  record.action = 'makeAdmin|removeAdmin|flag|unflag|ban|unban|editProfile';
  record.action = record.action || "unknown";
  // todo kill these 6...
  record.isFlagged = record.isFlagged || false;
  record.isBanned = record.isBanned || false;
  record.flagTs = record.flagTs || "";
  record.flagBy = record.flagBy || "";
  record.banTs = record.banTs || "";
  record.banBy = record.banBy || "";

  return db
    .collection("admin_records")
    .add(record)
    .then((adminRef) => {
      return thenFunc(adminRef, record);
    })
    .catch((error) => {
      console.error(error);
      return {
        status: "error",
        message: "Error creating admin record for user",
      };
    });
}

function queryAdminRecords(db, admin, data, context) {
  if (!context.auth.token.admin) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "User not authorized"
    );
  }
  if (!admin) {
    admin = require("firebase-admin");
    admin.initializeApp();
  }
  db = db || admin.firestore();

  return (
    db
      .collection("admin_records")
      .where("uid", "==", data.uid)
      // todo order...
      //    .orderBy('timeCreated', 'desc')
      .get()
      .then((snapshot) => {
        let results = [];
        let promises = [];
        let adminData = {};
        let userData = {};

        snapshot.forEach((doc) => {
          var data = doc.data();
          data.id = doc.id;

          let actionBy = data.actionBy || data.flagBy || data.banBy;
          if (actionBy) {
            promises.push(db.collection("users").doc(actionBy).get());
            adminData[data.id] = data;
          } else {
            results.push(data);
          }
        });

        return Promise.all(promises).then((docs) => {
          docs.forEach((doc) => {
            let data = doc.data();
            userData[doc.id] = data;
          });

          for (const key in adminData) {
            let data = adminData[key];
            let actionBy = data.actionBy || data.flagBy || data.banBy;

            let userInfo = userData[actionBy];
            if (userInfo) {
              data["actorInfo"] = userInfo;
            }
            results.push(data);
          }
          return results;
        });
      })
  );
}

module.exports = {
  getUserCreationData,
  getUsers,
  getAdmins,
  makeAdminImpl,
  makeUserAdmin,
  performAdminAction,
  queryAdminRecords,
  closeRequestGivenOutcome,
};
