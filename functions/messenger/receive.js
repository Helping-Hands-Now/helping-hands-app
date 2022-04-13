"use strict";

const GraphApi = require("./graph-api.js");
const Response = require("./response.js");

module.exports = class Receive {
  constructor(user, webhookEvent) {
    this.user = user;
    this.webhookEvent = webhookEvent;
    this.updatedField = null;
  }

  handleMessage() {
    let event = this.webhookEvent;

    let responses;

    try {
      if (event.message) {
        let message = event.message;

        if (message.quick_reply) {
          responses = this.handleQuickReply();
        } else if (message.attachments) {
          responses = this.handleAttachmentMessage();
        } else if (message.text) {
          responses = this.handleTextMessage();
        }
      } else if (event.postback) {
        responses = this.handlePostback();
      } else if (event.referral) {
        responses = this.handleReferral();
      }
    } catch (error) {
      console.error(error);
      responses = {
        text: `An error has occured: '${error}'. We have been notified and \
        will fix the issue shortly!`,
      };
    }

    console.log(responses);

    if (Array.isArray(responses)) {
      let delay = 0;
      for (let response of responses) {
        this.sendMessage(response, delay * 2000);
        delay++;
      }
    } else {
      this.sendMessage(responses);
    }

    return this.updatedField;
  }

  // Handles mesage events with quick replies
  handleQuickReply() {
    // Get the payload of the quick reply
    let payload = this.webhookEvent.message.quick_reply.payload;

    return this.handlePayload(payload);
  }

  // Handles messages events with text
  handleTextMessage() {
    console.log(
      "Received text:",
      `${this.webhookEvent.message.text} for ${this.user.psid}`
    );

    // check greeting is here and is confident
    let greeting = this.firstEntity(this.webhookEvent.message.nlp, "greetings");
    let email = this.firstEntity(this.webhookEvent.message.nlp, "email");
    let phoneNumber = this.firstEntity(
      this.webhookEvent.message.nlp,
      "phone_number"
    );

    let message = this.webhookEvent.message.text.trim().toLowerCase();
    let payload = this.webhookEvent.message.payload;

    let response;
    if (
      (greeting && greeting.confidence > 0.8) ||
      message.includes("get started") ||
      message.includes("start over")
    ) {
      response = this.handlePayload("GET_STARTED");
    } else if (
      !this.user.needsHelp &&
      (message.includes("need help") ||
        message.includes("needs help") ||
        message.includes("please help"))
    ) {
      response = this.handlePayload("NEEDS_HELP");
    } else if (
      !this.user.canHelp &&
      (message.includes("can help") ||
        message.includes("want to help") ||
        message.includes("like to help"))
    ) {
      response = this.handlePayload("CAN_HELP");
    } else if (
      message.includes("status") ||
      message.includes("info") ||
      message.includes("menu")
    ) {
      response = this.handlePayload("CHECK_STATUS");
    } else if (this.maybeZipCode(message)) {
      response = this.handleZipCode(message);
    } else if (phoneNumber && phoneNumber.confidence > 0.9) {
      response = this.handlePhoneNumber(phoneNumber.value);
    } else if (email && email.confidence > 0.9) {
      response = this.handleEmail(email.value);
    } else if (payload) {
      response = this.handlePayload(payload);
    } else {
      response = this.handleFallback(message);
    }

    return response;
  }

  // Handles mesage events with attachments
  handleAttachmentMessage() {
    let response;

    // Get the attachment
    let attachment = this.webhookEvent.message.attachments[0];
    console.log("Received attachment:", `${attachment} for ${this.user.psid}`);

    return response;
  }

  // Handles postbacks events
  handlePostback() {
    let postback = this.webhookEvent.postback;
    // Check for the special Get Starded with referral
    let payload;
    if (postback.referral && postback.referral.type === "OPEN_THREAD") {
      payload = postback.referral.ref;
    } else {
      // Get the payload of the postback
      payload = postback.payload;
    }
    return this.handlePayload(payload.toUpperCase());
  }

  // Handles referral events
  handleReferral() {
    // Get the payload of the postback
    let payload = this.webhookEvent.referral.ref.toUpperCase();

    return this.handlePayload(payload);
  }

  handlePhoneNumber(message) {
    console.log("Received Phone Number:", `${message} for ${this.user.psid}`);

    let response;

    var formatted = this.formatPhoneNumber(message);
    if (formatted) {
      response = Response.genQuickReply(
        `Can you confirm this is your phone number: ${formatted}?`,
        [
          {
            title: "Yes",
            payload: `CONFIRMED_PHONE_NUMBER_${message}`,
          },
          {
            title: "No",
            payload: "REJECTED_PHONE_NUMBER",
          },
        ]
      );
    } else {
      response = Response.genText(
        "Sorry, I don't recognize the phone number you sent. Please double check that it includes the area code."
      );
    }
    return response;
  }

  handleZipCode(message) {
    console.log("Received Zip Code:", `${message} for ${this.user.psid}`);

    let response;

    if (this.validZipCode(message)) {
      response = Response.genQuickReply(
        `Can you confirm this is your zip code: ${message}?`,
        [
          {
            title: "Yes",
            payload: `CONFIRMED_ZIP_CODE_${message}`,
          },
          {
            title: "No",
            payload: "REJECTED_ZIP_CODE",
          },
        ]
      );
    } else {
      response = Response.genText(
        "Sorry, but I don't recognize the zip code you sent. Please double check that it is a valid 5-digit postal code."
      );
    }
    return response;
  }

  handleEmail(message) {
    console.log("Received Email:", `${message} for ${this.user.psid}`);

    return Response.genQuickReply(
      `Can you confirm this is your email: ${message}?`,
      [
        {
          title: "Yes",
          payload: `CONFIRMED_EMAIL_${message}`,
        },
        {
          title: "No",
          payload: "REJECTED_EMAIL",
        },
      ]
    );
  }

  handlePayload(payload) {
    console.log("Received Payload:", `${payload} for ${this.user.psid}`);

    let response;

    // Set the response based on the payload
    if (payload === "GET_STARTED") {
      response = [
        Response.genText(
          `Hi ${this.user.firstName}. Helping Hands facilitates free delivery for your community during COVID-19.\n\nYou can learn more about how it works here: https://helpinghands.community/howitworks`
        ),
        Response.genQuickReply(
          "Do you or someone you know need help? Are you healthy and can volunteer to deliver?",
          [
            {
              title: "Request Help",
              payload: "NEEDS_HELP",
            },
            {
              title: "I Can Help",
              payload: "CAN_HELP",
            },
          ]
        ),
      ];
    } else if (payload === "CAN_HELP") {
      this.user.canHelp = true;
      this.user.needsHelp = false;
      this.user.needs = "";
      this.updatedField = { canHelp: true, needsHelp: false, needs: "" };
      response = this.handleNextReply();
    } else if (payload === "NEEDS_HELP") {
      this.user.needsHelp = true;
      this.user.canHelp = false;
      this.user.needs = "";
      this.updatedField = { needsHelp: true, canHelp: false, needs: "" };
      response = this.handleNextReply();
    } else if (payload === "REQUESTING_FOR_SELF") {
      this.user.requestingFor = "self";
      this.updatedField = { requestingFor: this.user.requestingFor };
      response = this.handleNextReply();
    } else if (payload === "REQUESTING_FOR_OTHER") {
      this.user.requestingFor = "other";
      this.updatedField = { requestingFor: this.user.requestingFor };
      response = this.handleNextReply();
    } else if (payload && payload.includes("CONFIRMED_NEEDS")) {
      this.user.needs = payload.substring("CONFIRMED_NEEDS".length + 1);
      this.updatedField = { needs: this.user.needs };
      response = this.handleNextReply();
    } else if (payload === "REJECTED_NEEDS") {
      this.user.needs = "";
      response = Response.genText(
        "Glad we double checked. Please tell us your needs again."
      );
    } else if (payload && payload.includes("CONFIRMED_EMAIL")) {
      this.user.email = payload.substring("CONFIRMED_EMAIL".length + 1);
      this.updatedField = { email: this.user.email };
      response = this.handleNextReply();
    } else if (payload && payload === "REJECTED_EMAIL") {
      this.user.email = "";
      response = Response.genText(
        "Glad we double checked. Please tell us your email again."
      );
    } else if (payload && payload.includes("CONFIRMED_PHONE_NUMBER")) {
      this.user.phoneNumber = payload.substring(
        "CONFIRMED_PHONE_NUMBER".length + 1
      );
      this.updatedField = { phoneNumber: this.user.phoneNumber };
      response = this.handleNextReply();
    } else if (payload && payload === "REJECTED_PHONE_NUMBER") {
      this.user.phoneNumber = "";
      response = Response.genText(
        "Glad we double checked. Please tell us your phone number again."
      );
    } else if (payload && payload.includes("CONFIRMED_ZIP_CODE")) {
      this.user.zipCode = payload.substring("CONFIRMED_ZIP_CODE".length + 1);
      this.updatedField = { zipCode: this.user.zipCode };
      response = this.handleNextReply();
    } else if (payload === "REJECTED_ZIP_CODE") {
      this.user.zipCode = "";
      response = Response.genText(
        "Glad we double checked. Please tell us your zip code again."
      );
    } else if (payload === "HOW_IT_WORKS") {
      response = Response.genText(
        "Learn more about how Helping Hands works here: https://www.helpinghands.community/howitworks"
      );
    } else if (payload === "CHECK_STATUS") {
      response = this.handleNextReply();
    } else if (payload === "CONFIRM_ALL") {
      const { signOff } = this.statusMessages();
      response = Response.genText(signOff);
    } else {
      // Fallback message
      response = this.handleFallback("");
    }

    return response;
  }

  pronouns() {
    const personal = this.user.requestingFor === "self" ? "you" : "they";
    const demonstrative = this.user.requestingFor === "self" ? "you" : "them";
    const possessive = this.user.requestingFor === "self" ? "your" : "their";

    return {
      personal: personal,
      demonstrative: demonstrative,
      possessive: possessive,
    };
  }

  handleNextReply() {
    let response;
    const pronouns = this.pronouns();

    if (this.user.needsHelp && !this.user.requestingFor) {
      response = Response.genQuickReply(
        "Do you need help for yourself or someone else?",
        [
          {
            title: "Myself",
            payload: "REQUESTING_FOR_SELF",
          },
          {
            title: "Someone else",
            payload: "REQUESTING_FOR_OTHER",
          },
        ]
      );
    } else if (!this.user.email) {
      let title;
      let subject;
      if (this.user.needsHelp) {
        title = `Let's see if we can find ${pronouns.demonstrative} some help.\n\n`;
        subject = "someone to help";
      } else if (this.user.canHelp) {
        title = "Thank you for volunteering to help.\n\n";
        subject = "someone who needs help";
      } else {
        title = "";
        subject = "someone";
      }
      response = Response.genText(
        `${title}We need your contact information so we can reach out when we find ${subject}. What is your email?`
      );
    } else if (!this.user.zipCode) {
      if (this.user.needsHelp && this.user.requestingFor === "other") {
        response = Response.genText(`Great. What is your zip code?`);
      } else {
        response = Response.genText(
          `Great. We would like to match you with someone near your area. What is your zip code?`
        );
      }
    } else if (!this.user.phoneNumber) {
      response = Response.genText("Got it. What is your phone number?");
    } else if (this.user.needsHelp && !this.user.needs) {
      response = Response.genText(
        `Please give us an idea of what ${pronouns.personal} need help with.`
      );
    } else {
      const { greeting, providedMessage } = this.statusMessages();
      return Response.genQuickReply(
        `${greeting}\n\n${providedMessage}\n\nDoes this look correct? If not, you can update it.`,
        [
          {
            title: "Looks Good",
            payload: "CONFIRM_ALL",
          },
          {
            title: "Change Email",
            payload: "REJECTED_EMAIL",
          },
          {
            title: "Change Phone",
            payload: "REJECTED_PHONE_NUMBER",
          },
          {
            title: "Change Zip",
            payload: "REJECTED_ZIP_CODE",
          },
        ]
      );
    }
    return response;
  }

  handleFallback(message) {
    if (this.user.needsHelp && !this.user.needs) {
      return Response.genQuickReply(
        `You wrote you need help with "${message}". Is this correct?`,
        [
          {
            title: "Yes",
            payload: `CONFIRMED_NEEDS_${message}`,
          },
          {
            title: "No",
            payload: "REJECTED_NEEDS",
          },
        ]
      );
    } else {
      return Response.genQuickReply(
        "Sorry, but I don’t recognize your message. What can we do to help you today?",
        [
          {
            title: "Get Started",
            payload: "GET_STARTED",
          },
          {
            title: "How it Works",
            payload: "HOW_IT_WORKS",
          },
          {
            title: "Check Status",
            payload: "CHECK_STATUS",
          },
        ]
      );
    }
  }

  sendMessage(response, delay = 0) {
    // Check if there is delay in the response
    if ("delay" in response) {
      delay = response["delay"];
      delete response["delay"];
    }

    setTimeout(() => GraphApi.callSendAPI(this.user.psid, response), delay);
  }

  firstEntity(nlp, name) {
    return nlp && nlp.entities && nlp.entities[name] && nlp.entities[name][0];
  }

  validPhoneNumber(str) {
    //Filter only numbers from the input
    let cleaned = ("" + str).replace(/\D/g, "");

    //Check if the input is of correct
    return cleaned.match(/^(1|)?(\d{3})(\d{3})(\d{4})$/);
  }

  formatPhoneNumber(str) {
    let match = this.validPhoneNumber(str);
    if (match) {
      //Remove the matched extension code
      //Change this to format for any country code.
      let intlCode = match[1] ? "+1 " : "";
      return [intlCode, "(", match[2], ") ", match[3], "-", match[4]].join("");
    }

    return null;
  }

  maybeZipCode(str) {
    return Number(str) && str.length <= 6;
  }

  validZipCode(str) {
    return Number(str) && str.length === 5;
  }

  encodeQueryData(data) {
    const ret = [];
    for (let d in data) {
      ret.push(encodeURIComponent(d) + "=" + encodeURIComponent(data[d]));
    }
    return ret.join("&");
  }

  link() {
    let link = "http://helpinghands.community";
    if (this.user.needsHelp) {
      link = `${link}/help`;
    } else if (this.user.canHelp) {
      link = `${link}/give`;
    }

    let params = {};
    if (this.user.firstName) {
      params["first"] = this.user.firstName;
    }
    if (this.user.lastName) {
      params["last"] = this.user.lastName;
    }
    if (this.user.zipCode) {
      params["zip"] = this.user.zipCode;
    }
    if (this.user.phoneNumber) {
      params["phone"] = this.user.phoneNumber;
    }

    const queryString = this.encodeQueryData(params);
    link = `${link}?${queryString}`;

    return link;
  }

  statusMessages() {
    let greeting = `Hi ${this.user.firstName}`;
    if (this.user.needsHelp) {
      if (this.user.requestingFor === "self") {
        greeting = `${greeting}. You said you need help`;
      } else if (this.user.requestingFor === "other") {
        greeting = `${greeting}. You said someone you know needs help`;
      }
      if (this.user.needs) {
        greeting = `${greeting} with "${this.user.needs}".`;
      } else {
        greeting = `${greeting}.`;
      }
    } else if (this.user.canHelp) {
      greeting = `${greeting}. Thank you for offering to help.`;
    }

    let providedInfo = [];
    if (this.user.phoneNumber) {
      const formattedPhoneNumber = this.formatPhoneNumber(
        this.user.phoneNumber
      );
      providedInfo.push(`Phone: ${formattedPhoneNumber}`);
    }

    if (this.user.email) {
      providedInfo.push(`Email: ${this.user.email}`);
    }

    if (this.user.zipCode) {
      providedInfo.push(`Zip: ${this.user.zipCode}`);
    }

    let providedMessage = "";
    if (providedInfo.length > 0) {
      providedInfo.unshift("Here's the contact information you provided:");
      providedMessage = providedInfo.join("\n");
    }

    let signOff = "";
    let createAccount = "";
    if (this.user.needsHelp) {
      createAccount = `Please go to ${this.link()} to finish creating your request so you can see the status of it on your dashboard.`;
      signOff = `Thank you. The information you provided let's us start looking for volunteers in your area. ${createAccount}`;
    } else if (this.user.canHelp) {
      createAccount = `Please go to ${this.link()} to finish creating your profile and access your dashboard where you'll be able to see all the requests in your local area.`;
      signOff = `Thank you. The information you provided let's us start matching you with someone who needs help. ${createAccount}`;
    } else {
      createAccount = `Please go to ${this.link()} to finish creating your account so you can access our dashboard.`;
      signOff = `Thank you. The information you provided helps us connect you with someone. ${createAccount}`;
    }

    return {
      greeting: greeting,
      providedMessage: providedMessage,
      signOff: signOff,
    };
  }
};
