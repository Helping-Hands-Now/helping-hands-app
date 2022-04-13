const functions = require("firebase-functions");

const crypto = require("crypto");
const express = require("express");
const cors = require("cors");
const app = express();
app.use(cors({ origin: true }));

const Config = require("./config.js");
const GraphApi = require("./graph-api.js");
const Receive = require("./receive.js");
const Store = require("./store.js");
const User = require("./user.js");

var users = {};

var { admin, db } = require("../admin");
const store = new Store(db);

app.use(verifyRequestSignature);

app.get("/hello-world", (req, res) => {
  return res.status(200).send("Hello World!");
});

app.post("/webhook", (req, res) => {
  const body = req.body;

  // Checks this is an event from a page subscription
  if (body.object === "page") {
    // Iterates over each entry - there may be multiple if batched
    body.entry.forEach(function (entry) {
      // Gets the message. entry.messaging is an array, but
      // will only ever contain one message, so we get index 0
      const webhookEvent = entry.messaging[0];
      console.log(webhookEvent);

      // Get the sender PSID
      const senderPsid = webhookEvent.sender.id;
      console.log("Sender PSID: " + senderPsid);

      const user = new User(senderPsid);
      return store
        .getUser(senderPsid)
        .then((userData) => {
          if (userData) {
            console.log("Found user in DB: " + userData.id);
            user.setUserData(userData);
            users[senderPsid] = user;
            const receiveMessage = new Receive(user, webhookEvent);
            return receiveMessage.handleMessage();
          } else {
            return GraphApi.getUserProfile(senderPsid)
              .then((fbProfile) => {
                console.log("Profile from Facebook:" + fbProfile);
                if (fbProfile) {
                  user.setProfile(fbProfile);
                }
                users[senderPsid] = user;
                return store.createUser(user);
              })
              .then((uid) => {
                console.log("Created new user " + uid);
                const receiveMessage = new Receive(user, webhookEvent);
                return receiveMessage.handleMessage();
              });
          }
        })
        .then((updatedField) => {
          if (updatedField) {
            store.updateUser(users[senderPsid], updatedField);
          }
          return;
        })
        .catch((error) => {
          console.log("Unable to find or create the user:", error);
        });
    });

    // Returns a '200 OK' response to all requests
    res.status(200).send("EVENT_RECEIVED");
  } else {
    // Returns a '404 Not Found' if event is not from a page subscription
    res.sendStatus(404);
  }
});

// Adds support for GET requests to our webhook
app.get("/webhook", (req, res) => {
  // Your verify token. Should be a random string.
  const VERIFY_TOKEN = functions.config().facebook.verify_token;

  // Parse the query params
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  // Checks if a token and mode is in the query string of the request
  if (mode && token) {
    // Checks the mode and token sent is correct
    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      // Responds with the challenge token from the request
      console.log("WEBHOOK_VERIFIED");
      res.status(200).send(challenge);
    } else {
      // Responds with '403 Forbidden' if verify tokens do not match
      res.sendStatus(403);
    }
  }
});

// Verify that the callback came from Facebook.
function verifyRequestSignature(req, res, next) {
  const signature = req.headers["x-hub-signature"];

  if (!signature) {
    console.error("Signature missing");
    res.sendStatus(403);
  } else {
    const elements = signature.split("=");
    const signatureHash = elements[1];
    const expectedHash = crypto
      .createHmac("sha1", functions.config().facebook.app_secret)
      .update(req.rawBody)
      .digest("hex");
    if (signatureHash !== expectedHash) {
      console.error("Signature mismatch");
      res.sendStatus(403);
    } else {
      return next();
    }
  }
}

// Check if all environment variables are set
// TODO: Enable this check once configs are on DEV
//Config.checkEnvVariables();

module.exports = app;
