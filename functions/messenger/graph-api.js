"use strict";

// Imports dependencies
const request = require("request"),
  camelCase = require("camelcase"),
  config = require("./config");

module.exports = class GraphApi {
  static callSendAPI(senderPsid, response) {
    // Send the HTTP request to the Messenger Platform

    let requestBody = {
      recipient: {
        id: senderPsid,
      },
      message: response,
    };

    request(
      {
        uri: `${config.mPlatfom}/me/messages`,
        qs: {
          access_token: config.pageAccesToken,
          appsecret_proof: config.appSecretProof,
        },
        method: "POST",
        json: requestBody,
      },
      (error) => {
        if (error) {
          console.error("Unable to send message:", error);
        } else {
          console.log("Message sent!");
        }
      }
    );
  }

  static getUserProfile(senderPsid) {
    return this.callUserProfileAPI(senderPsid)
      .then((userProfile) => {
        for (const key in userProfile) {
          const camelizedKey = camelCase(key);
          const value = userProfile[key];
          delete userProfile[key];
          userProfile[camelizedKey] = value;
        }
        return userProfile;
      })
      .catch((error) => {
        console.log("Fetch failed:", error);
      });
  }

  static callUserProfileAPI(senderPsid) {
    return new Promise(function (resolve, reject) {
      let body = [];

      // Send the HTTP request to the Graph API
      request({
        uri: `${config.mPlatfom}/${senderPsid}`,
        qs: {
          access_token: config.pageAccesToken,
          appsecret_proof: config.appSecretProof,
          fields: "first_name, last_name, gender, locale, timezone",
        },
        method: "GET",
      })
        .on("response", function (response) {
          if (response.statusCode !== 200) {
            console.log(response);
            reject(Error(response.statusCode));
          }
        })
        .on("data", function (chunk) {
          body.push(chunk);
        })
        .on("error", function (error) {
          console.error("Unable to fetch profile:" + error);
          reject(Error("Network Error"));
        })
        .on("end", () => {
          body = Buffer.concat(body).toString();
          // console.log(JSON.parse(body));

          resolve(JSON.parse(body));
        });
    });
  }

  static callNLPConfigsAPI() {
    // Send the HTTP request to the Built-in NLP Configs API
    // https://developers.facebook.com/docs/graph-api/reference/page/nlp_configs/

    console.log(`Enable Built-in NLP for Page ${config.pageId}`);
    request(
      {
        uri: `${config.mPlatfom}/me/nlp_configs`,
        qs: {
          access_token: config.pageAccesToken,
          appsecret_proof: config.appSecretProof,
          nlp_enabled: true,
        },
        method: "POST",
      },
      (error, _res, body) => {
        if (!error) {
          console.log("Request sent:", body);
        } else {
          console.error("Unable to activate built-in NLP:", error);
        }
      }
    );
  }
};
