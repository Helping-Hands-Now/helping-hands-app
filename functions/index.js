/* eslint-disable promise/no-nesting */
var functions = require("firebase-functions"); // Need to initialize this no matter what

// Hello! You might be looking at the top of this file because you're thinking of adding imports, or
// initializing global constants up here to reuse between functions.
// Don't do this. This is because this causes those variables to have to be initialized for EVERY function, even those that don't use them.
// This can slow down cold start times.
// Instead, lazily load any expensive imports within your function. See functions with the comments "// Lazy initialization" for examples.
// https://firebase.google.com/docs/functions/tips#do_lazy_initialization_of_global_variables
// It's slow, it's messy, it's annoying, but it's what we gotta to to make Firebase serverless functions performant.

// Constants. These don't need to be lazily initialized because either
// 1) They're used in every function or 2) They're not expensive to initialize
// TODO: Duplicated constants also found in notifications/index.js
const accountSid = functions.config().twilio.sid;
const authToken = functions.config().twilio.authtoken;
const twilioNumber = "+12057975648";

var metrics = require("./metrics");

// Variables to be lazily initialized. They're grouped with the dependencies that also need to be initialized for them.
var googleMaps;
var googleMapsClient;

var { admin, db } = require("./admin");
var {
  createAdminRecord,
  getUserCreationData,
  getUsers,
  getAdmins,
  makeAdminImpl,
  makeUserAdmin,
  performAdminAction,
  queryAdminRecords,
  closeRequestGivenOutcome,
} = require("./admins");
var {
  sendVolunteerSignupEmail,
  createProfile,
  updateProfile,
  checkExistingOrgVolunteer,
} = require("./user");
var {
  createSupplier,
  querySuppliers,
  deleteSupplier,
  editSupplier,
  importSuppliers,
  querySupplierTimeZone,
} = require("./suppliers");
var {
  createOrganization,
  editOrganization,
  deleteOrganization,
  queryOrganizations,
  getUserOrgMemberships,
  queryUserOrganizations,
  createRecipientOfOrganization,
  createVolunteerOfOrganization,
  editVolunteerOfOrganization,
  importRecipientsOfOrganization,
  editRecipientOfOrganization,
  deleteRecipientOfOrganization,
  queryOrganizationRecipients,
  createRequestsForOrganization,
  queryOrganizationRequests,
  createRecipientPlusRequest,
  closeOrganizationRequestWithOutcome,
  getInspectedRequestData,
} = require("./organizations");
var {
  getLanguageFrom,
  initialFromLastName,
  sendText,
} = require("./notifications");
var {
  sendBGC,
  sendBGCNextStep,
  sendBGCNextStepNudge,
  BGCwebhook,
} = require("./background");
var {
  createRequest,
  acceptRequest,
  cancelRequest,
  cancelHelperFromRequest,
  cancelHelpOffer,
  hasExceededCancelHelpLimit,
  closeRequest,
  sendThankYouText,
} = require("./requests");
var {
  generateGoogleMapsRoute,
  createCommunityDeliveryEvent,
  editCommunityDeliveryEvent,
  signUpForCommunityDeliveryEvent,
  getCommunityDeliveryEventDetailsForOrg,
  signUpPartnerVolunteerForCommunityDeliveryEvent,
  leaveCommunityDeliveryEvent,
  unassignCommunityDelivery,
  checkIntoCommunityDeliveryEvent,
} = require("./communityDelivery");
var {
  queryPendingRequests,
  queryCommunityDeliveryEvents,
  queryOpenRequests,
  queryPastRequests,
  queryNumberOfVolunteersNear,
  queryVolunteersNear,
  queryRequestRetries,
} = require("./queries");
var {
  saveStripeDonationDetails,
  getStripePaymentIntention,
} = require("./donations");
var {
  backfillEmails,
  migrateCancelled,
  migrateClosed,
  removeResolutionType,
  backfillEnterpriseConsoleAccess,
  backfillLyftCosts,
  backfillCDEventProperty,
} = require("./backfill");
var { dailystats, sendSlackMessage } = require("./bots");
var { handleUberWebhook } = require("./providers/uber");

var geohash;

var request;

const backendOptions = {
  projectId: "38c97c08-850c-4707-94b0-37015b180cd9",
  fallbackLng: "en-US",
  referenceLng: "en-US",
  version: "latest",
};

const isProduction =
  functions.config().gcp.project_id === "helping-hands-community";

const HIGH_MEMORY = "1GB";

const HIGH_MEMORY_OPTS = {
  memory: HIGH_MEMORY,
};

const HIGH_MEMORY_MIN_INSTANCES_15 = {
  memory: HIGH_MEMORY,
  minInstances: isProduction ? 15 : 1,
};

const HIGH_MEMORY_MIN_INSTANCES_10 = {
  memory: HIGH_MEMORY,
  // only update the instances
  minInstances: isProduction ? 10 : 1,
};

/**
 * Temporary - Backfills enterprise console access to oranization admins
 *
 * @param realrun specifies if the backfill should actually be executed
 * @returns Nothing
 */
exports.backfillEnterpriseConsoleAccess = functions.https.onRequest(
  (req, res) => {
    const realrun = req.query.realrun;
    const dryrun = !(realrun && realrun === "true");
    backfillEnterpriseConsoleAccess(db, admin, dryrun)
      .then(() => {
        return res.status(200).send();
      })
      .catch((err) => {
        console.error(err);
        return res.status(500).send();
      });
  }
);

/**
 * Temporary - Backfills emails in user obj
 *
 * @param realrun specifies if the backfill should actually be executed
 * @returns Nothing
 */
exports.httpBackfillEmails = functions.https.onRequest((req, res) => {
  const realrun = req.query.realrun;
  const dryrun = !(realrun && realrun === "true");
  backfillEmails(db, admin, dryrun)
    .then(() => {
      return res.status(200).send();
    })
    .catch((err) => {
      console.error(err);
      return res.status(500).send();
    });
});

/**
 * Temporary - Backfills cancelled requests with status 'closed' and outcome 'cancelled'
 *
 * @param realrun specifies if the backfill should actually be executed
 * @returns Nothing
 */
exports.httpBackfillCancelledRequests = functions.https.onRequest(
  (req, res) => {
    const realrun = req.query.realrun;
    const dryrun = !(realrun && realrun === "true");
    migrateCancelled(db, admin, dryrun)
      .then(() => {
        return res.status(200).send();
      })
      .catch((err) => {
        console.error(err);
        return res.status(500).send();
      });
  }
);

/**
 * Temporary - Backfills closed requests with outcome 'completed'
 *
 * @param realrun specifies if the backfill should actually be executed
 * @returns Nothing
 */
exports.httpBackfillClosedRequests = functions.https.onRequest((req, res) => {
  const realrun = req.query.realrun;
  const dryrun = !(realrun && realrun === "true");
  migrateClosed(db, admin, dryrun)
    .then(() => {
      return res.status(200).send();
    })
    .catch((err) => {
      console.error(err);
      return res.status(500).send();
    });
});

/**
 * Temporary - Removes resolutionType from requests
 *
 * @param realrun specifies if the backfill should actually be executed
 * @returns Nothing
 */
exports.httpBackfillRemoveResolutionType = functions.https.onRequest(
  (req, res) => {
    const realrun = req.query.realrun;
    const dryrun = !(realrun && realrun === "true");
    removeResolutionType(db, admin, dryrun)
      .then(() => {
        return res.status(200).send();
      })
      .catch((err) => {
        console.error(err);
        return res.status(500).send();
      });
  }
);

/**
 * Sends slack message to #dailystats with updated stats
 *
 * @returns Nothing
 */
exports.httpDailyStats = functions.https.onRequest((req, res) => {
  dailystats(db, admin)
    .then(() => {
      return res.status(200).send();
    })
    .catch((err) => {
      console.error(err);
      return res.status(500).send();
    });
});

/**
 * Sends updated user and request stats to #dailystats channel in slack
 *
 * @param None
 * @returns Webhook to slack api
 */
exports.sendSlackStats = functions.pubsub
  .schedule("every 12 hours from 01:00 to 23:59")
  .timeZone("UTC")
  .onRun((context) => {
    dailystats(db, admin);
  });

// Backup Database every day at 08:00 UTC
exports.scheduledFirestoreExport = functions.pubsub
  .schedule("every day 08:00")
  .timeZone("UTC")
  .onRun((context) => {
    const Firestore = require("@google-cloud/firestore");
    const firestore = new Firestore();
    const firestoreAdminClient = new Firestore.v1.FirestoreAdminClient();
    const firebaseProjectId = functions.config().gcp.project_id;
    const backupBucket = `gs://${firebaseProjectId}-backups`;

    const backupBotWebhookUrl = functions.config().backupbotwebhook.url;

    console.log(`Starting Firestore Backup Job for ${firebaseProjectId}`);

    const databaseName = firestoreAdminClient.databasePath(
      firebaseProjectId,
      "(default)"
    );

    return firestore
      .listCollections()
      .then((collections) => {
        collectionIds = collections.map((collection) => collection.id);
        return firestoreAdminClient
          .exportDocuments({
            name: databaseName,
            outputUriPrefix: backupBucket,
            // Leave collectionIds empty to export all collections
            // or set to a list of collection IDs to export,
            // collectionIds: ['users', 'posts']
            //
            // NB: Turns out that we need to exhaustively include all
            //   collection ids here, otherwise, the structure of the
            //   backup files do not reflect the collection namespaces
            //   and we can't import our daily backup into BigQuery
            //   for analytics and operations support.
            //
            //   This is really dumb. But oh well...
            collectionIds: collectionIds,
          })
          .then((responses) => {
            const response = responses[0];
            console.log(`Firestore Backup Job: ${response["name"]}`);
            // Send Slack success message (ignore errors)
            sendSlackMessage(
              backupBotWebhookUrl,
              `Successfully Started Backup Job: ${firebaseProjectId} => ${backupBucket}\nCollections: ${collectionIds.join(
                ", "
              )}\nJob: ${response["name"]}\n🍭`
            );
            return response;
          })
          .catch((err) => {
            console.error(err);
            // Send Slack failure message (ignore errors)
            sendSlackMessage(
              backupBotWebhookUrl,
              `Failed Starting Firestore Backup Job: ${firebaseProjectId} => ${backupBucket}\nCollections: ${collectionIds.join(
                ", "
              )}\n${err}\n🤕`
            );
            throw new Error(
              `Failed Starting Firestore Backup Job: ${firebaseProjectId} => ${backupBucket}\nCollections: ${collectionIds.join(
                ", "
              )}\n${err}\n🤕`
            );
          });
      })
      .catch((err) => {
        console.error(err);
        // Send Slack failure message (ignore errors)
        sendSlackMessage(
          backupBotWebhookUrl,
          `Firestore Backup Failed: Could not list collections for job: ${firebaseProjectId} => ${backupBucket}\n${err}\n🤕`
        );
        throw new Error(
          `Firestore Backup Failed! Could not list collections for job: ${firebaseProjectId} => ${backupBucket}\n${err}\n🤕`
        );
      });
  });

// Load daily backup into BigQuery every day at 09:00 UTC
// This must run on the same day UTC as scheduledFirestoreExport
exports.scheduledBigQueryImport = functions.pubsub
  .schedule("every day 09:00")
  .timeZone("UTC")
  .onRun((context) => {
    const firebaseProjectId = functions.config().gcp.project_id;
    const backupBucketName = `${firebaseProjectId}-backups`;

    // Look for all backups with today's date, older than 30 minutes
    const Moment = require("moment");
    const moment = new Moment();
    const todayDatePrefix = moment.utc().format("YYYY-MM-DDT");
    const thirtyMinutesAgo = moment.subtract({ minutes: 30 });

    const { Storage } = require("@google-cloud/storage");
    const storage = new Storage({ projectId: firebaseProjectId });
    const bucket = storage.bucket(backupBucketName);

    const etlBotWebhookUrl = functions.config().etlbotwebhook.url;

    console.log(
      `Starting Firestore Backup to BigQuery ETL Job: ${firebaseProjectId} for ${
        todayDatePrefix.split("T")[0]
      }`
    );

    return bucket
      .getFiles({
        autoPaginate: false,
        delimiter: "/",
        prefix: todayDatePrefix,
      })
      .then((data) => {
        // data[0] is files (should be an empty array here)
        // data[1] is nextQuery (should be null for this size of request)
        // data[2] is apiResponse (has kind and prefixes payload)
        const nextQuery = data[1];
        if (nextQuery) {
          throw new Error(
            `Received paginated response for prefix list of today's backups. This shouldn't happen. Cowardly refusing to continue!`
          );
        }
        const apiResponse = data[2];
        let todaysBackups = [];
        if (apiResponse.kind === "storage#objects") {
          todaysBackups = apiResponse.prefixes || todaysBackups;
        }
        console.log(
          `Found ${
            todaysBackups.length
          } backups from today: ${todaysBackups.join(", ")}`
        );
        let newestBackupPrefix = null;
        todaysBackups.forEach((prefix) => {
          // Backup format is a slightly modified ISO 8601
          // YYYY-MM-DDThh:mm:ss_${jobid}
          // Timestamp is from backup job start time
          // Note that we use UTC time and the timestamp is in
          //   UTC but it's missing the trailing Z so we add it
          let backupTime = `${prefix.split("_")[0]}Z`;
          if (
            !newestBackupPrefix ||
            Moment(backupTime).isAfter(
              Moment(`${newestBackupPrefix.split("_")[0]}Z`)
            )
          ) {
            if (Moment(backupTime).isBefore(thirtyMinutesAgo)) {
              newestBackupPrefix = prefix;
            }
          }
        });
        if (newestBackupPrefix) {
          console.log(
            `Found latest backup that is > 30 minutes old: ${newestBackupPrefix}`
          );
          return fetchNamespacesFromBackup(storage, bucket, newestBackupPrefix)
            .then((namespaces) => {
              // Got all the data we need to start the ETL jobs!
              // Send Slack success message (ignore errors)
              sendSlackMessage(
                etlBotWebhookUrl,
                `Beginning Firestore Backup to BigQuery ETL Job: gs://${backupBucketName}/${newestBackupPrefix} => ${firebaseProjectId} \nFound Namespaces: ${namespaces.join(
                  ", "
                )}\n🌶`
              );
              return importToBigQuery(
                storage,
                bucket,
                newestBackupPrefix,
                namespaces,
                firebaseProjectId
              );
            })
            .catch((err) => {
              console.error(err);
              // Send Slack failure message (ignore errors)
              sendSlackMessage(
                etlBotWebhookUrl,
                `Error Starting Firestore Backup to BigQuery ETL Job for ${firebaseProjectId}\nFailed to list namespaces for backup ${newestBackupPrefix} in Google Storage bucket: ${backupBucketName}\n${err}\n😞`
              );
              throw new Error(
                `Failed to list namespaces for backup ${newestBackupPrefix}\n${err}`
              );
            });
        } else {
          throw new Error(
            `Could not find any backups from today! Did the backup job run successfully?`
          );
        }
      })
      .catch((err) => {
        console.error(err);
        // Send Slack failure message (ignore errors)
        sendSlackMessage(
          etlBotWebhookUrl,
          `Error Starting Firestore Backup to BigQuery ETL Job for ${firebaseProjectId}\nFailed to list backups matching prefix ${todayDatePrefix} in Google Storage bucket: ${backupBucketName}\n${err}\n😞`
        );
        throw new Error(
          `Failed to list backups matching prefix ${todayDatePrefix} in Google Storage bucket: ${backupBucketName}\n${err}`
        );
      });
  });

function fetchNamespacesFromBackup(storage, bucket, backupPrefix) {
  // Each Namespace represents a collection we want to import into a
  //   table of the BigQuery dataset
  // These have the format kind_{resource_name}
  const etlBotWebhookUrl = functions.config().etlbotwebhook.url;

  return bucket
    .getFiles({
      autoPaginate: false,
      delimiter: "/",
      prefix: `${backupPrefix}all_namespaces/`,
    })
    .then((data) => {
      // data[0] is files (should be an empty array here)
      // data[1] is nextQuery (should be null for this size of request)
      // data[2] is apiResponse (has kind and prefixes payload)
      const nextQuery = data[1];
      if (nextQuery) {
        throw new Error(
          `Received paginated response for prefix list of backup namespaces. This shouldn't happen. Cowardly refusing to continue!`
        );
      }
      const apiResponse = data[2];
      let namespaces = [];
      if (apiResponse.kind === "storage#objects") {
        namespaces = apiResponse.prefixes.map((prefix) =>
          prefix.split("/")[2].replace(new RegExp("^kind_"), "")
        );
      }
      console.log(
        `Found ${namespaces.length} namespaces in backup: ${namespaces.join(
          ", "
        )}`
      );
      return namespaces;
    })
    .catch((err) => {
      console.error(err);
      // Send Slack failure message (ignore errors)
      sendSlackMessage(
        etlBotWebhookUrl,
        `BigQuery Import Failed! Error Fetching Namespaces in Firestore Backup ${backupPrefix} from Google Storage bucket!\n${err}\n😞`
      );
      throw new Error(
        `Failed to list namespaces in backup ${backupPrefix} in Google Storage bucket!\n${err}`
      );
    });
}

function importToBigQuery(storage, bucket, backupPrefix, namespaces) {
  // Subroutine to import from Google Storage to BigQuery
  // Import everything in given metadata file to the same BQ
  //   datasetId as the current firebaseProjectId (except dashes are
  //   replaced by underscores as required by BigQuery naming rules)
  // Import each namespace to a table of same name
  const firebaseProjectId = functions.config().gcp.project_id;

  const datasetId = firebaseProjectId.replace(/-/g, "_");

  const { BigQuery } = require("@google-cloud/bigquery");
  const bigquery = new BigQuery({ projectId: firebaseProjectId });

  const etlBotWebhookUrl = functions.config().etlbotwebhook.url;

  let jobs = [];
  jobs = namespaces.map((namespace) => {
    let metadataPath = constructMetadataPathFromBackupName(
      backupPrefix,
      namespace
    );
    jobMetadata = {
      sourceFormat: "DATASTORE_BACKUP",
      // Set the write disposition to overwrite existing table data.
      writeDisposition: "WRITE_TRUNCATE",
    };
    console.log(`Loading ${namespace} to table in dataset ${datasetId}...`);
    return bigquery
      .dataset(datasetId)
      .table(namespace)
      .load(bucket.file(metadataPath), jobMetadata);
  });
  request = request || require("request");
  Promise.all(jobs)
    .then((result) => {
      console.log(result);
      // Send Slack success message (ignore errors)
      sendSlackMessage(
        etlBotWebhookUrl,
        `Launched Firestore Backup to BigQuery ETL Jobs: ${firebaseProjectId} => ${datasetId}\nNamespaces => Tables:\n${namespaces.join(
          "\n"
        )}\n🚀`
      );
      return result;
    })
    .catch((err) => {
      console.error(err);
      // Send Slack failure message (ignore errors)
      sendSlackMessage(
        etlBotWebhookUrl,
        `Error Launching Firestore Backup to BigQuery ETL Jobs: ${firebaseProjectId} => ${datasetId}\nNamespaces => Tables:\n${namespaces.join(
          "\n"
        )}\n${err}\n💥`
      );
      throw new Error(
        `Failed to launch BigQuery jobs for ${firebaseProjectId} => ${datasetId} to load ${backupPrefix}!\n${err}`
      );
    });
}

function constructMetadataPathFromBackupName(backupPrefix, namespace) {
  return `${backupPrefix}all_namespaces/kind_${namespace}/all_namespaces_kind_${namespace}.export_metadata`;
}

/**
 * Sends background check to user
 *
 * @returns Nothing.
 */
exports.sendBGC = functions.https.onCall((data, context) => {
  return sendBGC(db, admin, data, context);
});

/**
 * Sends background check begin email to users who require it to see requests
 *
 * @returns Nothing.
 */
exports.sendBGCNextStep = functions.https.onCall((data, context) => {
  return sendBGCNextStep(db, admin, data, context);
});

/**
 * Sends a nudge to people who havent started their BGC 1 week after signing up
 *
 * @param None
 */
exports.sendBGCNextStepNudge = functions.pubsub
  .schedule("every 2 hours")
  .onRun((context) => {
    sendBGCNextStepNudge(db, admin);
  });

/**
 * Listens for checkr events
 *
 * @returns Nothing.
 */
exports.BGCwebhook = functions.https.onRequest((req, res) => {
  return BGCwebhook(db, admin, req, res);
});

/**
 * Sends custom thank you note text to volunteer
 *
 * @param helperPhone phone number of volunteer
 * @param requesterFirstName name of requester sending thank you message
 * @param requesterThanks string for thank you message
 * @returns Webhook to slack api
 */
exports.sendThankYouText = functions.https.onCall((data, context) => {
  return sendThankYouText(db, admin, data, context);
});

/**
 * Sends texts to volunteer and requesters on request accepted
 *
 * @param requestId ID of request to remove volunteer
 * @returns None
 */
exports.cancelHelperFromRequest = functions.https.onCall((data, context) => {
  return cancelHelperFromRequest(db, admin, data, context);
});

/**
 * Set status of a request to closed
 *
 * @param requestId ID of request to close
 * @returns None
 */
exports.closeRequest = functions.https.onCall((data, context) => {
  return closeRequest(db, admin, data, context);
});

/**
 * Updates a request's status to 'cancelled' if a requester decides to cancelt their request
 *
 * @param requestId The id of the request bieng updated. Path is: /requests/${requestId}
 * @returns Nothing.
 */
exports.cancelRequest = functions.https.onCall((data, context) => {
  return cancelRequest(db, admin, data, context);
});

/**
 * Get's the required data for the InspectedRequest component
 *
 * @param data = {location, id} where id is user id for specific user and location is the range within which we want to search for users
 * @returns Single user data if id is passed or list of users within range if location is passed.
 */
exports.getInspectedRequestData = functions.https.onCall((data, context) => {
  return getInspectedRequestData(db, admin, data, context);
});

/**
 * Creates new user object
 *
 * @param data contains user creation information
 * @returns Nothing.
 */
exports.createProfile = functions.https.onCall((data, context) => {
  return createProfile(db, admin, data, context);
});

/**
 * Updates user object
 *
 * @param data contains user update information
 * @returns Nothing.
 */
exports.updateProfile = functions.https.onCall((data, context) => {
  return updateProfile(db, admin, data, context);
});

/**
 * Checks if a user exists and is an org volunteer
 *
 * @param data contains an email and org id to check against
 * @returns user if exists
 */
exports.checkExistingOrgVolunteer = functions.https.onCall((data, context) => {
  return checkExistingOrgVolunteer(db, admin, data, context);
});

/**
 * Creates a request
 *
 * @param requesterUid ID of requester who this request is for
 * @param needs string specifiying needs of the user
 * @returns Nothing.
 */
exports.createRequest = functions.https.onCall((data, context) => {
  return createRequest(db, admin, data, context);
});

/**
 * Gets the requests that need to be completed by the user
 *
 * @returns Nothing.
 */
exports.queryPendingRequests = functions.https.onCall((data, context) => {
  return queryPendingRequests(db, admin, data, context);
});

/**
 * Gets community delivery events that the user has signed up for
 *
 * @returns Nothing.
 */
exports.queryCommunityDeliveryEvents = functions.https.onCall(
  (data, context) => {
    return queryCommunityDeliveryEvents(db, admin, data, context);
  }
);

/**
 * Gets the documents in the retries subcollection of a request
 * @param id the request id
 * @returns snaphsot data
 */
exports.queryRequestRetries = functions.https.onCall((data, context) => {
  return queryRequestRetries(db, admin, data, context);
});

/**
 * Gets the requests that a user has created that are open
 *
 * @returns Nothing.
 */
exports.queryOpenRequests = functions.https.onCall((data, context) => {
  return queryOpenRequests(db, admin, data, context);
});

/**
 * Gets the number of available volunteers in the area of the user
 *
 * @returns number.
 */
exports.queryNumberOfVolunteersNear = functions.https.onCall(
  (data, context) => {
    return queryNumberOfVolunteersNear(db, admin, data, context);
  }
);

/**
 * Gets available volunteers in the area of the user
 *
 * @returns array of volunteers.
 */
exports.queryVolunteersNear = functions.https.onCall((data, context) => {
  return queryVolunteersNear(db, admin, data, context);
});

/**
 * Gets the requests that a user has created that are closed
 *
 * @returns Nothing.
 */
exports.queryPastRequests = functions.https.onCall((data, context) => {
  return queryPastRequests(db, admin, data, context);
});

/**
 * Check if the volunteer has exceeded their limit to
 * cancel offers to help.
 *
 * @returns boolean (true if exceeded limit; false, otherwse).
 */
exports.hasExceededCancelHelpLimit = functions.https.onCall((data, context) => {
  return hasExceededCancelHelpLimit(db, admin, data, context);
});

/**
 * Volunteer says that they can't help anymore
 *
 * @returns Nothing.
 */
exports.cancelHelpOffer = functions.https.onCall((data, context) => {
  return cancelHelpOffer(db, admin, data, context);
});

/**
 * Accept a request to help with
 *
 * @param requestId ID of request that the user wants to accept
 * @returns Nothing.
 */
exports.acceptRequest = functions.https.onCall((data, context) => {
  return acceptRequest(db, admin, data, context);
});

function resetHelperCancellationCounters() {
  // Lazy initialization
  if (!admin) {
    admin = require("firebase-admin");
    admin.initializeApp();
  }
  db = db || admin.firestore();

  console.log("Resetting helper cancellation numbers...");
  db.collection("users")
    .get()
    .then((allUserDocs) => {
      let batch = db.batch();

      allUserDocs.forEach((userDocRef) => {
        batch.update(userDocRef.ref, {
          numCancellationsMadeToday: 0,
        });
      });

      return batch.commit();
    })
    .catch((error) => {
      console.log(error);
    });
}

exports.periodicallyResetHelperCancellationCounters = functions.pubsub
  .schedule("every day 00:00")
  .timeZone("UTC")
  .onRun((context) => {
    // We store the number of cancellations each helper has made in the past 24 hours.
    // We do this by storing a numCancellationsMadeToday field.
    // Every day, we reset this field to 0.
    resetHelperCancellationCounters();
  });

// DISABLED RE-ENGAGEMENT NOTIFICATION
// exports.sendVolunteerReminders = functions.pubsub
//   .schedule("every 10 minutes")
//   .onRun((context) => {
//     // Lazy initialization
//     if (!admin) {
//       admin = require("firebase-admin");
//       admin.initializeApp();
//     }
//     db = db || admin.firestore();
//
//     var date24hoursAgo = new Date(new Date().getTime() - 24 * 60 * 60 * 1000);
//     // Query the database for requests that have been in "pending_fulfillment" state
//     return db
//       .collection("requests")
//       .where("status", "==", "pending_fulfillment")
//       .where("timeAccepted", "<", date24hoursAgo)
//       .where("toBeFulfilledBy", "==", "VOLUNTEER")
//       .get()
//       .then((querySnapshot) => {
//         var requests = [];
//         querySnapshot.forEach((requestDoc) => {
//           if (
//             !requestDoc.data().closingVerifiedTextTimeSent &&
//             !requestDoc.data().reminderTextTimeSent
//           ) {
//             var promise = Promise.all([
//               db.collection("users").doc(requestDoc.data().helper).get(),
//               requestDoc.data().requesterFirstName,
//               db
//                 .collection("requests")
//                 .doc(requestDoc.id)
//                 .update({ reminderTextTimeSent: new Date() }),
//             ]);
//             requests.push(promise);
//           }
//         });
//         return Promise.all(requests);
//       })
//       .then((requests) => {
//         requests.forEach((request) => {
//           var requesterFirstName = request[1];
//           var volunteerPhoneNumber = request[0].data().phoneNumber;
//           const volunteerReminderMessage = volunteerReminder(
//             requesterFirstName
//           );
//           sendText(
//             volunteerReminderMessage,
//             twilioNumber,
//             volunteerPhoneNumber
//           );
//         });
//         return;
//       });
//   });

// Validate Address Field Helper
function checkField(name, value) {
  if (name && !value) {
    const message = `No value for ${name}`;
    console.error(message);
    throw new Error(message);
  }
  return value;
}

// Lookup Neighborhood Name against Google Maps API
// Returns 200 OK with neighborhood name
// 500 with contextual error message
exports.lookupNeighborhood = functions.https.onCall(async (data, context) => {
  var { lookupNeighborhood } = require("./address");

  return await lookupNeighborhood(data, googleMaps, googleMapsClient);
});

// Add location data (city, state, neightborhood) to the list of requests
// Returns 200 OK with requests and added location information
// 500 with contextual error message
exports.addLocationToRequests = functions.https.onCall(
  async (data, context) => {
    var { addLocationToRequests } = require("./address");

    return await addLocationToRequests(
      admin,
      db,
      data,
      googleMaps,
      googleMapsClient
    );
  }
);

// Validate Address against Google Maps API
// Returns 200 OK with validated Address or
// 500 with contextual error message
// Note (kelsey, 10/26/2021): we increased the memory to 1GB
// and min instances to 15 to support a delivery event, and
// now have updated the code so that we don't revert these
// changes in production
exports.validateAddress = functions
  .runWith(HIGH_MEMORY_MIN_INSTANCES_15)
  .https.onCall(async (data, context) => {
    var { validateAddress } = require("./address");

    return await validateAddress(data, googleMaps, googleMapsClient);
  });

exports.generateGoogleMapsRoute = functions.https.onCall((data, context) => {
  return generateGoogleMapsRoute(data, context);
});

exports.getOptimizedWaypointOrder = functions.https.onCall(
  async (data, context) => {
    var { getOptimizedWaypointOrder } = require("./communityDelivery");
    return await getOptimizedWaypointOrder(data, googleMaps, googleMapsClient);
  }
);

// --------------------------
// Donation related functions
// --------------------------
//
exports.saveStripeDonationDetails = functions.https.onCall((data, context) => {
  return saveStripeDonationDetails(db, data, context);
});

exports.getStripePaymentIntention = functions.https.onCall((data, context) => {
  return getStripePaymentIntention(data, context);
});

// --------------
// Admin functions
// --------------

exports.getUserCreationData = functions.https.onCall((data, context) => {
  return getUserCreationData(admin, data, context);
});

exports.getUsers = functions.https.onCall((data, context) => {
  return getUsers(db, admin, data, context);
});

exports.getAdmins = functions.https.onCall((data, context) => {
  return getAdmins(db, admin, data, context);
});

exports.makeUserAdmin = functions.https.onCall((data, context) => {
  return makeUserAdmin(admin, data, context);
});

exports.performAdminAction = functions.https.onCall((data, context) => {
  return performAdminAction(db, admin, data, context);
});

exports.createAdminRecord = functions.https.onCall((record, context) => {
  return createAdminRecord(db, admin, record, context);
});

exports.queryAdminRecords = functions.https.onCall((data, context) => {
  return queryAdminRecords(db, admin, data, context);
});

exports.closeRequestGivenOutcome = functions.https.onCall((data, context) => {
  return closeRequestGivenOutcome(db, admin, data, context);
});

exports.createOrganization = functions.https.onCall((data, context) => {
  return createOrganization(db, admin, data, context);
});

exports.editOrganization = functions.https.onCall((data, context) => {
  return editOrganization(db, admin, data, context);
});

exports.deleteOrganization = functions.https.onCall((data, context) => {
  return deleteOrganization(db, admin, data, context);
});

exports.queryOrganizations = functions.https.onCall((data, context) => {
  return queryOrganizations(db, admin, data, context);
});

exports.queryUserOrganizations = functions.https.onCall((data, context) => {
  return queryUserOrganizations(db, data, context);
});

exports.createVolunteerOfOrganization = functions.https.onCall(
  (data, context) => {
    return createVolunteerOfOrganization(db, admin, data, context);
  }
);

exports.editVolunteerOfOrganization = functions.https.onCall(
  (data, context) => {
    return editVolunteerOfOrganization(db, admin, data, context);
  }
);

exports.getUserOrgMemberships = functions.https.onCall((data, context) => {
  return getUserOrgMemberships(db, data, context);
});

exports.createRecipientOfOrganization = functions.https.onCall(
  (data, context) => {
    return createRecipientOfOrganization(db, data, context);
  }
);

exports.createRecipientPlusRequest = functions.https.onCall((data, context) => {
  return createRecipientPlusRequest(db, data, context);
});

exports.importRecipientsOfOrganization = functions.https.onCall(
  (data, context) => {
    return importRecipientsOfOrganization(db, data, context);
  }
);

exports.editRecipientOfOrganization = functions.https.onCall(
  (data, context) => {
    return editRecipientOfOrganization(db, data, context);
  }
);

exports.deleteRecipientOfOrganization = functions.https.onCall(
  (data, context) => {
    return deleteRecipientOfOrganization(db, data, context);
  }
);

exports.queryOrganizationRecipients = functions.https.onCall(
  (data, context) => {
    return queryOrganizationRecipients(db, data, context);
  }
);

exports.createRequestsForOrganization = functions.https.onCall(
  (data, context) => {
    return createRequestsForOrganization(db, data, context);
  }
);

exports.queryOrganizationRequests = functions
  .runWith(HIGH_MEMORY_OPTS)
  .https.onCall((data, context) => {
    return queryOrganizationRequests(db, data, context);
  });

exports.closeOrganizationRequestWithOutcome = functions.https.onCall(
  (data, context) => {
    return closeOrganizationRequestWithOutcome(db, admin, data, context);
  }
);

exports.createSupplier = functions.https.onCall((data, context) => {
  return createSupplier(db, data, context);
});

exports.querySuppliers = functions.https.onCall((data, context) => {
  return querySuppliers(db, data, context);
});

exports.deleteSupplier = functions.https.onCall((data, context) => {
  return deleteSupplier(db, data, context);
});

exports.editSupplier = functions.https.onCall((data, context) => {
  return editSupplier(db, data, context);
});

exports.importSuppliers = functions.https.onCall((data, context) => {
  return importSuppliers(db, data, context);
});

exports.querySupplierTimeZone = functions.https.onCall((data, context) => {
  return querySupplierTimeZone(db, data, context);
});

// pubsub functions don't run on emulators, this is a hack to be able to test it locally
if (functions.config().gcp.project_id === "helping-hands-development") {
  exports.httpMetrics = functions.https.onRequest((req, res) => {
    metrics.counter("test/counter").inc();
    metrics.histogram("test/histogram").update(Math.random() * 10);
    metrics.meter("test/meter").mark();
    return res.status(200).send();
  });

  exports.httpEmail = functions.https.onRequest((req, res) => {
    const email = require("./notifications/email");
    const { DEBUG_TEMPLATE } = require("./notifications/templates");
    email.send("tiffany@helpinghands.community", DEBUG_TEMPLATE);
    return res.status(200).send();
  });

  exports.httpEmail = functions.https.onRequest((req, res) => {
    const email = require("./notifications/email");
    const {
      NOREPLY_ADDRESS,
      requesterSubmittedEmailTemplate,
      volunteerAcceptedEmailTemplate,
      volunteerSignupEmailTemplate,
    } = require("./notifications/email_templates");
    if (!admin) {
      admin = require("firebase-admin");
      admin.initializeApp();
    }
    db = admin.firestore();
    const volunteerId = "volunteer_user_id_123456";
    const volunteer = {
      firstName: "Volunteer",
      lastName: "User",
    };
    const requesterId = "requester_user_id_123456";
    const requester = {
      firstName: "Requester",
      lastName: "User",
      phoneNumber: "+123456789",
    };
    const request = {
      needs: "Some bread, milk and eggs!",
    };
    const recipient = "emailtest@helpinghands.community";
    let promises = [];
    promises.push(
      email.send(
        db,
        volunteerId,
        recipient,
        NOREPLY_ADDRESS,
        volunteerSignupEmailTemplate(volunteer)
      )
    );
    promises.push(
      email.send(
        db,
        requesterId,
        recipient,
        NOREPLY_ADDRESS,
        requesterSubmittedEmailTemplate(requester)
      )
    );
    promises.push(
      email.send(
        db,
        requesterId,
        recipient,
        NOREPLY_ADDRESS,
        volunteerAcceptedEmailTemplate(volunteer, requester, request)
      )
    );
    promises.push(
      email.send(
        db,
        volunteerId,
        recipient,
        NOREPLY_ADDRESS,
        volunteerNewOpenRequestsTemplate(volunteer, requester)
      )
    );
    return Promise.all(promises).then(() => {
      return res.status(200).send();
    });
  });

  exports.httpMakeAdmins = functions.https.onRequest((req, res) => {
    makeAdminImpl(admin);
    return res.status(200).send();
  });
}

// create Lyft requests if we need one (asap by default)
exports.createLyftRequests = functions.pubsub
  .schedule("every 5 minutes")
  .onRun((context) => {
    var { createLyftRequests } = require("./providers/lyft");
    return createLyftRequests(db);
  });

// create uber requests if we need one (asap by default)
exports.createUberRequests = functions.pubsub
  .schedule("every 5 minutes")
  .onRun((context) => {
    var { createUberRequests } = require("./providers/uber");
    return createUberRequests(db);
  });

// create Axelhire requests if we need one (asap by default)
exports.createAxelHireRequests = functions.pubsub
  .schedule("every 5 minutes")
  .onRun((context) => {
    var { createAxelHireRequests } = require("./providers/axelhire");
    return createAxelHireRequests(db);
  });

// check status of any active rides
exports.checkUberOrderStatuses = functions.pubsub
  .schedule("every 5 minutes")
  .onRun((context) => {
    var { checkUberOrderStatuses } = require("./providers/uber");
    return checkUberOrderStatuses(db, context);
  });

exports.uberWebhook = functions.https.onRequest((req, res) => {
  return handleUberWebhook(db, req, res);
});

exports.markTripAsResubmitted = functions.https.onCall((data, context) => {
  var { markTripAsResubmitted } = require("./providers/uber");

  return markTripAsResubmitted(db, data, context);
});

exports.cancelUberTrip = functions.https.onCall((data, context) => {
  var { cancelUberTrip } = require("./providers/uber");

  return cancelUberTrip(db, data, context);
});

exports.cancelLyftPath = functions.https.onCall((data, context) => {
  var { cancelLyftPath } = require("./providers/lyft");

  return cancelLyftPath(db, data, context);
});

exports.lyftTest = functions.https.onCall((data, context) => {
  var { lyftTest } = require("./providers/test");

  return lyftTest(db, data, context);
});

exports.cancelLyftTrip = functions.https.onCall((data, context) => {
  var { cancelLyftTrip } = require("./providers/lyft");

  return cancelLyftTrip(db, data, context);
});

exports.getLyftOrderData = functions.https.onCall((data, context) => {
  var { getLyftOrderData } = require("./providers/lyft");

  return getLyftOrderData(db, data, context);
});

// check status of any active rides
exports.checkLyftOrderStatuses = functions.pubsub
  .schedule("every 5 minutes")
  .onRun((context) => {
    var { checkLyftOrderStatuses } = require("./providers/lyftStatus");
    return checkLyftOrderStatuses(db, context);
  });

if (!process.env.K_SERVICE || process.env.K_SERVICE === "app") {
  const webhook = require("./messenger/webhook");
  exports.app = functions.https.onRequest(webhook);
}

exports.lyftWebhook = functions.https.onRequest((req, res) => {
  var { handleLyftWebhook } = require("./providers/lyftStatus");

  return handleLyftWebhook(db, req, res);
});

//

// Note (kelsey, 10/26/2021): we increased the memory to 1GB
// and min instances to 10 to support a delivery event, and
// now have updated the code so that we don't revert these
// changes in production
exports.checkExistingOrgMember = functions
  .runWith(HIGH_MEMORY_MIN_INSTANCES_10)
  .https.onCall((data, context) => {
    const { checkExistingOrgMember } = require("./organizations");
    return checkExistingOrgMember(db, data, context);
  });

exports.getUberOrderData = functions.https.onCall((data, context) => {
  const { getUberOrderData } = require("./providers/uber");
  return getUberOrderData(db, data, context);
});

exports.cancelDeliveryEvent = functions.https.onCall((data, context) => {
  const { cancelDeliveryEvent } = require("./providers/uber");
  return cancelDeliveryEvent(db, data, context);
});

exports.createCommunityDeliveryEvent = functions.https.onCall(
  (data, context) => {
    return createCommunityDeliveryEvent(db, admin, data, context);
  }
);

exports.editCommunityDeliveryEvent = functions.https.onCall((data, context) => {
  return editCommunityDeliveryEvent(db, admin, data, context);
});

exports.signUpForCommunityDeliveryEvent = functions.https.onCall(
  (data, context) => {
    return signUpForCommunityDeliveryEvent(db, admin, data, context);
  }
);

exports.signUpPartnerVolunteerForCommunityDeliveryEvent = functions.https.onCall(
  (data, context) => {
    return signUpPartnerVolunteerForCommunityDeliveryEvent(
      db,
      admin,
      data,
      context
    );
  }
);

exports.getCommunityDeliveryEventDetailsForOrg = functions.https.onCall(
  (data, context) => {
    return getCommunityDeliveryEventDetailsForOrg(db, admin, data, context);
  }
);

exports.leaveCommunityDeliveryEvent = functions.https.onCall(
  (data, context) => {
    return leaveCommunityDeliveryEvent(db, admin, data, context);
  }
);

exports.unassignCommunityDelivery = functions.https.onCall((data, context) => {
  return unassignCommunityDelivery(db, admin, data, context);
});

exports.checkIntoCommunityDeliveryEvent = functions.https.onCall(
  (data, context) => {
    return checkIntoCommunityDeliveryEvent(db, admin, data, context);
  }
);

exports.backfillCDEventProperty = functions.https.onCall((data, context) => {
  return backfillCDEventProperty(db, admin, data, context);
});

exports.backfillLyftCosts = functions
  .runWith({ timeoutSeconds: 300 })
  .pubsub.schedule("every 12 hours from 01:00 to 23:59")
  .timeZone("UTC")
  .onRun((context) => {
    return backfillLyftCosts(db, admin, {}, context);
  });

/**
 * Sends reminder to volunteers who signed up for a community delivery event
 * Checks every 15 minutes for events that will be happening in the next 24 hours
 */
exports.checkToRemindVolunteers = functions.pubsub
  .schedule("every 15 minutes")
  .onRun((context) => {
    var { checkToRemindVolunteers } = require("./communityDelivery");
    return checkToRemindVolunteers(db, context);
  });
