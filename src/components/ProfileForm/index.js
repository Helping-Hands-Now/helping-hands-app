import React, { useState, useEffect } from "react";
import { Grid, Message, List } from "semantic-ui-react";
import "semantic-ui-css/semantic.min.css";
import { useLocation } from "react-router-dom";
import { Trans, useTranslation } from "react-i18next";
import LanguageDropDown from "./../LanguageDropdown";
import useGlobalState from "../../hooks/useGlobalState";
import { validateAddress } from "../../firebase.js";
import hash from "object-hash";
import styled from "styled-components";
import "./styles.css";
import { parsePhoneNumberFromString, AsYouType } from "libphonenumber-js";

import TermsOfServiceModal from "../TermsOfServiceModal";
import UIButton from "../UI/UIButton";
import UIInput from "../UI/UIInput";
import UITextArea from "../UI/UITextArea";
import UIStateDropdown from "../UI/UIStateDropdown";

const Text = styled.h1`
  font-size: 15px;
  font-family: AvenirRegular;
  margin-bottom: 5px;
  margin-top: 5px;
`;

export function formatPhoneNumber(phoneNumber) {
  if (!phoneNumber) {
    return "";
  }

  // We display phone numbers as formatted in US national (ex. (123) 456-7890)
  const parsedNumber = parsePhoneNumberFromString(phoneNumber.toString(), "US");
  if (!parsedNumber) {
    // if there was no match, just return in the original formatting
    // so that we don't display something funky unintentionally
    return phoneNumber;
  }

  return parsedNumber.formatNational();
}

export function validateNotEmpty(valueToCheck, setError, errorText) {
  if (valueToCheck) {
    setError("");
    return true;
  } else {
    setError(errorText);
    return false;
  }
}

export function validateCity(valueToCheck, setError, errorText) {
  var cityRegex = /^[a-zA-Z ]+(?:[\s-][a-zA-Z ]+)*$/;

  if (cityRegex.test(valueToCheck)) {
    setError("");
    return true;
  } else {
    setError(errorText);
    return false;
  }
}

export function validateZipCode(valueToCheck, setError, errorText) {
  var zipCodeRegex = /^[0-9]{5}(?:-[0-9]{4})?$/;

  if (zipCodeRegex.test(valueToCheck)) {
    setError("");
    return true;
  } else {
    setError(errorText);
    return false;
  }
}

export function handleFocus(e) {
  e.target.setAttribute("autocomplete", "nope");
}

export function handleBlur(e) {
  e.target.setAttribute("autocomplete", "on");
}

export default function ProfileForm(props) {
  const globalState = useGlobalState();
  const query = useQuery();

  /*
  props.profileType:
  - beneficiary
  - helper
  - requester
  - requesterOnBehalf
  - orgRecipient (part of community console)
  */

  const [originalHash, setOriginalHash] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [apartment, setApartment] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [needs, setNeeds] = useState("");
  const [aboutUser, setAboutUser] = useState("");
  const [firstNameError, setFirstNameError] = useState("");
  const [lastNameError, setLastNameError] = useState("");
  const [streetError, setStreetError] = useState("");
  const [cityError, setCityError] = useState("");
  const [stateError, setStateError] = useState("");
  const [zipCodeError, setZipCodeError] = useState("");
  const [apartmentError, setApartmentError] = useState("");
  const [phoneNumberError, setPhoneNumberError] = useState("");
  const [needsError, setNeedsError] = useState("");
  const [aboutUserError, setAboutUserError] = useState("");
  const [dropoffInstructions, setDropOffInstructions] = useState("");
  const [numRecipients, setNumRecipients] = useState(1);
  const [validateAddressError, setValidateAddressError] = useState(1);

  const formatNumRecipients = (val) => {
    let num = parseInt(val, 10);
    if (isNaN(num)) {
      return "";
    }
    return num;
  };

  // have one function to make it easier to update as things change
  const hashFields = () => {
    return hash([
      firstName,
      lastName,
      street,
      city,
      state,
      zipCode,
      apartment,
      phoneNumber,
      languages,
      aboutUser,
      dropoffInstructions,
      numRecipients,
    ]);
  };
  const { t, i18n } = useTranslation();
  const [languages, setLanguages] = useState([i18n.language]);

  const clearFormErrors = () => {
    setFirstNameError("");
    setLastNameError("");
    setStreetError("");
    setCityError("");
    setStateError("");
    setZipCodeError("");
    setApartmentError("");
    setPhoneNumberError("");
    setNeedsError("");
    setAboutUserError("");
  };

  const validateAndCallback = async () => {
    props.setLoading(true);
    clearFormErrors();

    var profileData = {
      firstName: firstName,
      lastName: lastName,
      gender: "unset",
      phoneNumber: phoneNumber,
      languages: languages,
      aboutUser: aboutUser,
      dropoffInstructions: dropoffInstructions,
      numRecipients: numRecipients,
    };

    var isValid = true;
    isValid =
      validateNotEmpty(firstName, setFirstNameError, t("enterFirstName")) &&
      isValid;
    isValid =
      validateNotEmpty(lastName, setLastNameError, t("enterLastName")) &&
      isValid;
    isValid =
      validateNotEmpty(street, setStreetError, t("enterStreet")) && isValid;
    isValid = validateCity(city, setCityError, t("enterCity")) && isValid;
    isValid =
      validateNotEmpty(state, setStateError, t("enterState")) && isValid;
    isValid =
      validateZipCode(zipCode, setZipCodeError, t("enterZip")) && isValid;
    isValid =
      validatePhoneNumber(
        phoneNumber,
        setPhoneNumberError,
        t("enterPhoneNumber")
      ) && isValid;

    if (!isValid) {
      props.setLoading(false);
      return;
    }

    var validateAddressData = {
      street: street,
      city: city,
      state: state,
      zipCode: zipCode,
      apartment: apartment,
    };

    try {
      var response = await validateAddress(validateAddressData);
      profileData = {
        ...profileData,
        street: street,
        city: city,
        state: state,
        zipCode: zipCode,
        apartment: apartment,
        geohash: response.data.data.geohash,
        placeId: response.data.data.placeId,
      };
      setValidateAddressError("");
    } catch (error) {
      props.setLoading(false);
      // TODO: display error validating address
      console.log("Error validating address:", error);
      setValidateAddressError("Invalid Address");
      return;
    }

    var hasNeeds =
      props.initialRegistration && props.profileType === "requester";
    if (hasNeeds) {
      if (
        !validateNotEmpty(
          needs,
          setNeedsError,
          t("Please fill out the needs field")
        )
      ) {
        props.setLoading(false);
        return;
      }

      profileData = {
        ...profileData,
        needs,
      };
    }

    props.submitCallback(profileData);
    setOriginalHash(hashFields());
  };

  function validatePhoneNumber(valueToCheck, setError, errorText) {
    const parsedNumber = parsePhoneNumberFromString(valueToCheck, "US");
    if (parsedNumber) {
      setError("");
      return true;
    } else {
      setError(errorText);
      return false;
    }
  }

  function useQuery() {
    return new URLSearchParams(useLocation().search);
  }

  useEffect(() => {
    // Fill the form if the user already logged in
    // special case recipient flow because someone's always logged in
    if (props.profileType === "orgRecipient") {
      if (props.profile) {
        // can't use hashFields() here but need to make sure order is kept in sync
        setOriginalHash(
          hash([
            props.profile.firstName,
            props.profile.lastName,
            props.profile.street,
            props.profile.city,
            props.profile.state,
            props.profile.zipCode,
            props.profile.apartment,
            props.profile.phoneNumber,
            props.profile.languages,
            props.profile.aboutUser,
            props.profile.dropoffInstructions,
            props.profile.numRecipients,
          ])
        );
        setFirstName(props.profile.firstName);
        setLastName(props.profile.lastName);
        setStreet(props.profile.street);
        setCity(props.profile.city);
        setState(props.profile.state);
        setZipCode(props.profile.zipCode);
        setApartment(props.profile.apartment);
        setPhoneNumber(formatPhoneNumber(props.profile.phoneNumber));
        setLanguages(props.profile.languages);
        setAboutUser(props.profile.aboutUser);
        setNumRecipients(props.profile.numRecipients);
        setDropOffInstructions(props.profile.dropoffInstructions);
      }
    } else if (globalState.user.isAuthed && !props.initialRegistration) {
      // can't use hashFields() here but need to make sure order is kept in sync
      setOriginalHash(
        hash([
          globalState.userInfo.firstName,
          globalState.userInfo.lastName,
          globalState.userInfo.street,
          globalState.userInfo.city,
          globalState.userInfo.state,
          globalState.userInfo.zipCode,
          globalState.userInfo.apartment,
          globalState.userInfo.phoneNumber,
          globalState.userInfo.languages,
          globalState.userInfo.aboutUser,
          "", // no dropoffInstructions for logged in user
          1, // no numRecipients for logged in user
        ])
      );
      setFirstName(globalState.userInfo.firstName);
      setLastName(globalState.userInfo.lastName);
      setStreet(globalState.userInfo.street);
      setCity(globalState.userInfo.city);
      setState(globalState.userInfo.state);
      setZipCode(globalState.userInfo.zipCode);
      setApartment(globalState.userInfo.apartment);
      setPhoneNumber(formatPhoneNumber(globalState.userInfo.phoneNumber));
      setLanguages(globalState.userInfo.languages);
      setAboutUser(globalState.userInfo.aboutUser);
    } else {
      setFirstName(query.get("first"));
      setLastName(query.get("last"));
      setZipCode(query.get("zip"));
      setPhoneNumber(formatPhoneNumber(query.get("phone")));
    }
  }, [
    globalState.userInfo.firstName,
    globalState.userInfo.lastName,
    globalState.userInfo.street,
    globalState.userInfo.city,
    globalState.userInfo.state,
    globalState.userInfo.zipCode,
    globalState.userInfo.apartment,
    globalState.userInfo.phoneNumber,
    globalState.userInfo.languages,
    globalState.userInfo.aboutUser,
    props.profile,
  ]);

  let newProfile =
    props.initialRegistration ||
    (!props.profile && props.profileType === "orgRecipient");

  return (
    <div>
      <div className="profileForm">
        <div className="profileFormGrid">
          <br />
          <Grid columns={2}>
            <Grid.Row>
              <Grid.Column>
                <UIInput
                  placeholder={firstName}
                  label={t("firstName")}
                  hook={(e) => setFirstName(e.target.value)}
                  value={firstName}
                  error={firstNameError}
                />
              </Grid.Column>
              <Grid.Column>
                <UIInput
                  placeholder={lastName}
                  label={t("lastName")}
                  hook={(e) => setLastName(e.target.value)}
                  value={lastName}
                  error={lastNameError}
                />
              </Grid.Column>
            </Grid.Row>
          </Grid>
          <UIInput
            placeholder={street}
            label={t("street")}
            hook={(e) => setStreet(e.target.value)}
            value={street}
            error={streetError}
          />
          <Grid columns={2}>
            <Grid.Column>
              <UIInput
                placeholder={city}
                label={t("city")}
                hook={(e) => setCity(e.target.value)}
                value={city}
                error={cityError}
              />
              <UIStateDropdown
                label={t("state")}
                placeholder={t("state")}
                hook={(e, d) => setState(d.value)}
                search
                selection
                error={stateError}
                onFocus={handleFocus}
                onBlur={handleBlur}
                state={state}
              />
            </Grid.Column>
            <Grid.Column>
              <UIInput
                placeholder={zipCode}
                label={t("zip")}
                hook={(e) => setZipCode(e.target.value)}
                value={zipCode}
                error={zipCodeError}
              />
              <UIInput
                placeholder={apartment}
                label={t("apartment")}
                hook={(e) => setApartment(e.target.value)}
                value={apartment}
                error={apartmentError}
              />
            </Grid.Column>
          </Grid>
          <UIInput
            placeholder={phoneNumber}
            label={t("phoneNumberField")}
            hook={(e) =>
              setPhoneNumber(new AsYouType("US").input(e.target.value))
            }
            value={phoneNumber}
            error={phoneNumberError}
          />
          {/* If initially registering and requester, show form to request */}
          {props.initialRegistration && props.profileType === "requester" && (
            <div>
              <UITextArea
                placeholder={t("exampleNeed")}
                label={t("whatDoYouNeed")}
                hook={(e) => setNeeds(e.target.value)}
                value={needs}
                error={needsError}
              />
            </div>
          )}
          {props.profileType === "requester" && (
            <UITextArea
              placeholder={t("introduceYouRequester")}
              label={t("tellUsAboutYouRequester")}
              hook={(e) => setAboutUser(e.target.value)}
              value={aboutUser}
              error={aboutUserError}
            />
          )}
          {props.profileType === "helper" && (
            <UITextArea
              placeholder={t("introduceYouHelper")}
              label={t("tellUsAboutYouHelper")}
              hook={(e) => setAboutUser(e.target.value)}
              value={aboutUser}
              error={aboutUserError}
            />
          )}
          {props.profileType === "orgRecipient" && (
            <>
              <UITextArea
                placeholder={t("dropoffInstructions")}
                label={t("dropoffInstructions")}
                hook={(e) => setDropOffInstructions(e.target.value)}
                value={dropoffInstructions}
              />
              <UIInput
                placeholder={t("numberOfRecipients")}
                label={t("numberOfRecipients")}
                hook={(e) =>
                  setNumRecipients(formatNumRecipients(e.target.value, 10))
                }
                value={numRecipients}
              />
            </>
          )}
          {props.beneficiary || props.profileType === "orgRecipient" ? (
            <Text>{t("selectLanguagesLabelsThem")}</Text>
          ) : (
            <Text>{t("selectLanguagesLabelsYou")}</Text>
          )}
          <LanguageDropDown
            languages={languages}
            setLanguages={setLanguages}
            label={props.languageLabel}
          />
          <br />
          {/* If initially registering and helper, show checkboxes */}
          {props.initialRegistration && props.profileType === "helper" && (
            <div>
              <h3>
                <Trans i18nKey="helperAgreementsHeader">
                  By creating a profile, you confirm that you:
                </Trans>
              </h3>
              <List bulleted>
                <List.Item>Are 18 years of age or older,</List.Item>
                <List.Item>
                  Have a valid driver's license and insurance,
                </List.Item>
                <List.Item>
                  Have access to a clean vehicle to transport food and supplies
                  to recipients,
                </List.Item>
                <List.Item>
                  Use a mobile phone that can connect to a web browser and
                  receive texts,
                </List.Item>
                <List.Item>
                  You agree to our {""}
                  <a href="https://helpinghands.community/terms">
                    Terms of Service
                  </a>
                  ,
                  <a href="https://helpinghands.community/privacy">
                    {" "}
                    Privacy Policy
                  </a>
                  , and{" "}
                  <a href="https://helpinghands.community/community">
                    Community Guidelines.
                  </a>
                </List.Item>
              </List>
            </div>
          )}
          {props.initialRegistration && props.profileType === "requester" && (
            <p className="checkboxCriteria">
              {t("signAgreeTermsOfService")} <TermsOfServiceModal />.
            </p>
          )}
          {validateAddressError.length > 0 && (
            <Message negative>
              <Message.Header>Error</Message.Header>
              <p>
                Uh oh, it looks like there was an error validating this address:{" "}
                {validateAddressError}
              </p>
              <br />
            </Message>
          )}
          {/* Conditionally show the right button based on if requester/helper and if updating/creating profile. */}
          {newProfile ? (
            <div className="profileButtonContainer">
              <UIButton
                text={getButtonTextNewProfile(props.profileType, t)}
                loading={props.loading}
                onClick={() => validateAndCallback()}
                primary
              />
            </div>
          ) : (
            <div className="profileButtonContainerProfilePage">
              <UIButton
                loading={props.loading}
                text={getButtonTextExistingProfile(props.profileType, t)}
                onClick={() => validateAndCallback()}
                disabled={hashFields() === originalHash}
                primary={!(hashFields() === originalHash)}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function getButtonTextNewProfile(profileType, t) {
  switch (profileType) {
    case "requester":
      return t("makeRequest");
    case "requesterOnBehalf":
    case "helper":
      return t("createProfile");
    case "beneficiary":
      return t("makeRequest");
    case "orgRecipient":
      return t("create recipient");
    default:
      throw new Error("unhandled case. logic bug");
  }
}

function getButtonTextExistingProfile(profileType, t) {
  switch (profileType) {
    case "orgRecipient":
      return t("edit recipient");
    default:
      return t("updateProfile");
  }
}
