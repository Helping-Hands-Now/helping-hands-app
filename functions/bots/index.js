var functions = require("firebase-functions");
var request;

function sendSlackMessage(webhookUrl, message) {
  request = request || require("request");
  request.post(webhookUrl, {
    json: {
      text: message,
    },
  });
}

function dailystats(db, admin) {
  // Lazy initialization
  if (!admin) {
    admin = require("firebase-admin");
    admin.initializeApp();
  }
  db = db || admin.firestore();

  const firebaseProjectId = functions.config().gcp.project_id;
  const slackStatsBotWebhook = functions.config().slackstatsbot.url;

  var total_users = 0;
  var total_beneficiaries = 0;
  var total_requesters = 0;
  var total_volunteers = 0;

  var total_requests_open = 0;
  var total_requests_pendingfulfillment = 0;
  var total_requests_closed = 0;

  // Request status
  const OPEN = "open";
  const PENDING = "pending_fulfillment";
  const CLOSED = "closed";

  let uniqueUIDs = new Set();

  return db
    .collection("users")
    .get()
    .then((querySnapshot) => {
      querySnapshot.forEach((snapshot) => {
        total_users += 1;
        if (
          snapshot.data().needsHelp &&
          snapshot.id === snapshot.data().createdBy
        ) {
          total_requesters += 1;
        }
        if (snapshot.data().canHelp) {
          total_volunteers += 1;
        }
        if (snapshot.id !== snapshot.data().createdBy) {
          total_beneficiaries += 1;
        }
      });

      return db.collection("requests").get();
    })
    .then((requests) => {
      requests.forEach((request) => {
        var requestStatus = request.data().status;
        switch (requestStatus) {
          case OPEN:
            total_requests_open += 1;
            break;
          case PENDING:
            total_requests_pendingfulfillment += 1;
            break;
          case CLOSED:
            total_requests_closed += 1;
            break;
          default:
            break;
        }
      });
      return;
    })
    .then(() => {
      sendSlackMessage(
        slackStatsBotWebhook,
        `${firebaseProjectId} - Slack Stats Bot\n
        Total Users: ${total_users}
        Total Requesters: ${total_requesters}
        Total Beneficiaries: ${total_beneficiaries}
        Total Volunteers: ${total_volunteers}\n
        Total Requests -- Open: ${total_requests_open}
        Total Requests -- Pending: ${total_requests_pendingfulfillment}
        Total Requests -- Fulfilled: ${total_requests_closed}
        🚀✨`
      );
      return;
    });
}

module.exports = {
  dailystats,
  sendSlackMessage,
};
