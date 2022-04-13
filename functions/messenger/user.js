"use strict";

module.exports = class User {
  constructor(psid) {
    this.psid = psid;
    this.firstName = "";
    this.lastName = "";
    this.locale = "";
    this.timezone = "";
    this.gender = "";
    this.needs = "";
    this.needsHelp = false;
    this.requestingFor = "";
    this.canHelp = false;
    this.phoneNumber = "";
    this.zipCode = "";
    this.email = "";
    this.platform = "messenger";
  }

  setProfile(fbProfile) {
    this.firstName = fbProfile.firstName;
    this.lastName = fbProfile.lastName;
    if (fbProfile.gender) {
      this.gender = fbProfile.gender;
    }
    if (fbProfile.locale) {
      this.locale = fbProfile.locale;
    }
    if (fbProfile.timezone) {
      this.timezone = fbProfile.timezone;
    }
  }

  setUserData(userData) {
    this.psid = userData.id;
    this.firstName = userData.firstName;
    this.lastName = userData.lastName;
    if (userData.gender) {
      this.gender = userData.gender;
    }
    this.needs = userData.needs;
    this.needsHelp = userData.needsHelp;
    this.requestingFor = userData.requestingFor;
    this.canHelp = userData.canHelp;
    this.phoneNumber = userData.phoneNumber;
    this.zipCode = userData.zipCode;
    this.email = userData.email;
    this.platform = "messenger";
  }
};
