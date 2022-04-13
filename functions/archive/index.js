var libphonenumber = require("libphonenumber-js");

function backfillE164NPhoneNumbers(dryRun) {
  if (!admin) {
    admin = require("firebase-admin");
    admin.initializeApp();
  }
  db = db || admin.firestore();

  let batch = db.batch();
  var numDocsUpdated = 0;
  var numDocsError = 0;
  var numDocsSkipped = 0;
  console.log("Starting to backfil...");
  return db
    .collection("users")
    .get()
    .then((userDocs) => {
      userDocs.forEach((userDoc) => {
        const currentPhoneNumber = userDoc.data().phoneNumber.toString();
        if (numDocsUpdated >= 500) {
          return;
        }

        try {
          // Try parsing the phone number and seeing if it's different
          const parsedNumber = libphonenumber.parsePhoneNumberFromString(
            currentPhoneNumber,
            "US"
          );
          if (!parsedNumber) {
            console.error(
              `Unable to parse phone number from ${currentPhoneNumber} when backfilling. This user has an invalid phone number.`
            );
            numDocsError++;
            return;
          }

          if (currentPhoneNumber !== parsedNumber.number) {
            batch.update(userDoc.ref, {
              phoneNumber: parsedNumber.number,
            });
            numDocsUpdated++;
          } else {
            numDocsSkipped++;
          }
        } catch (error) {
          console.log(
            `Error with parsing phone number ${currentPhoneNumber}`,
            error
          );
          numDocsError++;
        }
      });
      console.log(`Updating ${numDocsUpdated} documents with corrected phone numbers.
        ${numDocsError} documents are not being updated because we failed to parse their phone number.
        ${numDocsSkipped} documents are being skipped because they already have a correctly formatted phone number.`);
      return;
    })
    .then(() => {
      if (!dryRun) {
        return batch.commit();
      } else {
        console.log(
          "Not actually updating documents because this is a dryrun."
        );
        return;
      }
    })
    .catch((err) => {
      console.error("Unable to write batch backfilling users.", err);
    });
}

exports.httpBackfillE164 = functions.https.onRequest((req, res) => {
  const realrun = req.query.realrun;
  const dryrun = !(realrun && realrun === "true");
  backfillE164NPhoneNumbers(dryrun)
    .then(() => {
      return res.status(200).send();
    })
    .catch((err) => {
      console.error(err);
      return res.status(500).send();
    });
});

exports.httpMigrateUberCompletionStatus = functions.https.onRequest(
  async (req, res) => {
    const realrun = req.query.realrun;
    const dryrun = !(realrun && realrun === "true");

    return migrateUberCompletionStatus(db, dryrun, res);
  }
);

async function migrateUberCompletionStatus(db, dryrun, res) {
  let requests = await db
    .collection("requests")
    .where("CompletionConfirmationType", "in", [
      "UBER_TRIP_FAILED",
      "UBER_TRIP_COMPLETED",
    ])
    .get();

  let batch = db.batch();
  requests.docs.forEach((request) => {
    let data = request.data();
    if (data.uberStatus) {
      return;
    }
    let uberStatus;
    switch (data.CompletionConfirmationType) {
      case "UBER_TRIP_FAILED":
        uberStatus = "FAILED";
        break;
      case "UBER_TRIP_COMPLETED":
        uberStatus = "COMPLETED";
        break;
    }
    if (uberStatus) {
      if (dryrun) {
        console.log(request.id, uberStatus);
      } else {
        batch.update(request.ref, {
          CompletionConfirmationType: null,
          uberStatus: uberStatus,
        });
      }
    }
  });

  if (!dryrun) {
    return batch
      .commit()
      .then(() => {
        return res.status(200).send();
      })
      .catch((err) => {
        console.error(err);
        res.status(500).send();
      });
  } else {
    return res.status(200).send();
  }
}

async function migrateOrgRequestsData(db, admin, dryrun, res) {
  let requests = await db
    .collection("requests")
    .where("createdByType", "==", "ORGANIZATION")
    .get();

  let batch = db.batch();

  await Promise.all(
    requests.docs.map(async (request) => {
      let data = request.data();
      let orgId = data.createdBy;

      // hopefully firebase is smart about reloading the same data again?
      let orgSnapshot = await db
        .collection("user_organizations")
        .where("organizationId", "==", orgId)
        .where("role", "==", "ADMIN")
        .get();

      // it seems. not 100% sure that the default sort is most recent first
      // so just give it to the first admin
      // for most of the objects that have been created here. that's me (Ola)
      let adminDoc = orgSnapshot.docs[orgSnapshot.size - 1];

      batch.update(request.ref, {
        organizationId: orgId,
        createdBy: adminDoc.data().userId,
        // delete the field
        createdByType: admin.firestore.FieldValue.delete(),
      });
    })
  );

  if (!dryrun) {
    return batch
      .commit()
      .then(() => {
        return res.status(200).send();
      })
      .catch((err) => {
        console.error("error in migrateOrgRequestsData", err);
        res.status(500).send();
      });
  } else {
    return res.status(200).send();
  }
}

async function migrateScheduledPickupTime(db, admin, dryrun, res) {
  let requests = await db
    .collection("requests")
    .where("scheduledPickupTime", "==", 0)
    .limit(200) // to make sure we don't run into batch limits. can just run this multiple times
    .get();

  let batch = db.batch();

  await Promise.all(
    requests.docs.map(async (request) => {
      let data = request.data();

      const timeCreated = new Date(data.timeCreated._seconds * 1000);
      console.log(
        `attempting to update scheduledPickTime of request ${request.id} to ${timeCreated}`
      );
      batch.update(request.ref, {
        scheduledPickupTime: timeCreated,
      });
    })
  );

  if (!dryrun) {
    return batch
      .commit()
      .then(() => {
        return res.status(200).send();
      })
      .catch((err) => {
        console.error("error in migrateOrgRequestsData", err);
        res.status(500).send();
      });
  } else {
    return res.status(200).send();
  }
}
