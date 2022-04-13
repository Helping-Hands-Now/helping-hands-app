/* eslint-disable promise/no-nesting */
var functions = require("firebase-functions");
var { sendText, TEXT_requesterCancelledHelper } = require("../notifications");
var { checkExistingOrgVolunteer } = require("../user");
var { getE164PhoneNumber, defaultPassword } = require("./../utils");
const moment = require("moment");

function verifyAdmin(db, admin, context) {
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
  return db, admin;
}

async function verifyUserCanEditOrg(db, context, orgId) {
  let querySnapshot = await db
    .collection("user_organizations")
    .where("userId", "==", context.auth.token.user_id)
    .where("role", "==", "ADMIN")
    .get();

  // confirm organization is part of user's organizations
  let foundOrgs = querySnapshot.docs.filter((snapshot) => {
    return snapshot.data().organizationId === orgId;
  });
  if (!foundOrgs.length) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "invalid data passed."
    );
  }
}

/// Validate E164 format
/// duplicated from functions/index.js
function validPhoneNumber(num) {
  return /^\+?[1-9]\d{1,14}$/.test(num);
}

async function getExistingUsers(db, admin, userIdentifiers) {
  return await Promise.all(
    userIdentifiers.map(async (value) => {
      if (validPhoneNumber(value)) {
        let snapshot = await db
          .collection("users")
          .where("phoneNumber", "==", getE164PhoneNumber(value))
          .get();
        // TODO: can be greater than 1 on dev. we should handle this better eventually
        if (snapshot.size !== 1) {
          throw new functions.https.HttpsError(
            "permission-denied",
            "User not found"
          );
        }

        let userDoc = await db
          .collection("users")
          .doc(snapshot.docs[0].id)
          .get();
        let data = userDoc.data();
        data["uid"] = userDoc.id;
        return data;
      }
      // email
      const emailAddress = require("email-addresses");
      const result = emailAddress.parseOneAddress(value);
      if (result && result.domain) {
        // valid email
        return await admin.auth().getUserByEmail(value);
      }
      throw new functions.https.HttpsError(
        "invalid-argument",
        "should have passed an email or phone number"
      );
    })
  );
}

function validateOrgData(data) {
  if (!data.orgName || !data.admins) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "invalid data passed"
    );
  }
  let orgData = {
    organizationName: data.orgName,
  };
  return orgData;
}

function createOrganization(db, admin, data, context) {
  verifyAdmin(db, admin, context);

  let orgData = validateOrgData(data);

  let adminIdentifiers = [];
  // new format, list of email/phone numbers
  if (data.admins.length) {
    adminIdentifiers = data.admins;
  } else {
    // strip empty strings or anything like that
    adminIdentifiers = data.admins.split(",").filter((val) => val.trim());
  }

  return getExistingUsers(db, admin, adminIdentifiers).then(async (users) => {
    // todo this should be in a transaction
    let snapshot = await db
      .collection("organizations")
      .where("organizationName", "==", data.orgName)
      .get();

    if (snapshot.size > 0) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "cannot have organizations with duplicate names (for now)"
      );
    }
    return db
      .collection("organizations")
      .add(orgData)
      .then((organizationRef) => {
        let promises = [];
        users.forEach((user) => {
          promises.push(
            db
              .collection("user_organizations")
              .add({
                organizationId: organizationRef.id,
                userId: user.uid,
                role: "ADMIN",
              })
              .catch((error) => {
                throw new functions.HttpsError(
                  "aborted",
                  "error performing action"
                );
              })
          );
        });
        return Promise.all(promises).then(() => {
          return {
            organizationId: organizationRef.id,
          };
        });
      });
  });
}

function editOrganization(db, admin, data, context) {
  verifyAdmin(db, admin, context);

  const FieldValue = admin.firestore.FieldValue;

  let orgData = validateOrgData(data);

  const query = async () => {
    // get existing admins.
    let snapshot = await db
      .collection("user_organizations")
      .where("organizationId", "==", data.organizationId)
      .where("role", "==", "ADMIN")
      .get();

    let userToSid = {};
    snapshot.docs.forEach((s) => (userToSid[s.data().userId] = s.id));

    let valuesToResolve = [];
    let newIds = [];
    let oldIds = [];
    data.admins.forEach((value) => {
      // phone
      if (validPhoneNumber(value)) {
        valuesToResolve.push(value);
      } else {
        const emailAddress = require("email-addresses");
        const result = emailAddress.parseOneAddress(value);
        if (result && result.domain) {
          valuesToResolve.push(value);
        } else {
          // existing id
          if (userToSid[value]) {
            delete userToSid[value];
          } else {
            newIds.push(id);
          }
        }
      }
    });
    // any remaining ids need to be removed
    for (let key in userToSid) {
      oldIds.push([userToSid[key], key]);
    }

    if (valuesToResolve) {
      let users = await getExistingUsers(db, admin, valuesToResolve);
      users.forEach((user) => newIds.push(user.uid));
    }
    let promises = [];
    if (newIds) {
      newIds.forEach((newId) => {
        promises.push(
          db
            .collection("user_organizations")
            .add({
              organizationId: data.organizationId,
              userId: newId,
              role: "ADMIN",
            })
            .catch((error) => {
              throw new functions.HttpsError(
                "aborted",
                "error performing action"
              );
            })
        );
        promises.push(
          db
            .collection("users")
            .doc(newId)
            .update({
              enterpriseConsoleAccess: true,
            })
            .catch((error) => {
              throw new functions.HttpsError(
                "aborted",
                "error performing action"
              );
            })
        );
      });
    }
    if (oldIds) {
      oldIds.forEach(([oldId, oldUserId]) => {
        promises.push(db.collection("user_organizations").doc(oldId).delete());
        promises.push(
          db
            .collection("users")
            .doc(oldUserId)
            .update({ enterpriseConsoleAccess: FieldValue.delete() })
        );
      });
    }
    promises.push(
      db.collection("organizations").doc(data.organizationId).update(orgData)
    );
    await Promise.all(promises);
    return {
      organizationId: data.organizationId,
    };
  };
  return Promise.resolve(query());
}

function deleteOrganization(db, admin, data, context) {
  verifyAdmin(db, admin, context);

  // todo need to also delete members and admins of org :(
  const query = async () => {
    await db.collection("organizations").doc(data.organizationId).delete();
    return {
      success: true,
    };
  };
  return Promise.resolve(query());
}

function queryOrganizations(db, admin, data, context) {
  verifyAdmin(db, admin, context);

  const query = async () => {
    let orgSnapshot = await db.collection("organizations").get();

    return await Promise.all(
      orgSnapshot.docs.map(async (snapshot) => {
        let userOrgSnapshot = await db
          .collection("user_organizations")
          .where("organizationId", "==", snapshot.id)
          .where("role", "==", "ADMIN")
          .get();

        let userDocs = await Promise.all(
          userOrgSnapshot.docs.map((snapshot) => {
            return db.collection("users").doc(snapshot.data().userId).get();
          })
        );

        let orgData = snapshot.data();
        orgData["id"] = snapshot.id;
        orgData["admins"] = [];
        userDocs.forEach((userDoc) => {
          if (userDoc.exists) {
            let admin = userDoc.data();
            admin["id"] = userDoc.id;
            orgData["admins"].push(admin);
          }
        });

        return orgData;
      })
    );
  };
  return Promise.resolve(query());
}

function verifyAuth(context) {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "User not authenticated."
    );
  }
}

function queryUserOrganizations(db, data, context) {
  verifyAuth(context);
  const query = async () => {
    let userOrgSnapshot = await db
      .collection("user_organizations")
      .where("userId", "==", context.auth.token.user_id)
      .where("role", "==", "ADMIN")
      .get();

    let results = [];
    await Promise.all(
      userOrgSnapshot.docs.map(async (snapshot) => {
        let orgDoc = await db
          .collection("organizations")
          .doc(snapshot.data().organizationId)
          .get();

        if (!orgDoc.exists) {
          return;
        }
        let orgData = orgDoc.data();
        orgData["id"] = orgDoc.id;
        results.push(orgData);
      })
    );
    return results;
  };
  return Promise.resolve(query());
}

function createVolunteerOfOrganization(db, admin, data, context) {
  // Lazy initialization
  if (!admin) {
    admin = require("firebase-admin");
    admin.initializeApp();
  }

  const email = data.email;

  return admin
    .auth()
    .createUser({
      email: email,
      password: defaultPassword,
      disabled: false,
    })
    .then((userRecord) => {
      var { userProfileDataOnCreation } = require("./../user");

      // set the flags so this user is created as a
      // volunteer (and not the legacy requester)
      data.needsHelp = false;
      data.canHelp = true;

      // the rest of these properties cannot be undefined,
      // but we don't have any data to populate them with yet,
      // so we leave them as null/unset, so bypass the DB
      // undefined restrictions
      data.gender = "unset";
      data.street = null;
      data.zipCode = null;
      data.photoUrl = null;
      data.city = null;
      data.state = null;
      const profileData = userProfileDataOnCreation(data, context, {
        includeRecipientInfo: false,
        isPartnerVolunteer: true,
      });

      // create user in users collection now
      return db
        .collection("users")
        .doc(userRecord.uid)
        .set(profileData)
        .then((createdUser) => {
          // also add user as member of organization so we can track
          return db
            .collection("user_organizations")
            .add({
              organizationId: data.organizationId,
              userId: userRecord.uid,
              role: "VOLUNTEER",
            })
            .then((orgRecord) => {
              console.log(
                "createVolunteerOfOrganization successfully added member as volunteer uid",
                userRecord.uid
              );
              return userRecord.uid;
            })
            .catch((error) => {
              console.log("Error adding user as volunteer org member", error);
            });
        })
        .catch((error) => {
          console.log("Error creating record in users collection:", error);
        })
        .catch((error) => {
          console.log("Error fetching user data:", error);
        });
    })
    .catch((error) => {
      console.log("Error creating new user:", error);
    });
}

// similar to queryUserOrganizations function but looking for role == VOLUNTEER instead of ADMIN
function getUserOrgMemberships(db, data, context) {
  verifyAuth(context);
  const query = async () => {
    let userOrgSnapshot = await db
      .collection("user_organizations")
      .where("userId", "==", context.auth.token.user_id)
      .where("role", "==", "VOLUNTEER")
      .get();
    let results = [];
    await Promise.all(
      userOrgSnapshot.docs.map(async (snapshot) => {
        let orgDoc = await db
          .collection("organizations")
          .doc(snapshot.data().organizationId)
          .get();
        if (!orgDoc.exists) {
          return;
        }
        let orgData = orgDoc.data();
        orgData["orgId"] = orgDoc.id;
        results.push(orgData);
      })
    );
    return results;
  };
  return Promise.resolve(query());
}

function createRecipientOfOrganization(db, data, context) {
  const query = async () => {
    await verifyUserCanEditOrg(db, context, data.organizationId);

    var { userProfileDataOnCreation } = require("./../user");
    data.needsHelp = true; // force recipient to needs help
    const profileData = userProfileDataOnCreation(data, context, {
      includeRecipientInfo: true,
    });

    // create user
    const ref = await db.collection("users").add(profileData);

    // also add user as member of organization so we can track
    await db.collection("user_organizations").add({
      organizationId: data.organizationId,
      userId: ref.id,
      role: "MEMBER",
    });

    return {
      userId: ref.id,
    };
  };
  return Promise.resolve(query());
}

// limit to 250 because of firebase's 500 writes batch limit
// we currently do 2 writes per batch:
// 1/ create user
// 2/ add user to organization
// so we do (500/2) items per batch
const RECIPIENT_BUCKET_SIZE = 250;

function importRecipientsOfOrganization(db, data, context) {
  const query = async () => {
    await verifyUserCanEditOrg(db, context, data.organizationId);

    if (!data.recipients || !data.recipients.length) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "invalid data passed."
      );
    }
    let googleMaps = null;
    let googleMapsClient = null;

    let userIds = [];
    const times = Math.ceil(data.recipients.length / RECIPIENT_BUCKET_SIZE);

    let pos = 0;
    for (let i = 0; i < times; i++) {
      const recipients = data.recipients.slice(
        pos,
        pos + RECIPIENT_BUCKET_SIZE
      );
      /* eslint-disable no-await-in-loop*/
      let users = await importRecipients(
        db,
        googleMaps,
        googleMapsClient,
        recipients
      );
      /* eslint-enable no-await-in-loop*/
      userIds = userIds.concat(users);
      pos += RECIPIENT_BUCKET_SIZE;
    }

    return {
      userIds,
      success: true,
    };
  };

  const importRecipients = async (
    db,
    googleMaps,
    googleMapsClient,
    recipients
  ) => {
    let { userProfileDataOnCreation } = require("./../user");
    let { validateAddress } = require("./../address");

    let batch = db.batch();
    let userIds = [];

    await Promise.all(
      recipients.map(async (recipient) => {
        // force recipient to needs help
        recipient.needsHelp = true;
        recipient.gender = "unset";
        const profileData = userProfileDataOnCreation(recipient, context, {
          includeRecipientInfo: true,
        });

        if (recipient.geohash === "" || recipient.placeId === "") {
          console.error(
            "FAIL: should have gotten placeId and geohash from the client"
          );

          // validate address and get placeId (and geohash)
          // when importing a lot of addresses, we run into rate limiting issues
          // and we don't want to fail the entire thing so have the ones we know succeed
          // and then we'll try the others later
          try {
            let r = await validateAddress(
              recipient,
              googleMaps,
              googleMapsClient
            );
            profileData.geohash = r.data.geohash;
            profileData.placeId = r.data.placeId;
          } catch (e) {
            console.error("error validating address", e.message);
          }
        }

        // create user
        const userRef = db.collection("users").doc();
        batch.create(userRef, profileData);

        const userOrgRef = db.collection("user_organizations").doc();
        batch.create(userOrgRef, {
          organizationId: data.organizationId,
          userId: userRef.id,
          role: "MEMBER",
        });
        userIds.push(userRef.id);
      })
    );

    return batch
      .commit()
      .then((_result) => {
        return userIds;
      })
      .catch((err) => {
        console.error("transaction failure", err);
        return [];
      });
  };
  return Promise.resolve(query());
}

function queryOrganizationRecipients(db, data, context) {
  verifyAuth(context);

  const query = async () => {
    // not quite edit but only organization admins can query this
    await verifyUserCanEditOrg(db, context, data.organizationId);

    let userOrgSnapshot = await db
      .collection("user_organizations")
      .where("organizationId", "==", data.organizationId)
      .where("role", "==", "MEMBER")
      .get();

    let { bucketRequestSnapshot } = require("./../requests");

    let users = await Promise.all(
      userOrgSnapshot.docs.map(async (snapshot) => {
        let userId = snapshot.data().userId;
        let doc = await db.collection("users").doc(userId).get();

        if (!doc.exists) {
          return null;
        }
        let data = doc.data();
        data["id"] = doc.id;

        let requestsSnapshot = await db
          .collection("requests")
          .where("requester", "==", userId)
          .get();

        let bucket = bucketRequestSnapshot(requestsSnapshot);
        data = {
          ...data,
          ...bucket,
        };

        return data;
      })
    );
    // remove users that don't exist anymore
    return users.filter((user) => user);
  };
  return Promise.resolve(query());
}

async function verifyCanEditUser(db, context, userId) {
  let [userQuerySnapshot, adminQuerySnapshot] = await Promise.all([
    db
      .collection("user_organizations")
      .where("userId", "==", userId)
      .where("role", "==", "MEMBER")
      .get(),
    db
      .collection("user_organizations")
      .where("userId", "==", context.auth.token.user_id)
      .where("role", "==", "ADMIN")
      .get(),
  ]);

  let intersect = userQuerySnapshot.docs.some((snapshot) => {
    return adminQuerySnapshot.docs.filter(
      (snapshot2) =>
        snapshot2.data().organizationId === snapshot.data().organizationId
    );
  });
  // tried to edit a user who's not in an org of which user is an admin
  if (!intersect) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "invalid data passed."
    );
  }
}

function editVolunteerOfOrganization(db, admin, data, context) {
  const userId = data.id;

  const query = async () => {
    await verifyUserCanEditOrg(db, context, data.organizationId);

    // NOTE: if they are an existing user, then we don't want to null out
    // their data, so let's omit this for now. we may want to update the
    // phone number if that's not on the object already, but the rest probably
    // best to leave as is.
    //var { userProfileDataOnEdit } = require("./../user");
    //const profileData = userProfileDataOnEdit(data);
    //const ref = await db.collection("users").doc(data.id).update(profileData);

    // add existing user as volunteer
    db.collection("user_organizations")
      .add({
        organizationId: data.organizationId,
        userId: userId,
        role: "VOLUNTEER",
      })
      .then((orgRecord) => {
        return userId;
      })
      .catch((error) => {
        console.log("Error adding user as volunteer org member", error);
        throw new functions.https.HttpsError(
          "internal",
          "Error adding user as volunteer org member"
        );
      });

    return {
      userId: userId,
    };
  };
  return Promise.resolve(query());
}

function editRecipientOfOrganization(db, data, context) {
  const query = async () => {
    await verifyCanEditUser(db, context, data.id);

    var { userProfileDataOnEdit } = require("./../user");
    const profileData = userProfileDataOnEdit(data, {
      includeRecipientInfo: true,
    });

    // update user
    const ref = await db.collection("users").doc(data.id).update(profileData);

    return {
      userId: ref.id,
    };
  };
  return Promise.resolve(query());
}

function deleteRecipientOfOrganization(db, data, context) {
  const query = async () => {
    await verifyCanEditUser(db, context, data.id);

    let snapshotDocs = await db
      .collection("user_organizations")
      .where("userId", "==", data.id)
      .where("role", "==", "MEMBER")
      .get();

    let orgIdSnapshot = snapshotDocs.docs.filter(
      (snapshot) => snapshot.data().organizationId === data.organizationId
    );

    if (orgIdSnapshot.length !== 1) {
      // weirdness. should be one since we verified above that we can get this...
      console.log(
        `error finding org member snapshot for ${data.organizationId} for user ${data.id}`
      );
      throw new functions.https.HttpsError(
        "invalid-argument",
        "invalid data passed."
      );
    }

    return db
      .collection("user_organizations")
      .doc(orgIdSnapshot[0].id)
      .update({
        role: "ARCHIVED_MEMBER",
      })
      .then(() => {
        return {
          success: true,
        };
      });
  };
  return Promise.resolve(query());
}

function createRequestsForOrganization(db, data, context) {
  // Note that this function only populates requests in our database. It does not handle sending these requests to third parties (e.g. Uber).
  // It also does not handle sending notifications.

  // Parameters:
  // orgId: Organization that the user is creating requests for.
  // recipientIds: List of user IDs that requests should be created for.
  // fulfiller: The organization that will be fulfilling the request.
  // needs: Instructions the fulfiller will be using to complete the delivery. By default every request will be assigned this needs value..
  // needsMap (optional): A map from user IDs (each user ID must be in "recipients") to specific needs for the request. Superscedes "needs" field value.
  //    This is optional - if a recipient does not have an entry here, it will use the "needs" value provided.
  // supplierMap (optional): A map from user IDs (each user ID must be in "recipients") to the supplier that should be used to complete the request.
  //    This is optional - if a recipient in the above does not have a corresponding supplier ID, it will not be associated with the request.

  const work = async () => {
    verifyAuth(context);
    //
    // find any delivery events where the startTime < selectedDate
    //

    // reuse deliveryEvent if new scheduledTme
    let [latestDeliverySnapshot, _] = await Promise.all([
      db
        .collection("delivery_events")
        .where("supplierId", "==", data.supplierId)
        .where("startTime", "<", data.selectedDate)
        // TODO need to do start of day and take timezone into account
        // for now 24h
        // this is needed for reuploads
        .where("startTime", ">", data.selectedDate - 86400 * 1000)
        .orderBy("startTime", "desc")
        .limit(1)
        .get(),
      verifyUserCanEditOrg(db, context, data.orgId),
    ]);

    // TODO: We can only write 500 requests using this batch system

    let snapshot = await db.collection("organizations").doc(data.orgId).get();
    let orgData = snapshot.data();

    const moment = require("moment");

    // keep a counter of number in this bucket.
    let bucketIdx = 0;
    let startTime = data.selectedDate;

    let endTime = data.endTime || null;
    if (data.endTime) {
      endTime = parseInt(data.endTime, 10) || null;
      if (endTime !== null && endTime <= data.selectedDate) {
        throw new Error("cannot have end time after start time");
      }
    }
    const getPickupTime = () => {
      if (!data.selectedDate) {
        throw new Error("selected date required");
      }
      if (data.pickupsPer) {
        let ret = startTime;
        bucketIdx++;
        // have reached the number per pickup, reset the counter
        // and add 30 minutes which is what we add in the UI
        if (bucketIdx === data.pickupsPer) {
          bucketIdx = 0;
          startTime = moment(startTime).add(15, "minutes").valueOf();
        }
        return ret;
      }
      return data.selectedDate;
    };
    let requestDatas = [];
    var lookupRequesterPromises = [];
    let immediateRequestIDs = [];
    // we don't know which user in the org imported that?
    // do we care?
    data.recipientIds.forEach((recipientId) => {
      let requestData = {
        aboutUser: `This is a person in need. A request for them was created by the organization ${orgData.organizationName}`,
        closingVerifiedTextTimeSent: null,
        createdBy: context.auth.token.user_id,
        organizationId: data.orgId,
        geohash: null, // To be filled on next step
        helper: null,
        languages: null, // To be filled on next step
        needs: `food bank item for organization ${orgData.organizationName}`,
        notificationTimes: {}, // TODO
        reminderTextTimeSent: null,
        requester: recipientId,
        requesterFirstName: null, // To be filled on next step
        status: "open",
        supplier:
          data.supplierMap && recipientId in data.supplierMap
            ? data.supplierMap[recipientId]
            : null,
        timeAccepted: null,
        timeClosed: null,
        timeCreated: new Date(),
        toBeFulfilledBy: data.fulfiller,
        zipCode: null, // To be filled on next step
      };

      requestData.scheduledPickupTime = getPickupTime();
      requestData.uberStatus = "TO_BE_SCHEDULED";

      requestDatas.push(requestData);

      lookupRequesterPromises.push(
        db.collection("users").doc(recipientId).get()
      );
    });

    let timeNow = new Date().getTime();
    const thirteenMins = 13 * 60 * 1000;

    return Promise.all(lookupRequesterPromises)
      .then((requesterDocs) => {
        let batch = db.batch();

        // createDeliveryEvent if most recent delivery window has ended
        let createDelivery = latestDeliverySnapshot.size === 0;
        if (!createDelivery) {
          let latestDeliveryEvent = latestDeliverySnapshot.docs[0].data();

          // (if same day)
          // no end time OR endTime > selectedDate
          // reuse same delivery event
          if (
            !(
              latestDeliveryEvent.endTime === null ||
              latestDeliveryEvent.endTime > data.selectedDate
            )
          ) {
            createDelivery = true;
          }
        }

        let deliveryEventID;
        if (createDelivery) {
          let deliveryEventRef = db.collection("delivery_events").doc();

          batch.create(deliveryEventRef, {
            supplierId: data.supplierId,
            startTime: data.selectedDate, // this should be enough to get most recent...
            endTime: endTime,
          });
          deliveryEventID = deliveryEventRef.id;
        } else {
          deliveryEventID = latestDeliverySnapshot.docs[0].id;
        }
        for (var i = 0; i < requesterDocs.length; i++) {
          var requesterData = requesterDocs[i].data();
          var requestData = requestDatas[i];
          requestData.geohash = requesterData.geohash;
          requestData.languages = requesterData.languages;
          requestData.requesterFirstName = requesterData.firstName;
          requestData.zipCode = requesterData.zipCode;
          requestData.deliveryEvent = deliveryEventID;
        }

        requestDatas.forEach((requestData) => {
          var newRequestRef = db.collection("requests").doc();

          // only add request that needs to be created immediately
          // this only affects Uber
          if (
            requestData.toBeFulfilledBy === "UBER" &&
            requestData.scheduledPickupTime - timeNow <= thirteenMins
          ) {
            immediateRequestIDs.push(newRequestRef.id);
          }
          batch.set(newRequestRef, requestData);
        });

        return batch.commit().then(() => {
          if (!immediateRequestIDs.length) {
            return null;
          }

          // because the pub sub job runs every 10 mins, by time we get to some trips, their pick up times might have already passed.
          // So we create them now to prevent this issue.
          let {
            createUberRequestsImmediately,
          } = require("./../providers/uber");

          // if asap requests and within the window, just create asap requests immedidately
          return createUberRequestsImmediately(db, immediateRequestIDs);
        });
      })
      .catch((error) => {
        console.log(error);

        throw new functions.https.HttpsError(
          "internal",
          "An error occurred when creating these requests. Please reach out to Helping Hands team to diagnose."
        );
      });
  };
  return Promise.resolve(work());
}

function queryOrganizationRequests(db, data, context) {
  // Parameters:
  // orgId: Organization ID
  // TODO: add parameters to sort and filter by open/closed/in progress
  // mode: past or active
  console.time("queryOrganizationRequestsWholeFunction");
  const work = async () => {
    verifyAuth(context);
    await verifyUserCanEditOrg(db, context, data.orgId);

    var { loadRequestData } = require("./../requests");

    let oneDayAgo =
      moment()
        // use UTC offset so we're consistent across timezones
        .utcOffset(0)
        .subtract(1, "day")
        .set({ hour: 0, minute: 0, seconds: 0, milliseconds: 0 })
        .unix() * 1000;

    let pastDays =
      moment()
        // use UTC offset so we're consistent across timezones
        .utcOffset(0)
        .subtract(data.daysToLoad || 7, "day")
        .set({ hour: 0, minute: 0, seconds: 0, milliseconds: 0 })
        .unix() * 1000;

    const loadPast24Hours = async () => {
      // duplicated in createRequestsForOrganization
      return await loadRequestData(
        db,
        db
          .collection("requests")
          .where("organizationId", "==", data.orgId)
          .where("scheduledPickupTime", ">=", oneDayAgo)
          .orderBy("scheduledPickupTime", "desc")
          .get()
      );
    };

    var loadedRequests = [];
    console.time("LoadRequests" + data.mode);
    if (data.mode === "active") {
      console.time("Active");
      loadedRequests = await loadPast24Hours();
      console.timeEnd("Active");
      console.log(loadedRequests.length, "active requests");
    } else if (data.mode === "past") {
      // TODO we're only limiting to past 7 days for now. pagination coming soon...
      let [pastSevenDays, past24Hours] = await Promise.all([
        loadRequestData(
          db,
          db
            .collection("requests")
            .where("organizationId", "==", data.orgId)
            .where("scheduledPickupTime", "<", oneDayAgo)
            .where("scheduledPickupTime", ">=", pastDays)
            .orderBy("scheduledPickupTime", "desc")
            .get()
        ),
        loadPast24Hours(),
      ]);
      // get only cancelled from last 24 hours
      // not doing a new where clause because it should be "cheap"
      past24Hours = past24Hours.filter(
        (trip) =>
          trip.outcome === "cancelled" || trip.uberStatus === "CANCELLED"
      );
      loadedRequests = pastSevenDays.concat(past24Hours);
    } else {
      // e.g. partner console...
      loadedRequests = await loadRequestData(
        db,
        // sort the queries by most recent first so that what we show make sense.
        db
          .collection("requests")
          .where("organizationId", "==", data.orgId)
          .orderBy("timeCreated", "desc")
          .get()
      );
    }
    console.timeEnd("LoadRequests" + data.mode);
    loadedRequests = loadedRequests.filter((trip) => trip !== null);

    loadedRequests = await Promise.all(
      loadedRequests.map(async (request) => {
        if (request.helper) {
          const helperDoc = await db
            .collection("users")
            .doc(request.helper)
            .get();
          if (helperDoc.exists) {
            request.helperData = helperDoc.data();
          }
        }
        return request;
      })
    );

    // this additional information (creatorName and creator info) is required for displaying the organisation requests in partner_console
    if (data.consoleType === "partner") {
      let result = await Promise.all(
        loadedRequests.map(async (request) => {
          createdByDoc = await db
            .collection("users")
            .doc(request.createdBy)
            .get();

          if (createdByDoc.exists) {
            let createdBy = createdByDoc.data();
            request.creator = createdBy;
            request.creatorName = createdBy.firstName;
          }

          return request;
        })
      );
      console.timeEnd("queryOrganizationRequestsWholeFunction");
      return result;
    } else {
      console.timeEnd("queryOrganizationRequestsWholeFunction");
      return loadedRequests;
    }
  };
  return Promise.resolve(work());
}

function createRecipientPlusRequest(db, data, context) {
  const work = async () => {
    await verifyUserCanEditOrg(db, context, data.organizationId);

    let { userProfileDataOnCreation } = require("./../user");
    let profileData = userProfileDataOnCreation(data, context, {
      includeRecipientInfo: true,
    });
    // force recipient to needs help
    profileData.needsHelp = true;

    let batch = db.batch();
    // create user
    const userRef = db.collection("users").doc();
    batch.create(userRef, profileData);

    // add user as member of org
    const userOrgRef = db.collection("user_organizations").doc();
    batch.create(userOrgRef, {
      organizationId: data.organizationId,
      userId: userRef.id,
      role: "MEMBER",
    });

    var requestData = {
      aboutUser: profileData.aboutUser,
      closingVerifiedTextTimeSent: null,
      createdBy: context.auth.token.user_id,
      organizationId: data.organizationId,
      geohash: profileData.geohash || null,
      helper: null,
      languages: profileData.languages,
      needs: data.needs,
      notificationTimes: {},
      reminderTextTimeSent: null,
      requester: userRef.id,
      requesterFirstName: profileData.firstName,
      status: "open",
      supplier: null,
      timeAccepted: null,
      timeClosed: null,
      timeCreated: new Date(),
      toBeFulfilledBy: "VOLUNTEER",
      zipCode: profileData.zipCode,
    };

    const newRequestRef = db.collection("requests").doc();
    batch.create(newRequestRef, requestData);

    return batch.commit().then(() => {
      return {
        userId: userRef.id,
        requestId: newRequestRef.id,
      };
    });
  };
  return Promise.resolve(work());
}

async function checkExistingOrgMember(db, data, context) {
  const phoneNumber = getE164PhoneNumber(data.phoneNumber);
  const firstName = data.firstName;
  const lastName = data.lastName;

  let snapshot = await db
    .collection("users")
    .where("phoneNumber", "==", phoneNumber)
    .where("firstName", "==", firstName)
    .where("lastName", "==", lastName)
    .get();

  // data.orgId
  let users = await Promise.all(
    snapshot.docs.map(async (doc) => {
      if (!doc.exists) {
        return null;
      }

      let userOrgSnapshot = await db
        .collection("user_organizations")
        .where("userId", "==", doc.id)
        .where("role", "==", "MEMBER")
        .get();

      let filter = userOrgSnapshot.docs.filter(
        (userOrgDoc) =>
          userOrgDoc.exists && userOrgDoc.data().organizationId === data.orgId
      );
      if (filter.length !== 1) {
        return null;
      }

      let userData = doc.data();
      userData.id = doc.id;
      return userData;
    })
  );
  users = users.filter(Boolean);
  // there could be more than one. we're ignoring the others for now
  // we should make this deterministic
  return users[0] || null;
}

function closeOrganizationRequestWithOutcome(db, admin, data, context) {
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

  const work = async () => {
    await verifyUserCanEditOrg(db, context, data.organizationId);

    const requestId = data.requestId;
    const outcome = data.outcome;

    let requestSnapshot = await db.collection("requests").doc(requestId).get();
    let status = requestSnapshot.data().status;

    if (status === "pending_fulfillment") {
      let requesterFirstName = requestSnapshot.data().firstName;
      let helperId = requestSnapshot.data().helperId;

      let helperPhone = await db.collection("users").doc(helperId).get().data()
        .phoneNumber;

      const volunteerMessage = TEXT_requesterCancelledHelper(
        requesterFirstName
      );
      sendText(volunteerMessage, helperPhone);
    }

    console.log("Successfully closed and cancelled request", requestId);

    return await db
      .collection("requests")
      .doc(requestId)
      .update({ status: "closed", outcome: outcome });
  };

  return Promise.resolve(work());
}

function getInspectedRequestData(db, admin, data, context) {
  // we want non admins in partner console to be able to use this
  // data = {
  //   location: [x, y], // for use with partner console
  //   id: user_id // for use with partner console
  //   consoleType: "partner"
  // }
  //
  if (!admin) {
    admin = require("firebase-admin");
    admin.initializeApp();
  }
  db = db || admin.firestore();

  if (!(context.auth.token.admin || data.consoleType === "partner")) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "User not authenticated."
    );
  }

  const query = async () => {
    if (data.id) {
      let result = await db.collection("users").doc(data.id).get();

      let returnData = result.data();
      returnData.id = result.id;

      return returnData;
    } else if (data.location) {
      let users = await db
        .collection("users")
        .where("geohash", ">=", data.location[0])
        .where("geohash", "<=", data.location[1])
        .where("canHelp", "==", true)
        .get();

      let userData = [];

      await Promise.all(
        users.docs.map(async (snapshot) => {
          let data = snapshot.data();
          data.id = snapshot.id;
          userData.push(data);
        })
      );

      return userData;
    } else {
      return [];
    }
  };

  return Promise.resolve(query());
}

module.exports = {
  createOrganization,
  editOrganization,
  deleteOrganization,
  queryOrganizations,
  queryUserOrganizations,
  getUserOrgMemberships,
  verifyUserCanEditOrg,
  createVolunteerOfOrganization,
  editVolunteerOfOrganization,
  createRecipientOfOrganization,
  importRecipientsOfOrganization,
  queryOrganizationRecipients,
  editRecipientOfOrganization,
  deleteRecipientOfOrganization,
  createRequestsForOrganization,
  queryOrganizationRequests,
  createRecipientPlusRequest,
  closeOrganizationRequestWithOutcome,
  getInspectedRequestData,
  checkExistingOrgMember,
};
