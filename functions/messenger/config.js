"use strict";

const functions = require("firebase-functions");
const crypto = require("crypto");

// Required environment variables
const ENV_VARS = ["page_access_token", "verify_token", "app_secret"];

module.exports = {
  // Messenger Platform API
  mPlatformDomain: "https://graph.facebook.com",
  mPlatformVersion: "v6.0",

  // Page and Application information
  pageAccesToken: functions.config().facebook.page_access_token,
  verifyToken: functions.config().facebook.verify_token,
  appSecret: functions.config().facebook.app_secret,

  // Preferred port (default to 3000)
  port: process.env.PORT || 3000,

  get mPlatfom() {
    return this.mPlatformDomain + "/" + this.mPlatformVersion;
  },

  // URL of your webhook endpoint
  get webhookUrl() {
    return this.appUrl + "/webhook";
  },

  get appSecretProof() {
    return crypto
      .createHmac("sha256", this.appSecret)
      .update(this.pageAccesToken)
      .digest("hex");
  },

  checkEnvVariables: function () {
    ENV_VARS.forEach(function (key) {
      if (!functions.config().facebook[key]) {
        console.log("WARNING: Missing the environment variable " + key);
      }
    });
  },
};
