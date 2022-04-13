/* eslint-disable promise/no-nesting */
var functions = require("firebase-functions");

const accountSid = functions.config().twilio.sid;
const authToken = functions.config().twilio.authtoken;
const twilioNumber = "+12057975648";

var metrics = require("./../metrics");
var twilio;
var twilioClient;

function createTwilioClient() {
  console.log("Creating new Twilio Client");
  twilio = twilio || require("twilio");
  return new twilio(accountSid, authToken);
}

// we need to save the fake locale in here so we can use it when sending these things
function sendText(message, toNumber) {
  // Lazy initialization
  twilioClient = twilioClient || createTwilioClient();

  if (!validE164(toNumber)) {
    throw new Error("Invalid number format");
  }

  const textMessage = {
    body: message,
    to: toNumber,
    from: twilioNumber,
  };

  return twilioClient.messages
    .create(textMessage)
    .then(() => {
      metrics.meter("twilio/create_message_success").mark();
      return;
    })
    .catch((e) => {
      metrics.meter("twilio/create_message_failed").mark();
      console.error("sendText failed, rethrowing error:", e);
      throw e;
    });
}

// TEXT MESSAGES
function TEXT_thankYou(requesterFirstName, requesterThanks) {
  return `[Helping Hands] ${requesterFirstName} wanted to send you a personal thank-you note! Here's what they said: "${requesterThanks}"`;
}

function TEXT_cancellationTextRequester(helperFirstName) {
  return `[Helping Hands] Unfortunately, ${helperFirstName} is unable to fulfill your request. Don’t worry — we’ve sent your request to other volunteers in your area so that someone else can help you soon.`;
}

function TEXT_cancellationTextCreatedBy(helperFirstName, requesterName) {
  return `[Helping Hands] Unfortunately, ${helperFirstName} is unable to fulfill ${requesterName}'s request. Don’t worry — we’ve sent your request to other volunteers in your area so that someone else can help you soon.`;
}

function TEXT_pairingTextRequester(helperName, helperPhone, helperAbout) {
  return `[Helping Hands] ${helperName} has volunteered to help you with your request! \nNo need to reply to this text — your volunteer will call you directly from ${helperPhone} to coordinate the details. If you don’t hear from ${helperName} soon, feel free to give them a call! ${
    helperAbout.length > 0
      ? "Here's an introduction from them: " + helperAbout
      : ""
  }`;
}

function TEXT_pairingTextCreatedBy(
  creatorName,
  requesterName,
  helperName,
  helperPhone,
  helperAbout
) {
  return `[Helping Hands] Hi ${creatorName} - ${helperName} has volunteered to help ${requesterName} with their request! \nNo need to reply to this text — ${requesterName}'s volunteer will call ${requesterName} directly from ${helperPhone} to coordinate the details. If you want to talk to ${helperName}, feel free to give them a call! ${
    helperAbout.length > 0
      ? "Here's an introduction from them: " + helperAbout
      : ""
  }`;
}

function TEXT_pairingTextVolunteer(
  requesterName,
  requesterPhone,
  volunteerName,
  creatorName,
  creatorPhone
) {
  return `[Helping Hands] Hi ${volunteerName} — thanks for volunteering to help ${requesterName}! Please call them as soon as possible at ${requesterPhone} to coordinate how you can help. ${
    creatorName && creatorPhone
      ? "Having trouble reaching them? Contact " +
        creatorName +
        " at " +
        creatorPhone +
        "."
      : ""
  }
  \n\n Pro tip: Ask for their address so that you know where to deliver.`;
}

function TEXT_closeTextRequester(helperFirstName) {
  return `[Helping Hands] ${helperFirstName} has completed your request! Need more help? Submit another request at https://www.helpinghands.community`;
}

function TEXT_closeTextCreatedBy(helperFirstName, requesterName) {
  return `[Helping Hands] ${helperFirstName} has completed ${requesterName}'s request! Need more help? Submit another request at https://www.helpinghands.community`;
}

function TEXT_closeTextHelper(requesterFirstName) {
  return `[Helping Hands] ${requesterFirstName} has marked that you completed their request. Thank you for your help!`;
}

function TEXT_requesterCancelledHelper(requesterFirstName) {
  return `[Helping Hands] ${requesterFirstName} has said that they are requesting help from a different volunteer instead. Accordingly, we are removing this request from your list of pending helper runs. If you believe this was an error, feel free to re-accept their request on https://helpinghands.community/requests.`;
}

function TEXT_volunteerReminder(requesterFirstName) {
  return `[Helping Hands] It's been a day since you accepted ${requesterFirstName}'s request for help. This is a reminder to fulfill their request, if you haven't already. If you've already completed their request, feel free to ignore this message.`;
}

function TEXT_communityDeliverySignUpConfirmation(eventTime) {
  return `[Helping Hands] You're confirmed to volunteer with Helping Hands Community on ${eventTime}. Go to My Dashboard for details. https://helpinghands.community/dashboard \nReply STOP to opt out`;
}

function TEXT_communityDeliveryReminder(eventTime) {
  return `[Helping Hands] You're volunteering with Helping Hands Community on ${eventTime}. Go to My Dashboard for details. https://helpinghands.community/dashboard \nReply STOP to opt out`;
}

// Library Methods

// Validate E164 format
// NOTE: duplicated in organizations/index.js
function validE164(num) {
  return /^\+?[1-9]\d{1,14}$/.test(num);
}

function getLanguageFrom(languages) {
  // TODO maybe map language so that volunteer and requester are getting things in same
  // language?
  if (languages && languages.length) {
    return languages[0];
  }

  // no language. use english
  return "en_US";
}

function initialFromLastName(lastName) {
  if (lastName.length === 0) {
    return "";
  }

  return lastName[0] + ".";
}

module.exports = {
  getLanguageFrom,
  initialFromLastName,
  sendText,
  TEXT_thankYou,
  TEXT_cancellationTextRequester,
  TEXT_cancellationTextCreatedBy,
  TEXT_pairingTextRequester,
  TEXT_pairingTextCreatedBy,
  TEXT_pairingTextVolunteer,
  TEXT_closeTextRequester,
  TEXT_closeTextCreatedBy,
  TEXT_closeTextHelper,
  TEXT_requesterCancelledHelper,
  TEXT_communityDeliverySignUpConfirmation,
  TEXT_communityDeliveryReminder,
};
