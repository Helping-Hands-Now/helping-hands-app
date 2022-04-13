var libphonenumber = require("libphonenumber-js");

var functions = require("firebase-functions");

function getE164PhoneNumber(phoneNumber) {
  if (!phoneNumber) {
    return "";
  }
  const parsedNumber = libphonenumber.parsePhoneNumberFromString(
    phoneNumber.toString(),
    "US"
  ); // TODO allow for multiple country code
  if (!parsedNumber) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Please provide a valid US phone number.",
      (details = { label: "invalid-phone" })
    );
  }
  return parsedNumber.number;
}

const defaultPassword = "Neighbors123";

module.exports = {
  getE164PhoneNumber,
  defaultPassword,
};
