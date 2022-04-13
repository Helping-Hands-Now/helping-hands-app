/* eslint-disable promise/no-nesting */
var functions = require("firebase-functions");
var fetch = require("node-fetch");
var btoa = require("btoa");
var crypto = require("crypto");

const email = require("../notifications/email");
const {
  NOREPLY_ADDRESS,
  TEST_ADDRESS,
  backgroundCheckPassedEmailTemplate,
  backgroundCheckFailedEmailTemplate,
  backgroundCheckNudgeEmailTemplate,
} = require("../notifications/email_templates");

const firebaseProjectId = process.env.GCP_PROJECT || process.env.GCLOUD_PROJECT;

const prod_secret = functions.config().checkr.prod;
const dev_secret = functions.config().checkr.dev;

const test_bgc_live = false; // Enable to test with live checkr credentials on dev

let checkr_secret = null;

if (firebaseProjectId === "helping-hands-community" || test_bgc_live) {
  checkr_secret = prod_secret;
} else {
  checkr_secret = dev_secret;
}

const checkrVerificationFlag = "basic_criminal_plus_mvr";

function isValidSignature(request, res) {
  var headers = request.headers;
  var signature = headers["x-checkr-signature"];

  var hmac = crypto.createHmac("sha256", checkr_secret); // Create a sha256 hashed code using the secret key
  hmac.update(JSON.stringify(request.body), "utf8");
  var digest = hmac.digest("hex");

  return signature === digest; // If signature equals your hased code, return true
}

function createCheckrCandidate(email, db, uid) {
  return fetch("https://api.checkr.com/v1/candidates", {
    body: `email=${email}`,
    headers: {
      Authorization: `Basic ${btoa(checkr_secret)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    method: "POST",
  })
    .then((response) => response.text())
    .then((data) => {
      let returnedData = JSON.parse(data);
      checkrCandidateID = returnedData.id;
      return db
        .collection("users")
        .doc(uid)
        .update({
          checkrCandidateID: checkrCandidateID,
        })
        .then(() => {
          return checkrCandidateID;
        });
    });
}

function sendCheckrInvitation(candidateID, db, uid) {
  // Note (kelsey, 10/20/2021): we have updated the checkr background
  // check from basic_criminal to basic_criminal_plus_mvr. All new
  // HHC users will be triggered to go through this new flow of
  // basic criminal + MVR. To identify these users, we are setting
  // a new flag on the user checkrVerificationFlag to indicate they are
  // using the newer flow. For existing users, we are not doing
  // any special flow handling yet, so we will continue to allow
  // them to view the platform.
  console.log("Sending checkr invite with flag basic_criminal_plus_mvr");
  return fetch("https://api.checkr.com/v1/invitations", {
    body: `candidate_id=${candidateID}&package=${checkrVerificationFlag}`,
    headers: {
      Authorization: `Basic ${btoa(checkr_secret)}=`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    method: "POST",
  })
    .then((response) => response.text())
    .then((data) => {
      let returnedData = JSON.parse(data);
      return db
        .collection("users")
        .doc(uid)
        .update({
          checkrInvitationUrl: returnedData.invitation_url || null,
          checkrVerificationFlag: checkrVerificationFlag,
        });
    });
}

// USER CALLABLE
function sendBGC(db, admin, data, context) {
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
  let newCandidate = false;
  let checkrCandidateID = "";

  db.collection("users")
    .doc(uid)
    .get()
    .then(function (doc) {
      if (!doc.data().checkrCandidateID) {
        return createCheckrCandidate(doc.data().email, db, uid).then(
          (candidateID) => {
            return sendCheckrInvitation(candidateID, db, uid);
          }
        );
      } else {
        return sendCheckrInvitation(doc.data().checkrCandidateID, db, uid);
      }
    })
    .catch(function (error) {
      console.log("Error getting document:", error);
    });
}

/** checkrNudged may be:
 * initial (first prompt to user to fill out background check)
 * week (second prompt to user to fill out background check one week after first)
 **/

/**
 * Activates first time user sees the background check prompt and sends an email
 * to the user prompting them to complete the background check.
 *
 * @param userId
 * @returns None
 */
function sendBGCNextStep(db, admin, data, context) {
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

  return db
    .collection("users")
    .doc(uid)
    .get()
    .then(function (doc) {
      if (doc.data().checkrVerified === false && !doc.data().checkrNudged) {
        return db.collection("users").doc(uid).update({
          checkrNudged: "initial",
        });
      }
      return;
    })
    .catch(function (error) {
      console.log("Error getting document:", error);
    });
}

/**
 * Activates a week after the user has not completed their background check
 * and sends an email prompting them to complete the background check.
 *
 * @returns None
 */
function sendBGCNextStepNudge(db, admin) {
  // Lazy initialization
  if (!admin) {
    admin = require("firebase-admin");
    admin.initializeApp();
  }
  db = db || admin.firestore();

  var d = new Date();
  d.setDate(d.getDate() - 7);

  console.log("Sending BGC nudges");
  return db
    .collection("users")
    .where("checkrVerified", "==", false)
    .where("checkrNudged", "==", "initial")
    .where("timeCreated", "<", d)
    .get()
    .then(function (querySnapshot) {
      querySnapshot.forEach(function (doc) {
        return email
          .send(
            db,
            doc.id,
            doc.data().email,
            NOREPLY_ADDRESS,
            backgroundCheckNudgeEmailTemplate(doc.data())
          )
          .then(() => {
            return db.collection("users").doc(doc.id).update({
              checkrNudged: "week",
            });
          });
      });
      return;
    })
    .catch(function (error) {
      console.log("Error getting documents: ", error);
    });
}

function BGCwebhook(db, admin, req, res) {
  if (
    isValidSignature(req, res) ||
    (!test_bgc_live && firebaseProjectId === "helping-hands-development")
  ) {
    let type = req.body.type;
    let candidate_id = req.body.data.object.candidate_id;
    let status = req.body.data.object.status;
    let user = null;
    let user_id = null;

    // SUPPORTED TYPES
    // invitation.created
    // invitation.completed
    // invitation.expired
    // invitation.deleted
    // report.created
    // report.completed

    db.collection("users")
      .where("checkrCandidateID", "==", candidate_id)
      .get()
      .then(function (querySnapshot) {
        user = querySnapshot.docs[0].data();
        user_id = querySnapshot.docs[0].id;
        // capture whether this user has the checkrVerificationFlag set, and
        // therefore went through the full basic + MVR background check
        const mvrCheck =
          typeof user.checkrVerificationFlag !== "undefined" &&
          user.checkrVerificationFlag === checkrVerificationFlag;

        switch (type) {
          case "report.created":
            return db.collection("users").doc(querySnapshot.docs[0].id).update({
              checkrStage: type,
              checkrStatus: status,
            });
          case "report.completed":
            //
            return db
              .collection("users")
              .doc(querySnapshot.docs[0].id)
              .update({
                checkrStage: type,
                checkrStatus: status,
                checkrVerified: status === "clear" ? true : false,
                // adding this is so we can eventually move to this
                // boolean once existing users are updated to it, too.
                // we want to set to false here if the report failed.
                // if the report passed, then we only want to set it to true
                // if the user also 1.) has the verificationFlag property
                // and 2.) its value is set to basic_criminal_plus_mvr.
                // (if this is not the value, then it means they did not
                // initiate the background check with MVR).
                checkrMVRVerified: status === "clear" ? mvrCheck : false,
              });
          default:
            if (user.checkrStage !== "report.completed") {
              return db
                .collection("users")
                .doc(querySnapshot.docs[0].id)
                .update({
                  checkrStage: type,
                  checkrStatus: null,
                });
            }
            return;
        }
      })
      .then(function () {
        switch (type) {
          case "report.completed":
            if (status === "clear") {
              email.send(
                db,
                user_id,
                user.email,
                NOREPLY_ADDRESS,
                backgroundCheckPassedEmailTemplate(user)
              );
            } else if (status !== "consider") {
              email.send(
                db,
                user_id,
                user.email,
                NOREPLY_ADDRESS,
                backgroundCheckFailedEmailTemplate(user)
              );
            }
            return;
          default:
            return;
        }
      })
      .catch(function (error) {
        console.log("Error getting documents: ", error);
        console.log(
          "There was an error. Here is the request body: ",
          JSON.stringify(req.body)
        );
      });
  }
  res.status(200).send();
}

module.exports = {
  sendBGC,
  sendBGCNextStep,
  sendBGCNextStepNudge,
  BGCwebhook,
};
