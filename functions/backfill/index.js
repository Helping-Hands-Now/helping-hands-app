var functions = require("firebase-functions");
const moment = require("moment");
const { makeLyftRequest, getAccessToken } = require("../providers/lyft");
function backfillEmails(db, admin, dryRun) {
  if (!admin) {
    admin = require("firebase-admin");
    admin.initializeApp();
  }
  db = db || admin.firestore();

  let batch = db.batch();
  var numDocsUpdated = 0;
  var numDocsWithoutEmail = 0;

  return db
    .collection("users")
    .get()
    .then((userDocs) => {
      let promises = [];
      let promise;

      userDocs.forEach((user) => {
        if (numDocsUpdated + numDocsWithoutEmail < 499) {
          promise = admin
            .auth()
            .getUser(user.id)
            .then(function (userRecord) {
              if (userRecord.toJSON().email) {
                numDocsUpdated += 1;
                return batch.update(user.ref, {
                  email: userRecord.toJSON().email,
                });
              } else {
                numDocsWithoutEmail += 1;
                return batch.update(user.ref, {
                  email: null,
                });
              }
            })
            .catch(function (error) {
              numDocsWithoutEmail += 1;
              return batch.update(user.ref, {
                email: null,
              });
            });
          promises.push(promise);
        }
      });

      return Promise.all(promises);
    })
    .then(() => {
      console.log("batch executing");
      console.log(`Updating ${numDocsUpdated} documents with corrected emails.
        ${numDocsWithoutEmail} documents are not being updated because there is no email associated with this account.`);
      if (!dryRun) {
        return batch.commit();
      } else {
        console.log(
          "Not actually updating documents because this is a dryrun."
        );
        return;
      }
    });
}

function migrateCancelled(db, admin, dryRun) {
  if (!admin) {
    admin = require("firebase-admin");
    admin.initializeApp();
  }
  db = db || admin.firestore();

  let batch = db.batch();
  var numDocsUpdated = 0;

  return db
    .collection("requests")
    .where("status", "==", "cancelled")
    .get()
    .then((requests) => {
      let promises = [];

      requests.forEach((request) => {
        if (!request.data().outcome) {
          let promise = batch.update(request.ref, {
            status: "closed",
            outcome: "cancelled",
          });
          numDocsUpdated += 1;
          promises.push(promise);
        }
      });

      return Promise.all(promises);
    })
    .then(() => {
      console.log("batch executing");
      console.log(
        `Updating ${numDocsUpdated} documents with status closed and outcome cancelled.`
      );
      if (!dryRun) {
        return batch.commit();
      } else {
        console.log(
          "Not actually updating documents because this is a dryrun."
        );
        return;
      }
    });
}

function migrateClosed(db, admin, dryRun) {
  if (!admin) {
    admin = require("firebase-admin");
    admin.initializeApp();
  }
  db = db || admin.firestore();

  let batch = db.batch();
  var numDocsUpdated = 0;

  return db
    .collection("requests")
    .where("status", "==", "closed")
    .get()
    .then((requests) => {
      let promises = [];

      requests.forEach((request) => {
        if (!request.data().outcome) {
          let promise = batch.update(request.ref, {
            outcome: "completed",
          });
          numDocsUpdated += 1;
          promises.push(promise);
        }
      });

      return Promise.all(promises);
    })
    .then(() => {
      console.log("batch executing");
      console.log(
        `Updating ${numDocsUpdated} documents with status closed and outcome complete.`
      );
      if (!dryRun) {
        return batch.commit();
      } else {
        console.log(
          "Not actually updating documents because this is a dryrun."
        );
        return;
      }
    });
}

function removeResolutionType(db, admin, dryRun) {
  if (!admin) {
    admin = require("firebase-admin");
    admin.initializeApp();
  }
  db = db || admin.firestore();

  let batch = db.batch();
  var numDocsUpdated = 0;

  return db
    .collection("requests")
    .get()
    .then((requests) => {
      let promises = [];

      requests.forEach((request) => {
        if (request.data().resolutionType) {
          let promise = batch.update(request.ref, {
            resolutionType: admin.firestore.FieldValue.delete(),
          });
          numDocsUpdated += 1;
          promises.push(promise);
        }
      });

      return Promise.all(promises);
    })
    .then(() => {
      console.log("batch executing");
      console.log(
        `Updating ${numDocsUpdated} documents by removing resolutionType field (deprecated).`
      );
      if (!dryRun) {
        return batch.commit();
      } else {
        console.log(
          "Not actually updating documents because this is a dryrun."
        );
        return;
      }
    });
}

function backfillEnterpriseConsoleAccess(db, admin, dryRun) {
  if (!admin) {
    admin = require("firebase-admin");
    admin.initializeApp();
  }
  db = db || admin.firestore();

  const query = async () => {
    let batch = db.batch();
    var numDocsUpdated = 0;

    let docs = await db
      .collection("user_organizations")
      .where("role", "==", "ADMIN")
      .get();

    for (var i = 0; i < docs.size; i++) {
      let orgAdmin = docs.docs[i];

      let userRef = db.collection("users").doc(orgAdmin.data().userId);
      let doc = await userRef.get();
      if (doc.exists) {
        batch.update(db.collection("users").doc(orgAdmin.data().userId), {
          enterpriseConsoleAccess: true,
        });
        numDocsUpdated = numDocsUpdated + 1;
      }
    }

    console.log("batch executing");
    console.log(
      `Updating ${numDocsUpdated} documents with enterpriseConsoleAccess.`
    );
    if (!dryRun) {
      await batch.commit();
    } else {
      console.log("Not actually updating documents because this is a dryrun.");
    }
    return;
  };
  return Promise.resolve(query());
}

// Polls the Lyft API for costs when we're missing the cost in our db.
// Ocassionaly Lyft won't have the final cost available in API at the conclusion of a delivery event.
// This just runs periodically to backfill the costs on to the requests when they become available.
async function backfillLyftCosts(db, admin, data) {
  const accessToken = await getAccessToken(db);

  const snapshot = await db
    .collection("requests")
    .where("toBeFulfilledBy", "==", "LYFT")
    .where("lyftStatus", "in", ["COMPLETED", "FAILED"])
    .where("timeCreated", ">", moment().subtract(1, "week"))
    .get();
  const missingCostDocs = snapshot.docs.filter((doc) => {
    return (
      doc.get("lyftCost") === undefined && // Check for docs that don't have the lyftCost field at all
      doc.get("lyftFailureError") !== "FAILED_MATCHING" && // And ignore FAILED_MATCHING requests because they won't have pricing data (we weren't charged)
      doc.get("lyftFailureError") !== "DRIVER_CANCELED"
    ); // And ignore DRIVER_CANCELED requests because they won't have pricing data (we weren't charged)
  });
  console.log(
    "Found Lyft closed requests missing cost data: ",
    missingCostDocs.length
  );
  for (const doc of missingCostDocs) {
    const lyftOrderSnapshot = await db
      .collection("lyft_orders")
      .where("requestId", "==", doc.id)
      .get();
    if (lyftOrderSnapshot.size !== 1) {
      continue;
    }
    const lyftOrderDoc = lyftOrderSnapshot.docs[0];
    const lyftOrderId = lyftOrderDoc.get("orderId");
    let lyftResponse;
    try {
      lyftResponse = await makeLyftRequest(
        db,
        accessToken,
        `/orders/${lyftOrderId}`,
        "GET"
      );
      if (lyftResponse.error) {
        console.log(`Failed to fetch Lyft order ${lyftOrderId}`, lyftResponse);
        await db.collection("requests").doc(doc.id).update({ lyftCost: null });
        console.log(
          `Update request ${doc.id} cost to null since the order is not accessible`
        );
        continue;
      }
    } catch (e) {
      console.log(`Failed to fetch Lyft order ${lyftOrderId}`, e);
      continue;
    }
    if (!lyftResponse.data.price) {
      console.log(
        `Failed to fetch Lyft order for request ${doc.id} price`,
        lyftResponse.data.failure_reason
      );
      continue; // No price data available
    }
    await db
      .collection("requests")
      .doc(doc.id)
      .update({ lyftCost: lyftResponse.data.price.amount });
    console.log(
      `Update request ${doc.id} cost to ${lyftResponse.data.price.amount}`
    );
  }
}

// Backfill the community_events DB table with the new recipientsPerVolunteer
// property. Set it to 5 for any record that doesn't already have this field stored.
async function backfillCDEventProperty(db, admin, data) {
  const recipientsPerVolunteer = 5;

  const snapshot = await db.collection("community_events").get();
  const missingPropertyDocs = snapshot.docs.filter((doc) => {
    return doc.get("recipientsPerVolunteer") === undefined;
  });
  console.log(
    "Found CD events missing recipientsPerVolunteer field: ",
    missingPropertyDocs.length
  );

  for (const doc of missingPropertyDocs) {
    await db
      .collection("community_events")
      .doc(doc.id)
      .update({ recipientsPerVolunteer: recipientsPerVolunteer });
    console.log(
      `Updated community event ${doc.id} field recipientsPerVolunteer to ${recipientsPerVolunteer}`
    );
  }
}

module.exports = {
  backfillEmails,
  migrateCancelled,
  migrateClosed,
  removeResolutionType,
  backfillEnterpriseConsoleAccess,
  backfillLyftCosts,
  backfillCDEventProperty,
};
