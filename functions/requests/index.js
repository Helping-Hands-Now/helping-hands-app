var functions = require("firebase-functions");
var {
  sendText,
  initialFromLastName,
  getLanguageFrom,
  TEXT_thankYou,
  TEXT_cancellationTextRequester,
  TEXT_cancellationTextCreatedBy,
  TEXT_pairingTextRequester,
  TEXT_pairingTextCreatedBy,
  TEXT_pairingTextVolunteer,
  TEXT_closeTextRequester,
  TEXT_closeTextCreatedBy,
  TEXT_closeTextHelper,
  TEXT_requesterCancelledHelper,
} = require("../notifications");

const numHelperCancellationsAllowedPerDay = 3;

// this takes a request query with wheres and then loads request data e.g. supplier and recipient of that request
function loadRequestData(db, requestSnapshotPromise) {
  var requestDatas = []; // List of all the requests
  var supplierData = {}; // Used to load auxiliary supplier data
  var recipientData = {}; // Used to load auxiliary recipient data
  // TODO: This might end up loading a lot of duplicated data

  // The data we return
  var organizationRequests = [];

  return requestSnapshotPromise
    .then((requestDocs) => {
      return loadRequestDataFromDocs(db, requestDocs, true);
    })
    .catch((err) => {
      console.log(err);
    });
}

// this takes an array of request docs and then loads request data e.g. supplier and recipient of that request
function loadRequestDataFromDocs(db, requestDocs, includeSuppliers) {
  var requestDatas = []; // List of all the requests
  var supplierData = {}; // Used to load auxiliary supplier data
  var recipientData = {}; // Used to load auxiliary recipient data
  // TODO: This might end up loading a lot of duplicated data

  // The data we return
  let organizationRequests = [];

  function loadDocuments(collectionName, documentIds) {
    if (documentIds.size === 0) {
      return Promise.resolve([]);
    }
    const documentRefs = [];
    documentIds.forEach((document) => {
      documentRefs.push(db.collection(collectionName).doc(document));
    });
    return db.getAll(...documentRefs);
  }

  let suppliersToLoad = new Set();
  let recipientsToLoad = new Set();

  requestDocs.forEach((requestDoc) => {
    let requestData = requestDoc.data();
    requestData.id = requestDoc.id;
    requestDatas.push(requestData);

    if (includeSuppliers && requestData.supplier) {
      suppliersToLoad.add(requestData.supplier);
    }
    if (requestData.requester) {
      recipientsToLoad.add(requestData.requester);
    }
  });
  console.time("LoadDocuments");
  return Promise.all([
    loadDocuments("suppliers", suppliersToLoad),
    loadDocuments("users", recipientsToLoad),
  ])
    .then(([supplierDocs, recipientDocs]) => {
      console.timeEnd("LoadDocuments");
      supplierDocs.forEach((supplierDoc) => {
        if (supplierDoc.exists) {
          let supplier = supplierDoc.data();
          supplier.id = supplierDoc.id;
          supplierData[supplierDoc.id] = supplier;
        }
      });

      recipientDocs.forEach((recipientDoc) => {
        if (recipientDoc.exists) {
          let recipient = recipientDoc.data();
          recipient.id = recipientDoc.id;
          recipientData[recipientDoc.id] = recipient;
        }
      });

      requestDatas.forEach((requestData) => {
        requestData.recipient =
          requestData.requester in recipientData
            ? recipientData[requestData.requester]
            : null;
        if (includeSuppliers) {
          requestData.supplier =
            requestData.supplier && requestData.supplier in supplierData
              ? supplierData[requestData.supplier]
              : null;
        }
        organizationRequests.push(requestData);
      });

      return organizationRequests;
    })
    .catch((err) => {
      console.log(err);
    });
}

// USER CALLABLE
function createRequest(db, admin, data, context) {
  // Lazy initialization
  if (!admin) {
    admin = require("firebase-admin");
    admin.initializeApp();
  }
  db = db || admin.firestore();

  /* Error cases:
  1) User isn't authed
  2) Requester already has a request open
  3) Requester document doesn't exist
  4) Requester does not have 'needsHelp' set to true
  5) Write fails in Firebase
  */

  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "User not authenticated."
    );
  }
  var requester;
  var requesterGeohash;
  var requesterCity;
  var requesterState;

  const createdByUid = context.auth.token.user_id;
  const requesterUid = data.requesterUid
    ? data.requesterUid
    : context.auth.token.user_id;
  const needs = data.needs;

  return db
    .collection("requests")
    .where("requester", "==", requesterUid)
    .where("status", "==", "open")
    .where("toBeFulfilledBy", "==", "VOLUNTEER")
    .get()
    .then((querySnapshot) => {
      if (querySnapshot.size >= 1) {
        throw new functions.https.HttpsError(
          "permission-denied",
          "You can only have one open request at a time.",
          (details = { label: "single-request-error" })
        );
      }
      return;
    })
    .then(() => {
      return db.collection("users").doc(requesterUid).get();
    })
    .then((requesterDoc) => {
      if (!requesterDoc.exists) {
        throw new functions.https.HttpsError(
          "not-found",
          "Requester creating request does not exist."
        );
      }
      if (!requesterDoc.data().needsHelp) {
        throw new functions.https.HttpsError(
          "permission-denied",
          'User must have registered as "needs help" to make a request.'
        );
      }
      requester = requesterDoc;
      return requesterDoc;
    })
    .then((requesterDoc) => {
      requesterGeohash = requesterDoc.data().geohash;

      requesterCity = requesterDoc.data().city;
      requesterState = requesterDoc.data().state;

      return db.collection("requests").add({
        requester: requesterUid,
        createdBy: createdByUid,
        helper: null,
        toBeFulfilledBy: "VOLUNTEER",
        status: "open",
        needs: needs,
        zipCode: requesterDoc.data().zipCode,
        requesterFirstName: requesterDoc.data().firstName,
        timeCreated: new Date(),
        geohash: requesterDoc.data().geohash,
        languages: requesterDoc.data().languages,
        aboutUser: requesterDoc.data().aboutUser,
      });
    })
    .then((docRef) => {
      // Notify nearest 10 volunteers within 25 miles of the
      // new request if they haven't already received one within 3 days
      const EMAIL_LIMIT = 10;
      const DISTANCE = 25;
      const QUERY_LIMIT = 25; // Don't want too large fanout since we query each volunteer
      const msPerDay = 1000 * 60 * 60 * 24;
      const DAYS_LIMIT = 3 * msPerDay;
      const LOWER_LIMIT = 0; // Alert field-ops when volunteers available to email is <= lower limit

      const { geohashSearchParams, geohashDist } = require("./../geo");
      const {
        VOLUNTEER_NEW_OPEN_REQUESTS_TEMPLATE_ID,
      } = require("./../notifications/email_templates");
      const {
        queryVolunteersNear,
        queryLastEmailSentToUserDate,
      } = require("./../queries");
      const { sendSlackMessage } = require("../bots");

      const sendAvailableRequestToNearbyVolunteers = async () => {
        var volunteersInArea = await queryVolunteersNear(
          db,
          admin,
          data,
          context,
          DISTANCE
        );
        console.log(
          `Found ${volunteersInArea.length} nearby volunteers in the area`
        );
        volunteersInArea = volunteersInArea.slice(0, QUERY_LIMIT);

        // filter for volunteers who haven't received an email in the past 3 days
        const nowTime = new Date();
        const emailDates = await Promise.all(
          volunteersInArea.map((v) =>
            queryLastEmailSentToUserDate(
              db,
              v.id,
              VOLUNTEER_NEW_OPEN_REQUESTS_TEMPLATE_ID
            )
          )
        );
        var volunteersAvailableForEmail = emailDates
          .map((dt, i) => [volunteersInArea[i], dt])
          .filter(
            (volunteerAndEmailDate) =>
              !volunteerAndEmailDate[1] ||
              nowTime - volunteerAndEmailDate[1] > DAYS_LIMIT
          )
          .map((arr) => arr[0]);
        console.log(
          `${volunteersAvailableForEmail.length} volunteers available to email`
        );

        if (volunteersAvailableForEmail.length <= LOWER_LIMIT) {
          const {
            firstName,
            lastName,
            street,
            apartment,
            city,
            state,
            zipCode,
            phoneNumber,
          } = requester.data();
          const name = `${firstName} ${lastName.charAt(0)}.`;
          const address = `${street} ${apartment}, ${city}, ${state} ${zipCode}`;

          const webhookUrl = functions.config().fieldopsbotwebhook.url;
          const message = `New request created with no volunteers available nearby:
          \n*Name:* ${name} \n*Address:* ${address} \n*Phone Number:* ${phoneNumber} \n*Request:* ${needs}`;

          try {
            sendSlackMessage(webhookUrl, message);
          } catch (err) {
            console.log(`Failed to send message: ${err}`);
          }
        }

        // If number >10, find the 10 closest volunteers
        if (volunteersAvailableForEmail.length > EMAIL_LIMIT) {
          volunteersAvailableForEmail = volunteersAvailableForEmail
            .sort(
              (a, b) =>
                geohashDist(requesterGeohash, b.data().geohash) -
                geohashDist(requesterGeohash, a.data().geohash)
            )
            .slice(0, EMAIL_LIMIT);
        }
        // Send emails
        console.log(
          `Emailing volunteerNewOpenRequests to ${volunteersAvailableForEmail.length} volunteers`
        );
        var promises = volunteersAvailableForEmail.map((v) =>
          sendVolunteerNewOpenRequests(db, v.id, v.data(), requester.data())
        );
        await Promise.all(promises);
        return docRef;
      };
      return Promise.resolve(sendAvailableRequestToNearbyVolunteers());
    })
    .then((docRef) => {
      console.log(`succesfully created request for ${createdByUid}`);
      return { requestUid: docRef.id };
    });
}

function acceptRequest(db, admin, data, context) {
  // Lazy initialization
  if (!admin) {
    admin = require("firebase-admin");
    admin.initializeApp();
  }
  db = db || admin.firestore();

  /* Error cases:
    1) User not authenticated
    2) Request doesn't exist
    3) There's already a helper
    4) Helper already has 3 pending jobs
    5) Helper has cancelled too many times in the last 24 hours. */

  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "User not authenticated."
    );
  }

  const helperUid = context.auth.token.user_id;
  const requestId = data.requestId;

  let volunteer;
  let volunteerName;
  let volunteerPhone;
  let volunteerAbout;

  let request;

  let requester;
  let requesterUid;
  let requesterName;
  let requesterPhone;

  let creatorUid;
  let creatorName;
  let creatorPhone;

  return db
    .collection("users")
    .doc(helperUid)
    .get()
    .then((snapshot) => {
      if (snapshot.data().checkrVerified === false) {
        throw new functions.https.HttpsError(
          "permission-denied",
          "You must complete your background check before accepting requests.",
          (details = { label: "limit-exceeded" })
        );
      }

      return db
        .collection("requests")
        .where("helper", "==", helperUid)
        .where("status", "==", "pending_fulfillment")
        .where("toBeFulfilledBy", "==", "VOLUNTEER")
        .get();
    })
    .then((querySnapshot) => {
      if (querySnapshot.size >= 3) {
        throw new functions.https.HttpsError(
          "permission-denied",
          "You can only accept up to 3 requests at a time. Please finish some of your current errands before accepting any new ones.",
          (details = { label: "limit-exceeded" })
        );
      }

      return db.collection("users").doc(helperUid).get();
    })
    .then((helperDoc) => {
      var helperObj = helperDoc.data();
      // Check that the helper has not made $numHelperCancellationsAllowedPerDay or more cancellations since the last reset
      if (
        helperObj.numCancellationsMadeToday !== null &&
        helperObj.numCancellationsMadeToday >=
          numHelperCancellationsAllowedPerDay
      ) {
        throw new functions.https.HttpsError(
          "permission-denied",
          `You cannot accept new requests if you have cancelled ${numHelperCancellationsAllowedPerDay} or more offers to help in the last 24 hours. Please try again after waiting a bit.`,
          (details = { label: "num-cancellations-exceeded" })
        );
      }

      volunteer = helperObj;
      volunteerName =
        helperObj.firstName + " " + initialFromLastName(helperObj.lastName);
      volunteerPhone = helperObj.phoneNumber;
      volunteerAbout = helperObj.aboutUser;

      return db.collection("requests").doc(requestId).get();
    })
    .then(function (requestDoc) {
      if (!requestDoc.exists) {
        throw new functions.https.HttpsError(
          "not-found",
          "Request document does not exist."
        );
      }

      if (requestDoc.data().helper) {
        throw new functions.https.HttpsError(
          "permission-denied",
          "Another helper has already accepted this request. Try refreshing your page.",
          (details = { label: "already-accepted" })
        );
      }

      request = requestDoc.data();
      requesterUid = request.requester;
      creatorUid = request.createdBy;

      // Change state of request to 'pending_fulfillment' in database
      return db.collection("requests").doc(requestId).set(
        {
          status: "pending_fulfillment",
          helper: helperUid,
          toBeFulfilledBy: "VOLUNTEER",
          timeAccepted: new Date(), // TODO is this best practice?
        },
        { merge: true }
      );
    })
    .then(() => {
      return db.collection("users").doc(requesterUid).get();
    })
    .then((requesterDoc) => {
      requester = requesterDoc.data();
      requesterName =
        requester.firstName + " " + initialFromLastName(requester.lastName);
      requesterPhone = requester.phoneNumber;
      return;
    })
    .then(() => {
      if (requesterUid !== creatorUid) {
        return db.collection("users").doc(creatorUid).get();
      }
      return;
    })
    .then((creatorDoc) => {
      if (requesterUid !== creatorUid) {
        var creatorObj = creatorDoc.data();
        creatorName =
          creatorObj.firstName + " " + initialFromLastName(creatorObj.lastName);
        creatorPhone = creatorObj.phoneNumber;
      }
      return;
    })
    .then(() => {
      const volunteerMessage = TEXT_pairingTextVolunteer(
        requesterName,
        requesterPhone,
        volunteerName,
        creatorName,
        creatorPhone
      );
      console.log(`Sending text message to ${volunteerPhone}`);
      return sendText(volunteerMessage, volunteerPhone);
    })
    .then(() => {
      const requesterMessage = TEXT_pairingTextRequester(
        volunteerName,
        volunteerPhone,
        volunteerAbout
      );
      console.log(`Sending text message to ${requesterPhone}`);
      return sendText(requesterMessage, requesterPhone);
    })
    .then(() => {
      if (requesterUid !== creatorUid) {
        const creatorMessage = TEXT_pairingTextCreatedBy(
          creatorName,
          requesterName,
          volunteerName,
          volunteerPhone,
          volunteerAbout
        );
        console.log(`Sending text message to ${creatorPhone}`);
        return sendText(creatorMessage, creatorPhone);
      }
      return;
    })
    .then(() => {
      return sendVolunteerAcceptRequest(
        db,
        helperUid,
        volunteer,
        requester,
        request
      );
    });
}

function sendVolunteerAcceptRequest(
  db,
  volunteerId,
  volunteer,
  requester,
  request
) {
  const email = require("./../notifications/email");
  const {
    INFO_ADDRESS,
    volunteerAcceptedEmailTemplate,
  } = require("./../notifications/email_templates");
  return email
    .send(
      db,
      volunteerId,
      volunteer.email,
      INFO_ADDRESS,
      volunteerAcceptedEmailTemplate(volunteer, requester, request)
    )
    .catch((e) => {
      console.error("sendVolunteerAcceptRequest failed:", e);
    });
}

async function sendVolunteerNewOpenRequests(
  db,
  volunteerId,
  volunteer,
  requester
) {
  const email = require("./../notifications/email");
  const {
    INFO_ADDRESS,
    volunteerNewOpenRequestsTemplate,
    volunteerNewOpenRequestsBGCReminderEmailTemplate,
  } = require("./../notifications/email_templates");
  if (volunteer.checkrVerified) {
    return email
      .send(
        db,
        volunteerId,
        volunteer.email,
        INFO_ADDRESS,
        volunteerNewOpenRequestsTemplate(volunteer, requester)
      )
      .catch((e) => {
        console.error("send volunteerNewOpenRequests email failed:", e);
      });
  } else {
    // when there is a new request, remind nearby volunteers to complete BGC
    // this behavior will be repeated at a max of 3 times
    const userRef = db.collection("users").doc(volunteerId);
    const userSnapshot = await userRef.get();
    const remindCount = userSnapshot.data().bgcRemindCount;

    if (!remindCount || remindCount <= 3) {
      remindCount
        ? await userRef.update({ bgcRemindCount: db.FieldValue.increment(1) })
        : await userRef.update({ bgcRemindCount: 1 });

      return email
        .send(
          db,
          volunteerId,
          volunteer.email,
          INFO_ADDRESS,
          volunteerNewOpenRequestsBGCReminderEmailTemplate(volunteer)
        )
        .catch((e) => {
          console.error(
            "send volunteerNewOpenRequestsBGCReminder email failed:",
            e
          );
        });
    } else {
      console.log(`
        user ${volunteerId} is not notified about the new request
        because user has not complete BGC after 3 reminder emails
      `);
      return null;
    }
  }
}

function cancelRequest(db, admin, data, context) {
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
  const requestId = data.requestId;

  return db
    .collection("requests")
    .doc(requestId)
    .get()
    .then((requestDoc) => {
      let createdById = requestDoc.data().createdBy;
      if (!(uid === createdById)) {
        throw new functions.https.HttpsError(
          "permission-denied",
          "User does not have the permissions to archive this request."
        );
      }
      return db
        .collection("requests")
        .doc(requestId)
        .update({ status: "closed", outcome: "cancelled" });
    })
    .then(() => {
      console.log("Successfully archived request", requestId);
      return;
    })
    .catch((error) => {
      console.log(`An error occured with request id ${requestId}.`);
      console.error(error);
      return;
    });
}

function cancelHelperFromRequest(db, admin, data, context) {
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
  const requestId = data.requestId;

  let helperId;
  let helperPhone;
  let requesterFirstName;

  return db
    .collection("requests")
    .doc(requestId)
    .get()
    .then((requestDoc) => {
      if (!requestDoc.exists) {
        throw new functions.https.HttpsError(
          "not-found",
          "Request object does not exist."
        );
      }

      if (
        !requestDoc.data().createdBy !== uid &&
        requestDoc.data().requester !== uid
      ) {
        throw new functions.https.HttpsError(
          "permission-denied",
          "You do not have permisison to edit this request."
        );
      }

      requesterFirstName = requestDoc.data().requesterFirstName;
      helperId = requestDoc.data().helper;

      return db.collection("requests").doc(requestId).update({
        status: "open",
        helper: null,
        toBeFulfilledBy: "VOLUNTEER",
        timeAccepted: null,
        markedCompleteBy: null,
      });
    })
    .then((result) => {
      return db.collection("users").doc(helperId).get();
    })
    .then((userDoc) => {
      helperPhone = userDoc.data().phoneNumber;
      return;
    })
    .then(() => {
      // Notify volunteer
      const volunteerMessage = TEXT_requesterCancelledHelper(
        requesterFirstName
      );
      sendText(volunteerMessage, helperPhone);
      return;
    });
}

function closeRequest(db, admin, data, context) {
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
  const requestId = data.requestId;

  var helperId;
  var helperFirstName;
  var helperPhone;
  var helperLang;

  var createdById;
  var creatorFirstName;
  var creatorPhone;
  var creatorLang;

  var requesterId;
  var requesterFirstName;
  var requesterPhone;
  var requesterLang;

  var helperUpdated = false;
  var requesterUpdated = false;

  return db
    .collection("requests")
    .doc(requestId)
    .get()
    .then((requestDoc) => {
      requesterId = requestDoc.data().requester;
      createdById = requestDoc.data().createdBy;
      helperId = requestDoc.data().helper;

      if (!(uid === createdById || uid === helperId)) {
        throw new functions.https.HttpsError(
          "permission-denied",
          "User is not associated with this request"
        );
      }

      if (requestDoc.data().status === "closed") {
        throw new functions.https.HttpsError(
          "permission-denied",
          "This request is already closed."
        );
      }

      return db.collection("users").doc(requesterId).get();
    })
    .then((requesterUserDoc) => {
      requesterFirstName = requesterUserDoc.data().firstName;
      requesterPhone = requesterUserDoc.data().phoneNumber;
      requesterLang = getLanguageFrom(requesterUserDoc.data().languages);

      return db.collection("users").doc(helperId).get();
    })
    .then((helperUserDoc) => {
      helperFirstName = helperUserDoc.data().firstName;
      helperPhone = helperUserDoc.data().phoneNumber;
      helperLang = getLanguageFrom(helperUserDoc.data().languages);

      if (createdById !== requesterId) {
        return db.collection("users").doc(createdById).get();
      }
      return;
    })
    .then((creatorUserDoc) => {
      if (createdById !== requesterId) {
        creatorFirstName = creatorUserDoc.data().firstName;
        creatorPhone = creatorUserDoc.data().phoneNumber;
        creatorLang = getLanguageFrom(creatorUserDoc.data().languages);
      }
      return;
    })
    .then(() => {
      let updateObj = {
        status: "closed",
        timeClosed: new Date(),
        outcome: "completed",
      };

      if (createdById === uid) {
        requesterUpdated = true;
        updateObj.markedCompleteBy = "Requester-Web";
      }
      if (helperId === uid) {
        helperUpdated = true;
        updateObj.markedCompleteBy = "Helper-Web";
      }

      return db.collection("requests").doc(requestId).update(updateObj);
    })
    .then(() => {
      if (helperUpdated) {
        const closeMessage = TEXT_closeTextRequester(helperFirstName);
        return sendText(closeMessage, requesterPhone);
      }
      if (requesterUpdated) {
        const closeMessage = TEXT_closeTextHelper(requesterFirstName);
        return sendText(closeMessage, helperPhone);
      }
      return;
    })
    .then(() => {
      if (createdById !== requesterId) {
        const closeMessage = TEXT_closeTextCreatedBy(
          helperFirstName,
          requesterFirstName
        );
        return sendText(closeMessage, creatorPhone);
      }
      return;
    });
}

function sendThankYouText(db, admin, data, context) {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "User not authenticated."
    );
  }

  const helperPhone = data.helperPhone;
  const requesterFirstName = data.requesterFirstName;
  const requesterThanks = data.requesterThanks;
  const helperLang = getLanguageFrom(data.helperLangs);

  // Lazy initialization
  if (!admin) {
    admin = require("firebase-admin");
    admin.initializeApp();
  }
  db = db || admin.firestore();

  const message = TEXT_thankYou(requesterFirstName, requesterThanks);
  console.log(`Sending thank you text with ${message}`);
  return sendText(message, helperPhone);
}

function hasExceededCancelHelpLimit(db, admin, data, context) {
  // Lazy initialization
  if (!admin) {
    admin = require("firebase-admin");
    admin.initializeApp();
  }
  db = db || admin.firestore();

  return db
    .collection("users")
    .doc(data.userId)
    .get()
    .then((userDoc) => {
      var user = userDoc.data();
      return (
        user.numCancellationsMadeToday >= numHelperCancellationsAllowedPerDay
      );
    });
}

function cancelHelpOffer(db, admin, data, context) {
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

  const requestId = data.requestId;
  var helperFirstName;

  var requesterPhone;
  var requesterLangs;
  var requesterFirstName;

  var creatorPhone;
  var creatorLangs;

  var helperId;
  var requesterId;
  var creatorId;

  return db
    .collection("requests")
    .doc(requestId)
    .get()
    .then((requestDoc) => {
      requesterId = requestDoc.data().requester;
      helperId = requestDoc.data().helper;
      creatorId = requestDoc.data().createdBy;
      return db.collection("users").doc(requesterId).get();
    })
    .then((requesterDoc) => {
      requesterPhone = requesterDoc.data().phoneNumber;
      requesterLangs = requesterDoc.data().languages;
      requesterFirstName = requesterDoc.data().firstName;

      if (creatorId !== requesterId) {
        return db.collection("users").doc(creatorId).get();
      }
      return;
    })
    .then((creatorDoc) => {
      if (creatorId !== requesterId) {
        creatorPhone = creatorDoc.data().phoneNumber;
        creatorLangs = creatorDoc.data().languages;
      }

      return db.collection("users").doc(helperId).get();
    })
    .then((helperDoc) => {
      helperFirstName = helperDoc.data().firstName;

      var numCancellationsMadeToday = helperDoc.data()
        .numCancellationsMadeToday;
      // Edit the user object to increment the number of help requests cancelled in a 24 hour period.
      // Do this asynchronously, so it doesn't slow down the response time.
      var updatedNumCancellations = numCancellationsMadeToday
        ? numCancellationsMadeToday + 1
        : 1;
      db.collection("users").doc(helperId).set(
        {
          numCancellationsMadeToday: updatedNumCancellations,
        },
        { merge: true }
      );

      return db.collection("requests").doc(requestId).set(
        {
          status: "open",
          helper: null,
          toBeFulfilledBy: "VOLUNTEER",
          timeAccepted: null,
        },
        { merge: true }
      );
    })
    .then((result) => {
      console.log("Sending cancellation text");
      const requesterLang = getLanguageFrom(requesterLangs);

      const requesterMessage = TEXT_cancellationTextRequester(helperFirstName);
      return sendText(requesterMessage, requesterPhone);
    })
    .then(() => {
      if (creatorId !== requesterId) {
        console.log("Sending cancellation text");
        const creatorLang = getLanguageFrom(creatorLangs);

        const creatorMessage = TEXT_cancellationTextCreatedBy(
          helperFirstName,
          requesterFirstName
        );
        return sendText(creatorMessage, creatorPhone);
      }
      return;
    });
}

// reusable code used to bucket requests in enterprise console based on how many requests of a particular type have been cancelled/successfully completed etc
function bucketRequestSnapshot(requestsSnapshot) {
  let tripBucketsCount = {};
  let tripBucketsTime = {};

  if (requestsSnapshot.size) {
    requestsSnapshot.forEach((requestDoc) => {
      if (requestDoc.exists) {
        let request = requestDoc.data();
        if (request.uberStatus) {
          let count = tripBucketsCount[request.uberStatus] || 0;
          tripBucketsCount[request.uberStatus] = count + 1;
          let time = tripBucketsTime[request.uberStatus] || 0;
          if (request.timeCreated && request.timeCreated > time) {
            tripBucketsTime[request.uberStatus] = request.timeCreated;
          }
        }
      }
    });
  }
  let tripsInfo = [];
  for (const key in tripBucketsCount) {
    tripsInfo.push({
      status: key,
      count: tripBucketsCount[key],
      mostRecentTime: tripBucketsTime[key],
    });
  }

  return {
    totalTrips: requestsSnapshot.size,
    tripsInfo,
  };
}

function requestsByStatus(db, requestStatus, { helperUid, requestorUid }) {
  /**
   * @param {string} uid user id
   * @param {string} requestStatus One of "open", "pending_fulfilment", "closed"
   * @return {[requests]}
   */
  let requests = db.collection("requests").where("status", "==", requestStatus);

  if (helperUid !== undefined) {
    requests = requests.where("helper", "==", helperUid);
  }

  if (requestorUid !== undefined) {
    requests = requests.where("requestor", "==", requestorUid);
  }

  return requests.get().then((qs) => {
    var requests = [];
    qs.forEach((doc) => {
      requests.push(doc);
    });
    return requests;
  });
}

function openRequestsAtGeohash(db, targetGeohash, distance, limit) {
  /**
   * @param {string} targetGeohash
   * @param {int} distance distance around target in square miles radius
   * @return {[requests]}
   */
  const { geohashSearchParams } = require("./../geo");
  const geohashParams = geohashSearchParams(targetGeohash, distance);

  if (limit === undefined || limit === null) {
    limit = 10; // always pass in some limit
  }

  return db
    .collection("requests")
    .where("status", "==", "open")
    .where("geohash", ">=", geohashParams.bottomLeft)
    .where("geohash", "<=", geohashParams.topRight)
    .limit(limit)
    .get()
    .then((qs) => {
      var requests = [];
      qs.forEach((doc) => {
        requests.push(doc);
      });
      return requests;
    });
}

function createNewRequestFrom(request) {
  return {
    aboutUser: request.aboutUser,
    closingVerifiedTextTimeSent: null,
    createdBy: request.createdBy,
    organizationId: request.organizationId || null,
    geohash: request.geohash,
    helper: request.helper || null,
    languages: request.languages || null,
    needs: request.needs,
    notificationTimes: request.notificationTimes || {},
    reminderTextTimeSent: request.reminderTextTimeSent || null,
    requester: request.requester,
    requesterFirstName: request.requesterFirstName,
    status: "open",
    supplier: request.supplier || null,
    timeAccepted: null,
    timeClosed: null,
    timeCreated: new Date(),
    toBeFulfilledBy: request.toBeFulfilledBy,
    zipCode: request.zipCode || null,
  };
}

module.exports = {
  loadRequestData,
  loadRequestDataFromDocs,
  createRequest,
  acceptRequest,
  bucketRequestSnapshot,
  cancelRequest,
  cancelHelperFromRequest,
  cancelHelpOffer,
  hasExceededCancelHelpLimit,
  closeRequest,
  sendThankYouText,
  openRequestsAtGeohash,
  requestsByStatus,
  createNewRequestFrom,
};
