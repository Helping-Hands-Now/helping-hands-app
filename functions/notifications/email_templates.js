var { parsePhoneNumberFromString } = require("libphonenumber-js");

// Email Addresses
const NOREPLY_ADDRESS = "noreply@helpinghands.community";
const INFO_ADDRESS = "info@helpinghands.community";
const TEST_ADDRESS = "emailtest@helpinghands.community"; // Used to receive test emails in duck.helpinghands.community environment at https://groups.google.com/a/helpinghands.community/forum/#!forum/emailtest

// Email Templates
const DEBUG_TEMPLATE = {
  email_template: "debug",
  subject: "DEBUG",
  html: "<b>Hello World!</b>",
};

const TEMPLATE_MARKER = "[REPLACEME]";

const BACKGROUND_CHECK_PASSED_TEMPLATE = {
  email_template: "background_check_passed",
  template_id: "d-57593f2b0f324012adcf041947a6a412",
  categories: ["background_check_passed"],
  dynamic_template_data: {
    volunteer: {
      firstName: TEMPLATE_MARKER,
    },
  },
};

const BACKGROUND_CHECK_FAILED_TEMPLATE = {
  email_template: "background_check_failed",
  template_id: "d-17a70027827a427f84569593984b28df",
  categories: ["background_check_failed"],
  dynamic_template_data: {
    volunteer: {
      firstName: TEMPLATE_MARKER,
    },
  },
};

const BACKGROUND_CHECK_NUDGE_TEMPLATE = {
  email_template: "background_check_nudge",
  template_id: "d-62262fb133614aef974367efc4d88dd3",
  categories: ["background_check_nudge"],
  dynamic_template_data: {
    volunteer: {
      firstName: TEMPLATE_MARKER,
    },
  },
};

const COMMUNITY_DELIVERY_REMINDER_TEMPLATE = {
  email_template: "community_delivery_reminder",
  template_id: "d-f011bc6b2f1543d99e029e3df6b6f086",
  categories: ["community_delivery_reminder"],
  dynamic_template_data: {
    volunteer: {
      firstName: TEMPLATE_MARKER,
    },
    organization: {
      name: TEMPLATE_MARKER,
    },
    supplier: {
      name: TEMPLATE_MARKER,
      street: TEMPLATE_MARKER,
      city: TEMPLATE_MARKER,
      state: TEMPLATE_MARKER,
      zipCode: TEMPLATE_MARKER,
    },
    event: {
      time: TEMPLATE_MARKER,
    },
  },
};

const BYOV_WELCOME_TEMPLATE = {
  email_template: "byov-welcome-v1",
  template_id: "d-7fc7ef15621b4bf98ec5ef88eec65905",
  categories: ["byov_signup"],
  dynamic_template_data: {
    volunteer: {
      firstName: TEMPLATE_MARKER,
      email: TEMPLATE_MARKER,
      password: TEMPLATE_MARKER,
    },
    supplier: {
      name: TEMPLATE_MARKER,
      street: TEMPLATE_MARKER,
      city: TEMPLATE_MARKER,
      state: TEMPLATE_MARKER,
      zipCode: TEMPLATE_MARKER,
    },
    event: {
      time: TEMPLATE_MARKER,
    },
  },
};

const COMMUNITY_DELIVERY_SIGNUP_CONFIRMATION_TEMPLATE = {
  email_template: "community_delivery_signup_confirmation",
  template_id: "d-018e05a7d5a842c299c24d3ce3a79b98",
  categories: ["community_delivery_signup_confirmation"],
  dynamic_template_data: {
    volunteer: {
      firstName: TEMPLATE_MARKER,
    },
    organization: {
      name: TEMPLATE_MARKER,
    },
    supplier: {
      name: TEMPLATE_MARKER,
      street: TEMPLATE_MARKER,
      city: TEMPLATE_MARKER,
      state: TEMPLATE_MARKER,
      zipCode: TEMPLATE_MARKER,
    },
    event: {
      time: TEMPLATE_MARKER,
    },
  },
};

const VOLUNTEER_SIGNUP_TEMPLATE = {
  email_template: "volunteer_signup",
  template_id: "d-35bcd984b52f455a9beedb878b814033",
  categories: ["volunteer_signup"],
  dynamic_template_data: {
    volunteer: {
      firstName: TEMPLATE_MARKER,
      lastInitial: TEMPLATE_MARKER,
    },
  },
};

const VOLUNTEER_SIGNUP_NO_REQUESTS_TEMPLATE = {
  email_template: "volunteer_signup_no_requests",
  template_id: "d-e9795aa7e2d6458387636518bf774e3a",
  categories: ["volunteer_signup_no_requests"],
  dynamic_template_data: {
    volunteer: {
      firstName: TEMPLATE_MARKER,
    },
  },
};

const VOLUNTEER_ACCEPTED_TEMPLATE = {
  email_template: "volunteer_accepted",
  template_id: "d-cbecabb27eea476d8a3e4529afbe7dd7",
  categories: ["volunteer_accepted"],
  dynamic_template_data: {
    volunteer: {
      firstName: TEMPLATE_MARKER,
      lastInitial: TEMPLATE_MARKER,
    },
    requester: {
      firstName: TEMPLATE_MARKER,
      lastInitial: TEMPLATE_MARKER,
      phoneNumber: TEMPLATE_MARKER,
      needs: TEMPLATE_MARKER,
    },
  },
};

const VOLUNTEER_NEW_OPEN_REQUESTS_TEMPLATE_ID =
  "d-ef5b446ce2964d86b7ebfc444646430b";
const VOLUNTEER_NEW_OPEN_REQUESTS = {
  email_template: "volunteer_new_open_requests",
  template_id: VOLUNTEER_NEW_OPEN_REQUESTS_TEMPLATE_ID,
  categories: ["volunteer_new_open_requests"],
  dynamic_template_data: {
    volunteer: {
      firstName: TEMPLATE_MARKER,
      lastInitial: TEMPLATE_MARKER,
    },
    requester: {
      firstName: TEMPLATE_MARKER,
      lastInitial: TEMPLATE_MARKER,
    },
  },
};

const VOLUNTEER_NEW_OPEN_REQUESTS_BGC_REMINDER_TEMPLATE = {
  email_template: "new_requests_bgc_reminder",
  template_id: "d-5aa2cfbfa12942bbbea8a986b49bfd26",
  categories: ["new_requests_bgc_reminder"],
  dynamic_template_data: {
    volunteer: {
      firstName: TEMPLATE_MARKER,
    },
  },
};

const REQUESTER_SUBMITTED_TEMPLATE = {
  email_template: "requester_submitted",
  template_id: "d-a6cf3ce71e7e40bfbfae2b25f1a0ad7c",
  categories: ["requester_submitted"],
  dynamic_template_data: {
    requester: {
      firstName: TEMPLATE_MARKER,
      lastInitial: TEMPLATE_MARKER,
    },
  },
};

function volunteerSignupEmailTemplate(volunteer) {
  let emailTemplate = Object.assign({}, VOLUNTEER_SIGNUP_TEMPLATE);
  const lastInitial = volunteer.lastName.substr(0, 1);
  emailTemplate.dynamic_template_data.volunteer.firstName = volunteer.firstName;
  emailTemplate.dynamic_template_data.volunteer.lastInitial = lastInitial;
  return emailTemplate;
}

function volunteerSignupNoRequestsEmailTemplate(volunteer) {
  let emailTemplate = Object.assign({}, VOLUNTEER_SIGNUP_NO_REQUESTS_TEMPLATE);
  emailTemplate.dynamic_template_data.volunteer.firstName = volunteer.firstName;
  return emailTemplate;
}

function volunteerNewOpenRequestsBGCReminderEmailTemplate(volunteer) {
  let emailTemplate = Object.assign(
    {},
    VOLUNTEER_NEW_OPEN_REQUESTS_BGC_REMINDER_TEMPLATE
  );
  emailTemplate.dynamic_template_data.volunteer.firstName = volunteer.firstName;
  return emailTemplate;
}

function requesterSubmittedEmailTemplate(requester) {
  let emailTemplate = Object.assign({}, REQUESTER_SUBMITTED_TEMPLATE);
  const lastInitial = requester.lastName.substr(0, 1);
  emailTemplate.dynamic_template_data.requester.firstName = requester.firstName;
  emailTemplate.dynamic_template_data.requester.lastInitial = lastInitial;
  return emailTemplate;
}

function volunteerNewOpenRequestsTemplate(volunteer, requester) {
  let emailTemplate = Object.assign({}, VOLUNTEER_NEW_OPEN_REQUESTS);
  const volunteerLastInitial = volunteer.lastName.substr(0, 1);
  const requesterLastInitial = requester.lastName.substr(0, 1);
  emailTemplate.dynamic_template_data.volunteer.firstName = volunteer.firstName;
  emailTemplate.dynamic_template_data.volunteer.lastInitial = volunteerLastInitial;
  emailTemplate.dynamic_template_data.requester.firstName = requester.firstName;
  emailTemplate.dynamic_template_data.requester.lastInitial = requesterLastInitial;
  return emailTemplate;
}

function volunteerAcceptedEmailTemplate(volunteer, requester, request) {
  let emailTemplate = Object.assign({}, VOLUNTEER_ACCEPTED_TEMPLATE);
  const volunteerLastInitial = volunteer.lastName.substr(0, 1);
  const requesterLastInitial = requester.lastName.substr(0, 1);
  emailTemplate.dynamic_template_data.volunteer.firstName = volunteer.firstName;
  emailTemplate.dynamic_template_data.volunteer.lastInitial = volunteerLastInitial;
  emailTemplate.dynamic_template_data.requester.firstName = requester.firstName;
  emailTemplate.dynamic_template_data.requester.lastInitial = requesterLastInitial;
  let parsedNumber = parsePhoneNumberFromString(requester.phoneNumber, "US");
  emailTemplate.dynamic_template_data.requester.phoneNumber = parsedNumber.formatNational();
  emailTemplate.dynamic_template_data.requester.needs = request.needs;
  return emailTemplate;
}

function backgroundCheckPassedEmailTemplate(volunteer) {
  let emailTemplate = Object.assign({}, BACKGROUND_CHECK_PASSED_TEMPLATE);
  emailTemplate.dynamic_template_data.volunteer.firstName = volunteer.firstName;
  return emailTemplate;
}

function backgroundCheckFailedEmailTemplate(volunteer) {
  let emailTemplate = Object.assign({}, BACKGROUND_CHECK_FAILED_TEMPLATE);
  emailTemplate.dynamic_template_data.volunteer.firstName = volunteer.firstName;
  return emailTemplate;
}

function backgroundCheckNudgeEmailTemplate(volunteer) {
  let emailTemplate = Object.assign({}, BACKGROUND_CHECK_NUDGE_TEMPLATE);
  emailTemplate.dynamic_template_data.volunteer.firstName = volunteer.firstName;
  return emailTemplate;
}

function communitySignUpConfirmationEmailTemplate(
  volunteer,
  organization,
  supplier,
  eventTime
) {
  let emailTemplate = Object.assign(
    {},
    COMMUNITY_DELIVERY_SIGNUP_CONFIRMATION_TEMPLATE
  );
  emailTemplate.dynamic_template_data.volunteer.firstName = volunteer.firstName;
  emailTemplate.dynamic_template_data.organization.name =
    organization.organizationName;
  emailTemplate.dynamic_template_data.supplier.name = supplier.name;
  emailTemplate.dynamic_template_data.supplier.street = supplier.street;
  emailTemplate.dynamic_template_data.supplier.city = supplier.city;
  emailTemplate.dynamic_template_data.supplier.state = supplier.state;
  emailTemplate.dynamic_template_data.supplier.zipCode = supplier.zipCode;
  emailTemplate.dynamic_template_data.event.time = eventTime;
  return emailTemplate;
}

function communityReminderEmailTemplate(
  volunteer,
  organization,
  supplier,
  eventTime
) {
  let emailTemplate = Object.assign({}, COMMUNITY_DELIVERY_REMINDER_TEMPLATE);
  emailTemplate.dynamic_template_data.volunteer.firstName = volunteer.firstName;
  emailTemplate.dynamic_template_data.organization.name =
    organization.organizationName;
  emailTemplate.dynamic_template_data.supplier.name = supplier.name;
  emailTemplate.dynamic_template_data.supplier.street = supplier.street;
  emailTemplate.dynamic_template_data.supplier.city = supplier.city;
  emailTemplate.dynamic_template_data.supplier.state = supplier.state;
  emailTemplate.dynamic_template_data.supplier.zipCode = supplier.zipCode;
  emailTemplate.dynamic_template_data.event.time = eventTime;
  return emailTemplate;
}

function byovWelcomeEmailTemplate(volunteer, supplier, eventTime, password) {
  let emailTemplate = Object.assign({}, BYOV_WELCOME_TEMPLATE);
  emailTemplate.dynamic_template_data.volunteer.firstName = volunteer.firstName;
  emailTemplate.dynamic_template_data.volunteer.email = volunteer.email;
  emailTemplate.dynamic_template_data.volunteer.password = password;
  emailTemplate.dynamic_template_data.supplier.name = supplier.name;
  emailTemplate.dynamic_template_data.supplier.street = supplier.street;
  emailTemplate.dynamic_template_data.supplier.city = supplier.city;
  emailTemplate.dynamic_template_data.supplier.state = supplier.state;
  emailTemplate.dynamic_template_data.supplier.zipCode = supplier.zipCode;
  emailTemplate.dynamic_template_data.event.time = eventTime;
  return emailTemplate;
}

module.exports = {
  DEBUG_TEMPLATE,
  INFO_ADDRESS,
  NOREPLY_ADDRESS,
  TEMPLATE_MARKER,
  TEST_ADDRESS,
  BACKGROUND_CHECK_PASSED_TEMPLATE,
  BACKGROUND_CHECK_FAILED_TEMPLATE,
  backgroundCheckPassedEmailTemplate,
  backgroundCheckFailedEmailTemplate,
  backgroundCheckNudgeEmailTemplate,
  communityReminderEmailTemplate,
  communitySignUpConfirmationEmailTemplate,
  requesterSubmittedEmailTemplate,
  volunteerAcceptedEmailTemplate,
  VOLUNTEER_NEW_OPEN_REQUESTS_TEMPLATE_ID,
  volunteerNewOpenRequestsTemplate,
  volunteerSignupEmailTemplate,
  volunteerSignupNoRequestsEmailTemplate,
  volunteerNewOpenRequestsBGCReminderEmailTemplate,
  byovWelcomeEmailTemplate,
  BYOV_WELCOME_TEMPLATE,
};
