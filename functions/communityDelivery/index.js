/* eslint-disable promise/no-nesting */
var functions = require("firebase-functions");
var {
  verifyUserCanEditOrg,
  queryOrganizationRequests,
} = require("../organizations");
const geolib = require("geolib");
var { geohashQueries } = require("../utils");
var { defaultPassword } = require("./../utils");
var { loadRequestData } = require("./../requests");
var {
  sendText,
  TEXT_communityDeliveryReminder,
  TEXT_communityDeliverySignUpConfirmation,
} = require("../notifications");
const {
  communitySignUpConfirmationEmailTemplate,
  communityReminderEmailTemplate,
  byovWelcomeEmailTemplate,
  NOREPLY_ADDRESS,
} = require("./../notifications/email_templates");
const { querySupplierTimeZone } = require("../suppliers");
const geohash = require("ngeohash");
const email = require("./../notifications/email");
const moment = require("moment-timezone");

const communityEventDurationHours = 3;
const NUM_RECIPIENTS_PER_VOLUNTEER_DEFAULT = 5;

const fetch = require("node-fetch");
const bitlyAccessToken = functions.config().bitly.access_token;
const BITLY_BASE_URL = "https://api-ssl.bitly.com";
const BITLY_GROUPS_ENDPOINT = BITLY_BASE_URL + "/v4/groups";
const BITLY_SHORTEN_ENDPOINT = BITLY_BASE_URL + "/v4/shorten";

async function checkToRemindVolunteers(db, context) {
  const secsInOneDay = 24 * 60 * 60;
  const eventSnapshots = await db.collection("community_events").get();
  let eventsToRemind = {};

  eventSnapshots.forEach((snapshot) => {
    const event = snapshot.data();
    const timeDiff = event.eventTime._seconds - Math.floor(Date.now() / 1000);
    if (event.hasRemindedVolunteers === false && timeDiff < secsInOneDay) {
      eventsToRemind[snapshot.id] = event.volunteers;
      db.collection("community_events")
        .doc(snapshot.id)
        .update({ hasRemindedVolunteers: true });
    }
  });

  for (const [eventID, volunteers] of Object.entries(eventsToRemind)) {
    volunteers.forEach((volunteerID) => {
      sendConfirmationOrReminder(
        db,
        volunteerID,
        eventID,
        true,
        false,
        context
      );
    });
  }
}

async function sendConfirmationOrReminder(
  db,
  uid,
  eventID,
  toRemind = false,
  isBYOVWelcomeEmail = false,
  context
) {
  try {
    // Note (kelsey, 07/29/2021):
    // just incase the arguments were not passed correctly, we
    // check if the isBYOVWelcomeEmail is actually a boolean.
    // if not a boolean, then we default it to false, because
    // we don't to send the email with the login credentials
    // unintentionally in the case when the function was called
    // without this param.
    if (typeof isBYOVWelcomeEmail !== "boolean") {
      isBYOVWelcomeEmail = false;
    }
    const eventSnapshot = await db
      .collection("community_events")
      .doc(eventID)
      .get();
    const userSnapshot = await db.collection("users").doc(uid).get();
    const orgSnapshot = await db
      .collection("organizations")
      .doc(eventSnapshot.data().organizationID)
      .get();
    const supplierSnapshot = await db
      .collection("suppliers")
      .doc(eventSnapshot.data().supplierID)
      .get();

    let timeZoneId = "";
    if (!supplierSnapshot.data().timeZone) {
      const coordinates = geohash.decode(supplierSnapshot.data().geohash);
      const res = await querySupplierTimeZone(
        db,
        {
          latitude: coordinates.latitude,
          longitude: coordinates.longitude,
          supplierId: supplierSnapshot.id,
          timestamp: eventSnapshot.data().eventTime._seconds,
        },
        context
      );
      timeZoneId = res;
    } else {
      timeZoneId = supplierSnapshot.data().timeZone;
    }

    let localTime = moment
      .tz(eventSnapshot.data().eventTime._seconds * 1000, timeZoneId)
      .format("dddd, MMMM Do YYYY, h:mm a");

    const emailTemplate = toRemind
      ? communityReminderEmailTemplate
      : communitySignUpConfirmationEmailTemplate;
    const textTemplate = toRemind
      ? TEXT_communityDeliveryReminder
      : TEXT_communityDeliverySignUpConfirmation;
    const notificationType = toRemind ? "reminder" : "signup-confirmation";

    // if this is a new BYOV user welcome email
    // then we only want to send the BYOV welcome email with the
    // event details and the email/password
    if (isBYOVWelcomeEmail) {
      try {
        email.send(
          db,
          uid,
          userSnapshot.data().email,
          NOREPLY_ADDRESS,
          byovWelcomeEmailTemplate(
            userSnapshot.data(),
            supplierSnapshot.data(),
            localTime,
            defaultPassword
          )
        );
      } catch (e) {
        console.log(
          `Error sending CD ${notificationType} email to user ${uid}`,
          e
        );
      }
    }

    // otherwise, if this is the regular flow, then proceed with the regular
    // email+SMS confirmation/reminder
    else {
      try {
        email.send(
          db,
          uid,
          userSnapshot.data().email,
          NOREPLY_ADDRESS,
          emailTemplate(
            userSnapshot.data(),
            orgSnapshot.data(),
            supplierSnapshot.data(),
            localTime
          )
        );
      } catch (e) {
        console.log(
          `Error sending CD ${notificationType} email to user ${uid}`,
          e
        );
      }

      try {
        sendText(textTemplate(localTime), userSnapshot.data().phoneNumber);
      } catch (e) {
        console.log(
          `Error sending CD ${notificationType} text to user ${uid}`,
          e
        );
      }
    }
  } catch (e) {
    console.log(`
        Error executing sendConfirmationOrReminder: ${e}\n
        uid: ${uid}\n
        eventId: ${eventID}
      `);
  }
}

// USER CALLABLE
function createCommunityDeliveryEvent(db, admin, data, context) {
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

  // Check in will not be allowed after this time
  const eventDurationMs = communityEventDurationHours * 3600000;
  data.eventTimeEnd = new Date(data.eventTime + eventDurationMs);
  // Check in will be allowed after this time
  data.eventTime = new Date(data.eventTime);
  data.timeCreated = new Date(data.timeCreated);
  data.timeUpdated = new Date(data.timeUpdated);
  data.hasRemindedVolunteers = false;
  data.volunteers = [];
  // Note (kelsey, 10/26/2021): if we don't receive a value for the new
  // field recipientsPerVolunteer, then we update the data with the
  // default value when we create the CD event.
  if (!data.recipientsPerVolunteer) {
    data.recipientsPerVolunteer = NUM_RECIPIENTS_PER_VOLUNTEER_DEFAULT;
  }

  const work = async () => {
    await verifyUserCanEditOrg(db, context, data.organizationID);

    return db
      .collection("suppliers")
      .doc(data.supplierID)
      .get()
      .then((snapshot) => {
        data.geohash = snapshot.data().geohash;
        return db.collection("community_events").add(data);
      });
  };

  return Promise.resolve(work());
}

function editCommunityDeliveryEvent(db, admin, data, context) {
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

  // Check in will not be allowed after this time
  const eventDurationMs = communityEventDurationHours * 3600000;
  data.eventTimeEnd = new Date(data.eventTime + eventDurationMs);
  // Check in will be allowed after this time
  data.eventTime = new Date(data.eventTime);
  data.timeUpdated = new Date(data.timeUpdated);

  return db
    .collection("community_events")
    .doc(data.communityEvent)
    .get()
    .then((snapshot) => {
      return verifyUserCanEditOrg(db, context, snapshot.data().organizationID);
    })
    .then(() => {
      return db.collection("suppliers").doc(data.supplierID).get();
    })
    .then((snapshot) => {
      return db
        .collection("community_events")
        .doc(data.communityEvent)
        .update({
          geohash: snapshot.data().geohash,
          eventName: data.eventName,
          orgDescription: data.orgDescription,
          eventTime: data.eventTime,
          eventTimeEnd: data.eventTimeEnd,
          timeUpdated: data.timeUpdated,
          phoneNumber: data.phoneNumber,
          phoneNumberExtension: data.phoneNumberExtension,
          maxVolunteers: parseInt(data.maxVolunteers),
          recipientsPerVolunteer: parseInt(data.recipientsPerVolunteer),
          supplierID: data.supplierID,
        });
    });
}

/*
 * This function is for the BYOV project, where the partner uploads
 * a list of volunteers, and assigns them to an existing CD event.
 * They do not require an HHC background check at this point, but must
 * have been created as role=VOLUNTEER in the user_organizations collection
 */
async function signUpPartnerVolunteerForCommunityDeliveryEvent(
  db,
  admin,
  data,
  context
) {
  console.log(
    "signUpPartnerVolunteerForCommunityDeliveryEvent with data:",
    data
  );
  // Lazy initialization
  if (!admin) {
    admin = require("firebase-admin");
    admin.initializeApp();
  }
  db = db || admin.firestore();

  const userId = data.userId;
  const eventId = data.eventId;
  const isNewUser = data.isNewUser;
  const now = new Date();

  try {
    // get the event
    const eventRef = db.collection("community_events").doc(eventId);
    const eventFetch = await eventRef.get();
    const eventData = eventFetch.data();

    // if the event data is empty, throw an error

    if (typeof eventData === "undefined" || typeof userId === "undefined") {
      console.log(
        `signUpPartnerVolunteerForCommunityDelivery failed with userId ${userId} and eventId ${eventId}`
      );
      throw new functions.https.HttpsError(
        "invalid-argument",
        "userId must be supplied and eventId must refer to valid event"
      );
    }

    // fetch the org ID
    const organizationId = eventData.organizationID;

    // TODO: add this query back in. right now, we are skipping this user org
    // check but need to validate that first.
    /*
    // first check if the user has access
    let docRef = db
    .collection("user_organizations")
    //.where("organizationID", "==", organizationId)
    //.where("userId", "==", userId)
    .where("role", "==", "VOLUNTEER");

     //var docRef = db.collection("cities").select("id").where("id", "==", "SF");


    // confirm user is a volunteer member of this event's organization
     docRef.get().then(function(doc) {
         if (!doc.empty) {
             console.log("Document data:", doc[0].data());
         } else {
             console.log("No such document! ... throwing error");
             throw new functions.https.HttpsError(
              "permission-denied",
              "User must be a volunteer member of the event's organization before they can be added to the event"
            );
         }
     }).catch(function(error) {
         console.log("Error getting document:", error);
     });
     */

    const volunteerRef = db
      .collection("community_events")
      .doc(eventId)
      .collection("volunteers")
      .doc(userId);

    await db.runTransaction(async (transaction) => {
      eventSnapshot = await transaction.get(eventRef);
      let volunteers = eventSnapshot.data().volunteers;
      // Note: we bypass the max count for this flow to allow for additional
      // partner volunteer members.
      if (eventSnapshot.data().eventTime.seconds * 1000 > now.getTime()) {
        // if the volunteer already exists, we don't need to re-add them,
        // but we also don't want to error in this case
        if (!volunteers.includes(userId)) {
          volunteers.push(userId);
          await transaction.update(eventRef, { volunteers: volunteers });
          await transaction.set(volunteerRef, {
            volunteerID: userId,
            checkedIn: false,
            assignedRequests: [],
          });
        } else {
          console.log(
            "volunteer with userId",
            userId,
            "is already signed up. no need to re-add."
          );
        }
      } else {
        const errorMessage =
          "Possible reasons of failure:\n" + "- event has already started \n";
        throw new functions.https.HttpsError(
          "permission-denied",
          errorMessage,
          (details = { label: "limit-exceeded" })
        );
      }
    });

    // Note: this function sends the confirmation email for existing
    // users, or the BYOV welcome email (with email/password) for new
    // BYOV users. we rely on the client passing that through correctly.
    sendConfirmationOrReminder(db, userId, eventId, false, isNewUser, context);
    return "Success";
  } catch (e) {
    console.log(
      "signUpPartnerVolunteerForCommunityDelivery: Community Delivery Partner Volunteer sign-up failure with data:",
      data,
      "error:",
      e
    );
    throw e;
  }
}

async function signUpForCommunityDeliveryEvent(db, admin, data, context) {
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

  const uid = context.auth.token.user_id;
  const eventID = data.eventID;
  const now = new Date();

  try {
    const userSnapshot = await db.collection("users").doc(uid).get();
    if (userSnapshot.data().checkrVerified === false) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "You must complete your background check before accepting requests.",
        (details = { label: "limit-exceeded" })
      );
    }

    const eventRef = db.collection("community_events").doc(eventID);
    const volunteerRef = db
      .collection("community_events")
      .doc(eventID)
      .collection("volunteers")
      .doc(uid);

    await db.runTransaction(async (transaction) => {
      eventSnapshot = await transaction.get(eventRef);
      let volunteers = eventSnapshot.data().volunteers;
      if (
        !volunteers.includes(uid) &&
        eventSnapshot.data().eventTime.seconds * 1000 > now.getTime() &&
        volunteers.length < eventSnapshot.data().maxVolunteers
      ) {
        volunteers.push(uid);
        await transaction.update(eventRef, { volunteers: volunteers });
        await transaction.set(volunteerRef, {
          volunteerID: uid,
          checkedIn: false,
          assignedRequests: [],
        });
      } else {
        const errorMessage =
          "Possible reasons of failure:\n" +
          "- event's max volunteer limit is reached\n" +
          "- event has already started \n" +
          "- volunteer has already signed up for this event";
        throw new functions.https.HttpsError(
          "permission-denied",
          errorMessage,
          (details = { label: "limit-exceeded" })
        );
      }
    });

    sendConfirmationOrReminder(db, uid, eventID, false, false, context);
    return "Success";
  } catch (e) {
    console.log("Community Delivery sign-up failure:", e);
    return "Error signing user up";
  }
}

function leaveCommunityDeliveryEvent(db, admin, data, context) {
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

  const uid = context.auth.token.user_id;
  const eventID = data.eventID;
  const now = new Date();

  let newVolunteerArray = [];

  return db
    .collection("community_events")
    .doc(eventID)
    .get()
    .then((snapshot) => {
      if (snapshot.data().checkedIn) {
        throw new functions.https.HttpsError(
          "unavailable",
          "can not leave event, already checked in"
        );
      }

      var eventDocRef = db.collection("community_events").doc(eventID);
      var volunteerDocRef = db
        .collection("community_events")
        .doc(eventID)
        .collection("volunteers")
        .doc(uid);

      return db.runTransaction(function (transaction) {
        return transaction.get(eventDocRef).then(function (eventDoc) {
          newVolunteerArray = eventDoc.data().volunteers;
          var index = newVolunteerArray.indexOf(uid);
          newVolunteerArray.splice(index, 1);

          transaction.update(eventDocRef, {
            volunteers: newVolunteerArray,
            timeUpdated: now,
          });

          transaction.delete(volunteerDocRef);

          return;
        });
      });
    });
}

function unassignCommunityDelivery(db, admin, data, context) {
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

  if (!(context.auth.token.admin || data.consoleType === "partner")) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "User not authenticated."
    );
  }

  const uid = context.auth.token.user_id;
  const eventID = data.eventID;
  const volunteer = data.volunteer;
  const requestID = data.requestID;
  const now = new Date();

  let volunteerData = {};

  return db
    .collection("community_events")
    .doc(eventID)
    .get()
    .then((snapshot) => {
      if (snapshot.data().checkedIn) {
        throw new functions.https.HttpsError(
          "unavailable",
          "can not leave event, already checked in"
        );
      }

      var eventDocRef = db.collection("community_events").doc(eventID);
      var volunteerDocRef = db
        .collection("community_events")
        .doc(eventID)
        .collection("volunteers")
        .doc(volunteer);
      var requestDocRef = db.collection("requests").doc(requestID);

      return db.runTransaction(function (transaction) {
        return transaction
          .get(volunteerDocRef)
          .then(function (volunteerDoc) {
            volunteerData = volunteerDoc.data();

            return transaction.get(requestDocRef);
          })
          .then((requestToPutBack) => {
            transaction.update(eventDocRef, {
              timeUpdated: now,
            });

            newDeliveryArray = volunteerData.assignedRequests;
            var index = newDeliveryArray.indexOf(requestID);
            newDeliveryArray.splice(index, 1);

            transaction.update(volunteerDocRef, {
              assignedRequests: newDeliveryArray,
            });

            oldProvider = requestToPutBack.data().previousProvider;

            // Put request back into the uber queue
            transaction.update(requestDocRef, {
              helper: null,
              status: "open",
              toBeFulfilledBy: oldProvider ? oldProvider : "UBER",
              uberStatus: "TO_BE_SCHEDULED",
              scheduledPickupTime: now.getTime() + 300000,
            });

            return;
          });
      });
    });
}

function checkIntoCommunityDeliveryEvent(db, admin, data, context) {
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

  const uid = context.auth.token.user_id;
  const eventID = data.eventID;
  const now = new Date();

  const windowInHours = 24;

  let eventInfo = {};
  let newAssignedRequests = [];
  let orderedAssignedRequests = [];

  let loadedUberRequests = [];
  let loadedLyftRequests = [];

  let user = {};
  let requesterText = "";
  let url = "";

  var eventDocRef = db.collection("community_events").doc(eventID);
  var eventVolunteersRef = db
    .collection("community_events")
    .doc(eventID)
    .collection("volunteers");
  var volunteerDocRef = db
    .collection("community_events")
    .doc(eventID)
    .collection("volunteers")
    .doc(uid);

  // Here we are creating a transaction so that the assigned requests to one user does not overlap with the assigned requests of another
  return db
    .runTransaction(function (transaction) {
      return transaction
        .get(volunteerDocRef)
        .then(function (volunteerSnapshot) {
          // check if the volunteer has already checked in (gone through this transaction already)
          if (volunteerSnapshot.data().checkedIn) {
            throw new functions.https.HttpsError(
              "unavailable",
              "already checked in"
            );
          }
          return transaction.get(eventDocRef);
        })
        .then(function (eventDoc) {
          eventInfo = eventDoc.data();

          // If the event has not started, don't continue
          if (
            !(
              eventInfo.eventTime.seconds * 1000 < now.getTime() &&
              eventInfo.eventTimeEnd.seconds * 1000 > now.getTime()
            )
          ) {
            throw new functions.https.HttpsError(
              "unavailable",
              "event unable to be checked into at this time"
            );
          }

          // gather the requests that are elligible to be assigned
          var requestPoolRef = db
            .collection("requests")
            .where("organizationId", "==", eventInfo.organizationID)
            .where("supplier", "==", eventInfo.supplierID)
            .where("toBeFulfilledBy", "==", "UBER")
            .where("uberStatus", "==", "TO_BE_SCHEDULED")
            .where("scheduledPickupTime", ">=", now.getTime())
            .orderBy("scheduledPickupTime", "desc")
            .limit(eventInfo.recipientsPerVolunteer);

          return transaction.get(requestPoolRef);
        })
        .then((loadedRequests) => {
          loadedUberRequests = loadedRequests;

          // Doing this for now because the lyft assignment is different than the uber one
          // Our Uber assignment code runs every 5 minutes and looks for rides that had scheduledPickupTimes in the PAST 5 minutes and schedules them
          // Our Lyft assignmennt code runs every 5 minutes and looks for rides that have scheduledPickupTimes in the NEXT 10 minutes and schedules them
          // We should standardize this
          lyftDate = new Date(now.getTime() + 10 * 60000);

          var requestPoolRefLyft = db
            .collection("requests")
            .where("organizationId", "==", eventInfo.organizationID)
            .where("supplier", "==", eventInfo.supplierID)
            .where("toBeFulfilledBy", "==", "LYFT")
            .where("status", "in", ["open", "asap_fulfillment"])
            .where("scheduledPickupTime", ">=", lyftDate.getTime())
            .orderBy("scheduledPickupTime", "desc")
            .limit(eventInfo.recipientsPerVolunteer);

          return transaction.get(requestPoolRefLyft);
        })
        .then((loadedRequests) => {
          loadedLyftRequests = loadedRequests;

          assignedRequestObjects = {};
          let recipientsPerVolunteer = eventInfo.recipientsPerVolunteer;

          // Fill an array with requests up to limit specified by recipientsPerVolunteer that are within a time hour window
          // TODO: optimization clustering

          // Uber
          loadedUberRequests.forEach((request) => {
            if (
              newAssignedRequests.length < recipientsPerVolunteer &&
              request.data().scheduledPickupTime <
                now.getTime() + windowInHours * 60 * 60 * 1000
            ) {
              newAssignedRequests.push(request.id);
              assignedRequestObjects[request.id] = request.data();
            }
          });

          // Lyft
          loadedLyftRequests.forEach((request) => {
            if (
              newAssignedRequests.length < recipientsPerVolunteer &&
              request.data().scheduledPickupTime <
                now.getTime() + windowInHours * 60 * 60 * 1000
            ) {
              newAssignedRequests.push(request.id);
              assignedRequestObjects[request.id] = request.data();
            }
          });

          if (newAssignedRequests.length > 0) {
            // Assign requests to the volunteer
            transaction.update(eventDocRef, {
              timeUpdated: new Date(),
            });

            transaction.update(volunteerDocRef, {
              assignedRequests: newAssignedRequests,
              checkedIn: true,
              timeUpdated: new Date(),
            });

            console.log(assignedRequestObjects);

            // For each request that was just assigned, update these fields
            newAssignedRequests.forEach((requestID) => {
              transaction.update(db.collection("requests").doc(requestID), {
                toBeFulfilledBy: "COMMUNITY_VOLUNTEER",
                uberStatus: "N/A",
                lyftStatus: "N/A",
                previousProvider:
                  assignedRequestObjects[requestID].toBeFulfilledBy,
                helper: uid,
                status: "assigned",
              });
            });
          } else {
            throw new functions.https.HttpsError(
              "unavailable",
              "There are no requests available to be assigned to you at this time."
            );
          }

          return;
        });
    })
    .then(() => {
      return db.collection("users").doc(uid).get();
    })
    .then((userSnapshot) => {
      user = userSnapshot.data();

      // Get each request that was assigned
      let promises = [];
      newAssignedRequests.forEach((requestID) => {
        promises.push(db.collection("requests").doc(requestID).get());
      });
      return Promise.all(promises);
    })
    .then((requests) => {
      // For each request gotten, get the associated requester account
      let promises = [];
      requests.forEach((request) => {
        promises.push(
          db.collection("users").doc(request.data().requester).get()
        );
      });
      return Promise.all(promises);
    })
    .then((requesterSnapshots) => {
      const supplierID = eventInfo.supplierID;
      let supplierSnapshot = db.collection("suppliers").doc(supplierID).get();
      return supplierSnapshot.then((supplierData) => {
        var supplierLocationDetails = supplierData.data();

        return generateGoogleMapsRoute({
          supplierLocationDetails: supplierLocationDetails,
          requesterSnapshots: requesterSnapshots,
        }).then((response) => {
          let orderedStops = response.orderedStops; // index of requesterSnapshot for each stop in optimized order
          // e.g. index 0 of orderedStops is the first stop on the route.
          // The number at index 0 is the index of the first stop recipient in reqeusterSnapshots

          for (i = 0; i < orderedStops.length; i++) {
            // if the last name is not empty, just use the first initial of the last name
            var requesterLastNameInitial =
              requesterSnapshots[orderedStops[i]].data().lastName.length > 0
                ? requesterSnapshots[orderedStops[i]].data().lastName[0]
                : "";
            requesterText += `${i + 1}. ${
              requesterSnapshots[orderedStops[i]].data().firstName
            } ${requesterLastNameInitial} - ${
              requesterSnapshots[orderedStops[i]].data().phoneNumber
            }\n`;
            // update the order of requests per optimization
            orderedAssignedRequests.push(newAssignedRequests[orderedStops[i]]);
          }

          return getShortUrl(response.url);
        });
      });
    })
    .then((shortUrl) => {
      url = shortUrl;
      // write that link
      // update order of assignedRequests so that list of recipients displays in routes delivery order
      return db
        .collection("community_events")
        .doc(eventID)
        .collection("volunteers")
        .doc(uid)
        .update({
          routeLink: url,
          assignedRequests: orderedAssignedRequests,
        });
    })
    .then(() => {
      // Text volunteer route link
      return sendText(
        `Thanks for volunteering! Here are your routes: ${url}`,
        user.phoneNumber
      );
    })
    .then(() => {
      // Text volunteer requester's names and phoneNumber
      return sendText(
        `Here's who you're delivering to: \n ${requesterText}`,
        user.phoneNumber
      );
    })
    .catch((e) => {
      if (!(e.message === "password is required")) {
        throw new functions.https.HttpsError(
          "permission-denied",
          e.message,
          (details = { label: "limit-exceeded" })
        );
      }
    });
}

async function getCommunityDeliveryEventDetailsForOrg(
  db,
  admin,
  data,
  context
) {
  const orgId = data.orgId;

  if (!orgId) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Invalid request: must supply orgId."
    );
  }

  let eventSnapshot = await db
    .collection("community_events")
    .where("organizationID", "==", orgId)
    .get();

  var events = [];

  await Promise.all(
    eventSnapshot.docs.map(async (snapshot) => {
      let event = snapshot.data();
      event.id = snapshot.id;

      let supplierDoc = await db
        .collection("suppliers")
        .doc(snapshot.data().supplierID)
        .get();

      event.supplier = supplierDoc.data();
      event.supplier.id = supplierDoc.id;
      events.push(event);
    })
  );
  return events;
}

async function generateGoogleMapsRoute(data) {
  // sometimes the lat/lng are undefined, so we will generate them
  // from the geohash
  const originGeohash = data.supplierLocationDetails.geohash;
  const originCoordinates = geohash.decode(originGeohash);
  let originAddress = data.supplierLocationDetails.address;

  // if the address has not been saved on this supplier location,
  // we will generate it here from the other fields street, city, state
  if (typeof originAddress === "undefined") {
    // TODO: fill in the apartment too? is that ever set on suppliers?
    originAddress =
      data.supplierLocationDetails.street +
      ", " +
      data.supplierLocationDetails.city +
      ", " +
      data.supplierLocationDetails.state;
  }
  let originLat = originCoordinates.latitude;
  let originLng = originCoordinates.longitude;
  let requesterSnapshots = data.requesterSnapshots;
  let orderedStops = []; // index of snapshots in order of optimized delivery
  let waypoints = [];
  let waypointsString = "";
  let destinationPlaceId = "";
  let destination = "";
  let encodedDestination = "";
  let url = "";

  // first order the waypoints by their distance from origin
  // then pick the destination as the largest value
  let distances = [];

  for (i = 0; i < requesterSnapshots.length; i++) {
    // Note that the lat/lng don't always exist for the user, because
    // they get added later along with address, for lyft rides
    // so instead we use the geohash, and compute the lat/lng from that
    // so that we can be consistent across all users, until we have
    // those fields populated on every record.

    // get the distance to another trip
    const coordinates = geohash.decode(requesterSnapshots[i].data().geohash);

    let waypointLat = coordinates.latitude;
    let waypointLng = coordinates.longitude;
    const distance = geolib.getDistance(
      {
        latitude: originLat,
        longitude: originLng,
      },
      {
        latitude: waypointLat,
        longitude: waypointLng,
      }
    );
    distances.push(distance);
  }

  // get the index of the longest distance
  // note: there is probably a more efficient way to do this,
  // just piecing it together for now for prototype
  let longestDistanceValue = Math.max.apply(null, distances);
  let longestDistanceIndex = distances.indexOf(longestDistanceValue);
  destinationPlaceId = requesterSnapshots[longestDistanceIndex].data().placeId;
  destination =
    requesterSnapshots[longestDistanceIndex].data().street +
    " " +
    requesterSnapshots[longestDistanceIndex].data().city;
  encodedDestination = encodeURIComponent(destination);

  // now iterate through all the points, and if the index
  // is NOT the destination, add to waypoints
  let waypointIndexes = [];
  for (i = 0; i < requesterSnapshots.length; i++) {
    if (i !== longestDistanceIndex) {
      waypointIndexes.push({ originalIndex: i });
      var tempString =
        requesterSnapshots[i].data().street +
        " " +
        requesterSnapshots[i].data().city;
      // use this if testing function directly:
      // var tempString =
      //   requesterSnapshots[i].street + " " + requesterSnapshots[i].city;
      tempString = tempString.replace(/\s\s+/g, " ");
      waypoints.push(tempString);
      waypointsString += encodeURIComponent(tempString);
      // except with last waypoint, add encoded | after encoded address string
      if (i !== requesterSnapshots.length - 1) {
        waypointsString += "%7C";
      }
    }
  }

  // if only one destination, and no waypoints, return destination url only
  url = `https://www.google.com/maps/dir/?api=1&destination=${encodedDestination}&travelmode=driving&destination_place_id=${destinationPlaceId}`;

  if (waypoints.length === 0) {
    console.log(
      "generateGoogleMapsRoute returning early because waypoints length is 0. No need for further optimization for URL: ",
      url
    );
    orderedStops.push(longestDistanceIndex);
    return {
      url: url,
      orderedStops: orderedStops,
    };
  }

  // if only one stop/waypoint, no need to optimize, so return url immediately
  // with the 1 waypoint and the 1 destination
  if (waypoints.length === 1) {
    url = `https://www.google.com/maps/dir/?api=1&destination=${encodedDestination}&travelmode=driving&destination_place_id=${destinationPlaceId}&waypoints=${waypointsString}`;
    console.log(
      "generateGoogleMapsRoute returning early because waypoints length is 1. No need for further optimization for URL: ",
      url
    );
    orderedStops.push(waypointIndexes[0].originalIndex);
    orderedStops.push(longestDistanceIndex);

    return {
      url: url,
      orderedStops: orderedStops,
    };
  }
  // otherwise there are multiple stops, and we need to optimize the route
  if (waypoints.length > 1) {
    await getOptimizedWaypointOrder({
      origin: originAddress,
      waypoints: waypoints,
      optimizedDestination: destination,
    })
      .catch((error) => {
        console.log("getOptimizedWaypointOrder error: ", error);
        return error;
      })
      .then((response) => {
        if (response.status === "success") {
          let optimizedWaypointOrder = response.data.waypoint_order; // example response format: [3, 2, 0, 1]
          let orderedWaypointsString = "";

          for (i = 0; i < optimizedWaypointOrder.length; i++) {
            orderedStops.push(
              waypointIndexes[optimizedWaypointOrder[i]].originalIndex
            );
            orderedWaypointsString += encodeURIComponent(
              waypoints[optimizedWaypointOrder[i]]
            );
            if (i !== optimizedWaypointOrder.length - 1) {
              orderedWaypointsString += "%7C";
            }
          }
          orderedStops.push(longestDistanceIndex);
          url = `https://www.google.com/maps/dir/?api=1&destination=${encodedDestination}&travelmode=driving&destination_place_id=${destinationPlaceId}&waypoints=${orderedWaypointsString}`;
          console.log("generateGoogleMapsRoute returning optimized url:", url);
          return url;
        } else {
          // use unoptimized waypoint order as fallback
          url = `https://www.google.com/maps/dir/?api=1&destination=${encodedDestination}&travelmode=driving&destination_place_id=${destinationPlaceId}&waypoints=${waypointsString}`;
          console.log(
            "generateGoogleMapsRoute had an error optimizing the route (see error earlier in the logs), returning non-optimized url:",
            url
          );
          for (i = 0; i < waypointIndexes.length; i++) {
            orderedStops.push(waypointIndexes[i].originalIndex);
          }
          orderedStops.push(longestDistanceIndex);
          return url;
        }
      });
  }
  return {
    url: url,
    orderedStops: orderedStops,
  };
}

async function getOptimizedWaypointOrder(data, googleMaps, googleMapsClient) {
  googleMaps = googleMaps || require("@googlemaps/google-maps-services-js");
  googleMapsClient = googleMapsClient || new googleMaps.Client({});

  if (!data.origin) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Invalid request: must supply origin."
    );
  }

  // travel mode defaults to driving if not included in params
  try {
    const params = {
      origin: data.origin,
      destination: data.optimizedDestination,
      waypoints: ["optimize:true", ...data.waypoints], // note: this format isn't well-documented, if optimization fails, check if this param format has changed
      key: functions.config().googlegeocodeapi.key,
    };

    var r = await googleMapsClient
      .directions({
        params: params,
        timeout: 1000, //milliseconds
      })
      .catch((e) => {
        console.log(`Sending response to client: 500 ${e}`);
      });

    if (r.data.error_message) {
      console.error(
        `error hitting the google maps directions API: ${r.data.error_message}`
      );
      throw new functions.https.HttpsError(
        "unavailable",
        "error optimizing route"
      );
    }

    var result = r.data;

    return {
      status: "success",
      data: {
        waypoint_order: result.routes[0].waypoint_order,
      },
    };
  } catch (err) {
    throw new functions.https.HttpsError("invalid-argument", err.message);
  }
}

function getShortUrl(longUrl) {
  return getBitlyGroupGuid().then((groupGuid) => {
    return createShortLink(groupGuid, longUrl);
  });
}

function getBitlyGroupGuid() {
  return fetch(BITLY_GROUPS_ENDPOINT, {
    headers: {
      Authorization: "Bearer " + bitlyAccessToken,
      "Content-Type": "application/json",
    },
    method: "GET",
  })
    .then((res) => res.json())
    .then((json) => json.groups[0].guid);
}

function createShortLink(groupGuid, longUrl) {
  const body = JSON.stringify({
    group_guid: groupGuid,
    domain: "bit.ly",
    long_url: longUrl,
  });
  return fetch(BITLY_SHORTEN_ENDPOINT, {
    headers: {
      Authorization: "Bearer " + bitlyAccessToken,
      "Content-Type": "application/json",
    },
    body: body,
    method: "POST",
  })
    .then((res) => res.json())
    .then((json) => json.link);
}

module.exports = {
  createCommunityDeliveryEvent,
  editCommunityDeliveryEvent,
  signUpForCommunityDeliveryEvent,
  signUpPartnerVolunteerForCommunityDeliveryEvent,
  leaveCommunityDeliveryEvent,
  unassignCommunityDelivery,
  getCommunityDeliveryEventDetailsForOrg,
  checkIntoCommunityDeliveryEvent,
  checkToRemindVolunteers,
  generateGoogleMapsRoute,
  getOptimizedWaypointOrder,
};
