var functions = require("firebase-functions");
var { initialFromLastName } = require("../notifications");
var {
  haversineDistance,
  destVincenty,
  geohashSearchParams,
} = require("../geo");

function queryRequestData(admin, db, queryDocs) {
  // Lazy initialization
  if (!admin) {
    admin = require("firebase-admin");
    admin.initializeApp();
  }
  db = db || admin.firestore();

  const requestsData = {};
  const helperData = {};
  const requesterData = {};

  const promises = [];
  queryDocs.forEach((requestDoc) => {
    var requestData = requestDoc.data();
    const requestId = requestDoc.id;
    requestData.id = requestId;
    requestsData[requestId] = requestData;
    if (requestData.helper) {
      var helperSnapshot = db.collection("users").doc(requestData.helper).get();
      promises.push(helperSnapshot);
    }
  });

  return Promise.all(promises)
    .then((helperSnapshots) => {
      return helperSnapshots.forEach((helperSnap) => {
        var helperObj = helperSnap.data();
        helperData[helperSnap.id] = {
          helperFirstName: helperObj.firstName,
          helperLastName: initialFromLastName(helperObj.lastName),
          helperGender: helperObj.gender,
          helperPhoneNumber: helperObj.phoneNumber,
          helperLanguages: helperObj.languages,
          helperAboutUser: helperObj.aboutUser,
        };
      });
    })
    .then(() => {
      for (var key of Object.keys(requestsData)) {
        if (requestsData[key].helper) {
          requestsData[key].helperData = helperData[requestsData[key].helper];
        }
      }
      return;
    })
    .then(() => {
      const promises = [];
      queryDocs.forEach((requestDoc) => {
        var requestData = requestDoc.data();
        var requesterSnapshot = db
          .collection("users")
          .doc(requestData.requester)
          .get();
        promises.push(requesterSnapshot);
      });

      return Promise.all(promises);
    })
    .then((requesterSnapshots) => {
      return requesterSnapshots.forEach((requesterSnap) => {
        var requesterObj = requesterSnap.data();
        requesterObj["lastName"] = initialFromLastName(
          requesterObj["lastName"]
        );
        requesterData[requesterSnap.id] = requesterObj;
      });
    })
    .then(() => {
      for (var key of Object.keys(requestsData)) {
        requestsData[key].requesterData =
          requesterData[requestsData[key].requester];
      }
      return;
    })
    .then(() => {
      return { results: requestsData };
    });
}

function queryPendingRequests(db, admin, data, context) {
  // Lazy initialization
  if (!admin) {
    admin = require("firebase-admin");
    admin.initializeApp();
  }
  db = db || admin.firestore();

  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "User not authenticated."
    );
  }

  const uid = context.auth.token.user_id;

  const requestsData = {};
  const sensitiveData = {};

  return db
    .collection("requests")
    .where("helper", "==", uid)
    .where("toBeFulfilledBy", "==", "VOLUNTEER")
    .where("status", "in", ["pending_acceptance", "pending_fulfillment"])
    .get()
    .then(function (querySnapshot) {
      const promises = [];
      querySnapshot.forEach(function (doc) {
        requestsData[doc.id] = doc.data();
        requestsData[doc.id].id = doc.id;
        const requesterSnapshot = db
          .collection("users")
          .doc(doc.data().requester)
          .get();
        promises.push(requesterSnapshot);
      });

      return Promise.all(promises);
    })
    .then((requesterSnapshots) => {
      return requesterSnapshots.forEach((requesterSnap) => {
        if (requesterSnap.exists) {
          sensitiveData[requesterSnap.id] = {
            photoUrl: requesterSnap.data().photoUrl,
            languages: requesterSnap.data().languages,
            phoneNumber: requesterSnap.data().phoneNumber,
            firstName: requesterSnap.data().firstName,
            lastName: initialFromLastName(requesterSnap.data().lastName),
          };
        }
      });
    })
    .then(() => {
      for (var key of Object.keys(requestsData)) {
        requestsData[key].sensitive =
          sensitiveData[requestsData[key].requester];
      }
      return;
    })
    .then(() => {
      return { requestsData: requestsData };
    });
}

function queryCommunityDeliveryEvents(db, admin, data, context) {
  // Lazy initialization
  if (!admin) {
    admin = require("firebase-admin");
    admin.initializeApp();
  }
  db = db || admin.firestore();

  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "User not authenticated."
    );
  }

  const uid = context.auth.token.user_id;
  const type = data.type;
  const now = new Date();

  let query;

  if (type === "active") {
    query = db
      .collection("community_events")
      .where("volunteers", "array-contains", uid)
      .where("eventTimeEnd", ">=", now);
  } else if (type === "past") {
    query = db
      .collection("community_events")
      .where("volunteers", "array-contains", uid)
      .where("eventTimeEnd", "<=", now);
  }

  var eventData = [];

  return query
    .get()
    .then((querySnapshot) => {
      var promises = [];
      querySnapshot.forEach((event) => {
        var obj = event.data();
        obj.id = event.id;
        promises.push([
          obj,
          db.collection("suppliers").doc(event.data().supplierID).get(),
          db
            .collection("community_events")
            .doc(event.id)
            .collection("volunteers")
            .doc(uid)
            .get(),
        ]);
      });
      return Promise.all(promises.map(Promise.all.bind(Promise)));
    })
    .then((results) => {
      results.forEach(([eventObj, supplier, volunteer]) => {
        eventObj.supplierInfo = supplier.data();
        eventObj.volunteerInfo = volunteer.data();
        promises = [];
        volunteer.data().assignedRequests.forEach((requestID) => {
          promises.push(db.collection("requests").doc(requestID).get());
        });
        promises.unshift(eventObj);
        eventData.push(promises);
      });
      return Promise.all(eventData.map(Promise.all.bind(Promise)));
    })
    .then((results) => {
      returnArray = [];
      results.forEach((result) => {
        eventObj = result[0];
        temp = [];
        for (var i = 1; i < result.length; i++) {
          temp.push(result[i].data());
        }
        eventObj.volunteerInfo.assignedRequests = temp;
        returnArray.push(eventObj);
      });
      eventData = returnArray;
      return returnArray;
    })
    .then((array) => {
      promises = [];
      array.forEach((event) => {
        requestersPromises = [];
        event.volunteerInfo.assignedRequests.forEach((delivery) => {
          requestersPromises.push(
            db.collection("users").doc(delivery.requester).get()
          );
        });
        promises.push(requestersPromises);
      });
      return Promise.all(promises.map(Promise.all.bind(Promise)));
    })
    .then((results) => {
      index = 0;
      for (var j = 0; j < returnArray.length; j++) {
        x = 0;
        for (
          var i = 0;
          i < returnArray[j].volunteerInfo.assignedRequests.length;
          i++
        ) {
          returnArray[j].volunteerInfo.assignedRequests[
            i
          ].requesterInfo = results[index][x].data();
          x++;
        }
        index++;
      }
      return {
        eventData: returnArray.sort((a, b) =>
          a.eventTime < b.eventTime ? 1 : -1
        ),
      };
    });
}

function queryOpenRequests(db, admin, data, context) {
  // Lazy initialization
  if (!admin) {
    admin = require("firebase-admin");
    admin.initializeApp();
  }
  db = db || admin.firestore();

  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "User not authenticated."
    );
  }

  const uid = context.auth.token.user_id;

  var requestsCreatedBy = db
    .collection("requests")
    .where("createdBy", "==", uid)
    .where("status", "in", [
      "open",
      "pending_acceptance",
      "pending_fulfillment",
    ])
    .where("toBeFulfilledBy", "==", "VOLUNTEER")
    .orderBy("timeCreated", "desc");

  return requestsCreatedBy.get().then((createdBySnapshot) => {
    return queryRequestData(admin, db, createdBySnapshot.docs);
  });
}

function queryNumberOfVolunteersNear(db, admin, data, context) {
  return queryVolunteersNear(db, admin, data, context).then(
    (vDocs) => vDocs.length
  );
}

function queryVolunteersNear(db, admin, data, context, distance = 25) {
  // Lazy initialization
  if (!admin) {
    admin = require("firebase-admin");
    admin.initializeApp();
  }
  db = db || admin.firestore();

  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "User not authenticated."
    );
  }

  const uid = context.auth.token.user_id;

  var userDoc = db.collection("users").doc(uid);

  return userDoc
    .get()
    .then((userDocSnapshot) => {
      var userGeohash = userDocSnapshot.data().geohash;

      var { bottomLeft, topRight } = geohashSearchParams(userGeohash, distance);
      volunteersInArea = db
        .collection("users")
        .where("canHelp", "==", true)
        .where("geohash", ">=", bottomLeft)
        .where("geohash", "<=", topRight);

      return volunteersInArea.get();
    })
    .then((volunteersSnapshot) => {
      return volunteersSnapshot.docs;
    });
}

function queryPastRequests(db, admin, data, context) {
  // Lazy initialization
  if (!admin) {
    admin = require("firebase-admin");
    admin.initializeApp();
  }
  db = db || admin.firestore();

  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "User not authenticated."
    );
  }

  const uid = context.auth.token.user_id;

  var requestsCreatedBy = db
    .collection("requests")
    .where("createdBy", "==", uid)
    .where("status", "in", ["closed"])
    .where("toBeFulfilledBy", "==", "VOLUNTEER")
    .orderBy("timeCreated");

  return requestsCreatedBy.get().then((createdBySnapshot) => {
    return queryRequestData(admin, db, createdBySnapshot.docs);
  });
}

async function queryRequestRetries(db, admin, data, context) {
  // Lazy initialization
  if (!admin) {
    admin = require("firebase-admin");
    admin.initializeApp();
  }
  db = db || admin.firestore();

  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "User not authenticated."
    );
  }

  var id = data.id;

  var snapshot = await db
    .collection("requests")
    .doc(id)
    .collection("retries")
    .get();

  return snapshot.docs.map((doc) => doc.data());
}

function queryLastEmailSentToUserDate(db, userId, templateId) {
  var latestEmails = db
    .collection("emails")
    .where("userId", "==", userId)
    .orderBy("sendAt", "desc")
    .limit(1);
  if (templateId) {
    latestEmails = latestEmails.where("templateId", "==", templateId);
  }
  return latestEmails.get().then((latestEmails) => {
    return (
      latestEmails.docs.length > 0 &&
      latestEmails.docs[0].data().sendAt.toDate()
    );
  });
}

module.exports = {
  queryPendingRequests,
  queryCommunityDeliveryEvents,
  queryOpenRequests,
  queryPastRequests,
  queryVolunteersNear,
  queryNumberOfVolunteersNear,
  queryLastEmailSentToUserDate,
  queryRequestRetries,
};
