var functions = require("firebase-functions"); // Need to initialize this no matter what
var metrics = require("./../metrics");
var { TEST_ADDRESS, TEMPLATE_MARKER } = require("./email_templates");
var util = require("util");

const sendEmailsToTestAddress = false;

// Validates email params without incurring SendGrid billing:
// https://sendgrid.com/docs/for-developers/sending-email/sandbox-mode/#using-sandbox-mode
const SANDBOX_CONFIG = {
  mail_settings: {
    sandbox_mode: {
      enable: true,
    },
  },
};

function validateTemplate(template) {
  /**
   * Verifies that the template doesn't contain any TEMPLATE_MARKER
   * @param {Object} template see email_template.js
   */

  function validateTemplateHelper(object) {
    if (object === undefined || object === null) {
      return true;
    }
    let isValid = true;
    for (const val of Object.values(object)) {
      if (val === TEMPLATE_MARKER) {
        isValid = false;
      } else if (val instanceof Object) {
        isValid = isValid && validateTemplateHelper(val);
      }
    }
    return isValid;
  }

  return validateTemplateHelper(template.dynamic_template_data);
}

function EmailClient() {
  this.sendgridMail = require("@sendgrid/mail");
  this.sendgridMail.setApiKey(functions.config().sendgrid.key);
  this.isEmulator =
    process.env.FUNCTIONS_EMULATOR === true ||
    process.env.FUNCTIONS_EMULATOR === "true";
  this.isDevelopment =
    functions.config().gcp.project_id === "helping-hands-development";
}

EmailClient.prototype.send = function (
  db,
  userId,
  toAddress,
  fromAddress,
  template,
  { sendAt } = {}
) {
  /**
   * @param {string} toAddress who to send the mail to
   * @param {string} fromAddress who the mail is from
   * @param {Object} template see email_template.js
   * @param {int} sendAt unix timestamp in seconds for when email should be scheduled
   * @return {Promise} success/error of async email send
   */
  if (!validateTemplate(template)) {
    return Promise.reject(
      new Error(
        "Template is invalid, contains " +
          TEMPLATE_MARKER +
          ": " +
          util.inspect(template)
      )
    );
  }

  if (this.isDevelopment && sendEmailsToTestAddress) {
    console.log(
      `Detecting development environment, using ${TEST_ADDRESS} instead of ${toAddress}`
    );
    toAddress = TEST_ADDRESS;
  }

  // params is an instance of Mail from https://github.com/sendgrid/sendgrid-nodejs/blob/master/packages/helpers/classes/mail.js
  params = {
    to: toAddress,
    from: fromAddress,
  };
  params = Object.assign(params, template);

  if (sendAt) {
    params.send_at = sendAt;
  }

  if (this.isEmulator) {
    params = Object.assign(params, SANDBOX_CONFIG);
    console.log(
      "Detecting emulator mode and using Sendgrid Sandbox. Validating email_template:" +
        template.email_template,
      params
    );
  } else {
    console.log(
      "Sending email_template:" + template.email_template + " to:" + toAddress
    );
  }
  return this.sendgridMail
    .send(params)
    .then(() => {
      metrics.meter("sendgrid/send_mail_success").mark();
      return;
    })
    .then(() => {
      currTime = new Date();
      db.collection("emails").add({
        userId: userId,
        createdAt: currTime,
        sendAt: sendAt || currTime,
        templateName: template.email_template,
        templateId: template.template_id,
      });
      return;
    })
    .catch((e) => {
      metrics.meter("sendgrid/send_mail_failed").mark();
      console.error(
        "Failed to send email_template: " +
          template.email_template +
          " to: " +
          toAddress,
        e.response ? e.response.body : "",
        e
      );
      return;
    });
};

function Singleton() {
  if (!this.instance) {
    this.instance = new EmailClient();
  }
}

Singleton.prototype.getInstance = function () {
  console.log("Fetching instantiated Email Singleton");
  return this.instance;
};

module.exports = new Singleton().getInstance();
