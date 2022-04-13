import React, { useState, useEffect } from "react";
import useGlobalState from "../../hooks/useGlobalState";
import "semantic-ui-css/semantic.min.css";
import styled from "styled-components";
import { useHistory } from "react-router-dom";
import { Container, Grid } from "semantic-ui-react";
import {
  getStripePaymentIntention,
  saveStripeDonationDetails,
} from "../../firebase.js";
import { useTranslation } from "react-i18next";
import firebase, { db } from "../../firebase";
import GA from "../../utils/GoogleAnalytics";
import { useMediaQuery } from "react-responsive";
import "./styles.css";

import { inputError } from "../UI/styles.js";

import {
  validateNotEmpty,
  validateCity,
  validateZipCode,
  handleFocus,
  handleBlur,
} from "../ProfileForm";
import InputModal from "../InputModal";
import UIButton from "../UI/UIButton";
import UIInput from "../UI/UIInput";
import UIStateDropdown from "../UI/UIStateDropdown";
import SuccessModal from "../SuccessModal";
import StripeCardInput from "../StripeCardInput";

// Stripe imports
import { useStripe, useElements, CardElement } from "@stripe/react-stripe-js";

import "react-confirm-alert/src/react-confirm-alert.css"; // Import css

/*
 * Styles.
 */

const StyledContainer = styled.div`
  max-width: 750px;
  margin-left: auto;
  margin-right: auto;
`;

const StyledPageHeader = styled.h1`
  font-family: "SourceSansProBold";
  font-size: 40px;
  line-height: 50px;
  text-align: center;
  color: #42b6e9;
  margin-bottom: 0px;
`;

const StyledSectionHeader = styled.h2`
  font-family: "SourceSansProBold";
  text-align: center;
  font-size: 30px;
  line-height: 38px;
  margin-top: 50px;
  margin-bottom: 20px;
`;

const StyledParagraph = styled.p`
  font-family: "LatoRegular";
  font-size: 18px;
  line-height: 27px;
  color: #434343;
`;

function CustomAmountButton(props) {
  const [primary, setPrimary] = useState(false);
  const [secondary, setSecondary] = useState(false);

  useEffect(() => {
    setPrimary(props.activeIndex === props.index);
    setSecondary(props.activeIndex !== props.index);
  }, [props.activeIndex, props.index]);

  const handleClick = async () => {
    props.setShowInputModal(true);
    // update the active index
    props.handleAmountUpdate(props.index);
  };

  return (
    <UIButton
      className="amountButton"
      text={
        (props.customAmount &&
          "$" + parseFloat(props.customAmount).toLocaleString()) ||
        "Other"
      }
      primary={primary}
      secondary={secondary}
      onClick={() => handleClick()}
    />
  );
}

function AmountButton(props) {
  const globalState = useGlobalState();

  const [primary, setPrimary] = useState(false);
  const [secondary, setSecondary] = useState(false);

  useEffect(() => {
    setPrimary(props.activeIndex === props.index);
    setSecondary(props.activeIndex !== props.index);
  }, [props.activeIndex, props.index]);

  const handleClick = async () => {
    props.handleAmountUpdate(props.index);
  };

  return (
    <UIButton
      className="amountButton"
      style={{ borderRadius: "50px!important" }}
      text={"$" + props.amount.toLocaleString()}
      primary={primary}
      secondary={secondary}
      onClick={() => handleClick()}
    />
  );
}

export default function Donate(props) {
  const globalState = useGlobalState();
  const history = useHistory();
  const { t } = useTranslation();

  // amount constraints
  const amountMinValue = 1;
  const amountMaxValue = 1000000 - 0.01; // 1M almost

  // special index for the custom amount, which has a
  // separate pop up window to fill in the details
  const customAmountIndex = "0";

  // tracks if we have a logged in user or not (to help
  // with the redirect when we exit the donation page)
  const [isUserLoggedIn, setIsUserLoggedIn] = useState(false);

  const [reRender, setShouldReRender] = useState(false);
  const [formIsEnabled, setFormIsEnabled] = useState(false);

  // for the InputModal
  const [showInputModal, setShowInputModal] = useState(false);

  // for the SuccessModal
  const [successButtonText, setSuccessButtonText] = useState("");
  const [wasSuccessful, setWasSuccessful] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);

  // amount
  const [amount, setAmount] = useState("");
  const [amountError, setAmountError] = useState("");
  const [amountSelectedError, setAmountSelectedError] = useState(false);
  const [customAmount, setCustomAmount] = useState("");
  const [customAmountError, setCustomAmountError] = useState("");

  // active index
  const [activeIndex, setActiveIndex] = useState("");
  const [activeIndexError, setActiveIndexError] = useState("");

  // card holder name
  const [cardHolderName, setCardHolderName] = useState("");
  const [cardHolderNameError, setCardHolderNameError] = useState("");

  // cardDetails
  const [cardDetailsError, setCardDetailsError] = useState("");

  // email
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");

  // billing info
  const [apartment, setApartment] = useState("");
  const [apartmentError, setApartmentError] = useState("");

  const [street, setStreet] = useState("");
  const [streetError, setStreetError] = useState("");

  const [city, setCity] = useState("");
  const [cityError, setCityError] = useState("");

  const [state, setState] = useState("");
  const [stateError, setStateError] = useState("");

  const [zip, setZip] = useState("");
  const [zipError, setZipError] = useState("");

  const stripe = useStripe();
  const elements = useElements();

  useEffect(() => {
    prePopulateFieldsWithLoggedInUser();
  }, []);

  const handleAmountUpdate = async (index) => {
    setActiveIndex(index);

    // if this is the custom amount index, use the customAmount
    // value. otherwise, use the value in the dict amountByIndex
    if (index === customAmountIndex) {
      setAmount(customAmount);
    } else {
      setAmount(amountByIndex[index]);
    }
  };

  async function prePopulateFieldsWithLoggedInUser() {
    // JIRA to eventually clean this up in some global state:
    // https://helping-hands-community.atlassian.net/browse/HH-171
    const storageId = "firebase:uid";
    const uid = localStorage.getItem(storageId);

    // Stripe.js has not yet loaded.
    // Make sure to disable form submission until Stripe.js has loaded.
    if (!stripe || !elements) {
      setFormIsEnabled(false);
    }

    // short-circuit the early return if there is no logged
    // in user, just exit early
    if (!uid) {
      setSuccessButtonText(t("signUp"));
      return;
    }
    setSuccessButtonText(t("okay"));

    db.collection("users")
      .doc(uid)
      .get()
      .then((doc) => {
        // this logic was in FirebaseWrapper to check the user
        // and rerender/sign the user out.
        // Question: do we want the same logic here?
        if (!doc.exists) {
          setShouldReRender(true);
        } else {
          setIsUserLoggedIn(true);
          const data = doc.data();
          // TODO: we should check if the user is banned here, and log
          // them out, once we have that logic extracted and callable:
          // JIRA: https://helping-hands-community.atlassian.net/browse/HH-172
          const userFullName = data.firstName + " " + data.lastName;

          if (cardHolderName === "") {
            setCardHolderName(userFullName);
          }

          if (state === "") {
            setState(data.state);
          }

          if (street === "") {
            setStreet(data.street);
          }

          if (city === "") {
            setCity(data.city);
          }

          if (apartment === "") {
            setApartment(data.apartment);
          }

          // the email is associated with the auth object in Firebase
          // so we do a separate lookup here to fetch the email (if it exists)
          var user = firebase.auth().currentUser;
          if (zip === "") {
            setZip(data.zipCode);
          }
          if (user) {
            if (email === "") {
              setEmail(user.email);
            }
          }
        }
      });
  }

  // the activeIndex is only set once one of the buttons
  // is clicked on, so here we check if there is an activeIndex
  // set, and error if not.
  function validateAmountIndex(activeIndex) {
    if (activeIndex === null || !activeIndex) {
      setAmountSelectedError(true);
      return false;
    } else {
      setAmountSelectedError(false);
      return true;
    }
  }

  function validateEmail(email) {
    var validator = require("email-validator");
    var validEmail = validator.validate(email);
    if (!validEmail) {
      setEmailError(t("enterEmail"));
      return false;
    } else {
      setEmailError("");
      return true;
    }
  }

  function validateAmount(amount) {
    var amountErrorMessage = t("enterAmount", {
      minValue: amountMinValue.toLocaleString(),
      maxValue: amountMaxValue.toLocaleString(),
    });

    // first check that it is a valid integer
    var isValidNumber = amount.toString().match(/^\d+(.\d{2})?$/);
    if (!isValidNumber) {
      setCustomAmountError(amountErrorMessage);
      return false;
    }

    // amount cannot be < min or > max allowed value
    if (amount < amountMinValue || amount > amountMaxValue) {
      setCustomAmountError(amountErrorMessage);
      return false;
    } else {
      setCustomAmountError("");
      return true;
    }
  }

  function validateInput() {
    var isValid = true;

    // validate an amount is currently selected
    // i.e., that one of the buttons has been clicked
    isValid = validateAmountIndex(activeIndex) && isValid;

    // get the card details and check if they are empty/invalid
    var cardElement = elements.getElement(CardElement);
    if (cardElement._empty || cardElement._invalid) {
      setCardDetailsError(t("invalidCardDetails"));
      isValid = false && isValid;
    }

    // validate remaining input fields

    isValid = validateEmail(email) && isValid;
    isValid =
      validateNotEmpty(
        cardHolderName,
        setCardHolderNameError,
        t("enterFullName")
      ) && isValid;
    isValid =
      validateNotEmpty(street, setStreetError, t("enterStreet")) && isValid;
    // set the zip on the card element, incase it hasn't been set yet
    // update the Stripe Element with the zip code
    cardElement.update({ value: { postalCode: zip } });
    isValid = validateZipCode(zip, setZipError, t("enterZip")) && isValid;
    // TODO: state doesn't actually red highlight/text
    // (nor does it appear to work in ProfileForm)
    isValid =
      validateNotEmpty(state, setStateError, t("enterState")) && isValid;
    isValid = validateCity(city, setCityError, t("enterCity")) && isValid;

    // if there are any validation errors, pop up an error message to
    // prompt the user to fix those
    if (!isValid) {
      globalState.setError({ msg: t("donationFormErrorMessage") });
    }
    return isValid;
  }

  // the inputModal is the pop up for the custom amount
  const handleInputModalClick = async (event) => {
    // validate the custom amount set
    var isValid = validateAmount(customAmount);
    if (isValid) {
      // update the amount and active index
      handleAmountUpdate(customAmountIndex);
      // close the modal if the amount was valid
      setShowInputModal(false);
    }
  };

  // At this point, we should have done everything we needed to do, in terms
  // of handling the payment, writing to the DB, etc. so we don't need to do
  // anything further except exit the donation page.
  const handleSuccessClick = async (event) => {
    if (isUserLoggedIn) {
      history.push("/requests");
    } else {
      history.push("/give");
    }
  };

  const handleNotNowClick = async (event) => {
    if (isUserLoggedIn) {
      // TODO: we want to redirect to the homepage, but it currently spins
      // on mobile, so we redirect to /requests for now, until this bug
      // is fixed.
      history.push("/requests");
    } else {
      history.push("/");
    }
  };

  const handleCancel = async (event) => {
    history.push("/"); // This was in src//components/Profile/index.js
  };

  const handleSubmit = async (event) => {
    // validate all the inputs, and return immediately if there
    // are any validation errors
    var isValid = validateInput();
    if (!isValid) {
      return;
    }

    setSubmitLoading(true);

    // first make the function call to get a client_secret from Stripe
    // for the paymentIntention
    await getStripePaymentIntention({
      amount: amount,
      email: email,
    })
      .then(async (paymentIntention) => {
        var clientSecret = paymentIntention.data.client_secret;

        // If, for some reason, we did not get the client secret back,
        // we know the payment will fail to submit, so just error early
        // here rather than try to submit an expected failure case.
        if (clientSecret === null || !clientSecret) {
          console.error(
            "Stripe created payment intention, but client secret is null for user with email " +
              " and amount " +
              amount
          );
          globalState.setError({ msg: t("paymentFailed") });
          setSubmitLoading(false);
          return;
        }

        // if we succeeded in getting the client_secret, continue
        // to actually create the payment with the rest of the form
        // details.
        return await stripe
          .confirmCardPayment(clientSecret, {
            payment_method: {
              card: elements.getElement(CardElement),
              billing_details: {
                name: cardHolderName,
                email: email,
                address: {
                  line1: street,
                  line2: apartment,
                  city: city,
                  state: state,
                  postal_code: zip,
                },
              },
            },
          })
          .then(async (createPayment) => {
            // finally call the function to write the results to the DB
            // so we have our own internal records of the payment details.
            let paymentId = createPayment.paymentIntent.id;
            await saveStripeDonationDetails({
              paymentId: paymentId,
              amount: amount,
              email: email,
              cardHolderName: cardHolderName,
              apartment: apartment,
              street: street,
              city: city,
              state: state,
              zip: zip,
            })
              .then(() => {
                GA.sendEvent({
                  category: "interaction",
                  action: "button_press",
                  label: "donation_confirmed",
                });
                // trigger the SuccessModal to pop up
                setWasSuccessful(true);
                setSubmitLoading(false);
              })
              // failed to write to the DB
              .catch((error) => {
                console.error(
                  "Error writing donation details to the DB: ",
                  error.message
                );
                setSubmitLoading(false);
              });
          })
          .catch((error) => {
            // create payment failed
            console.error(
              "Stripe failed to create a payment for user with email " +
                email +
                " and amount " +
                amount +
                ": ",
              error
            );
            globalState.setError({ msg: t("paymentFailed") });
            setSubmitLoading(false);
          });
      })
      // create payment intent failed
      .catch((error) => {
        console.error(
          "Stripe failed to create payment intention for user with email " +
            email +
            " and amount + " +
            amount +
            ": ",
          error
        );
        globalState.setError({ msg: t("paymentFailed") });
        setSubmitLoading(false);
      });

    // don't spin forever!
    setSubmitLoading(false);
  };

  // each child amount button component receives its index
  // and amount value to display. the parent keeps track of
  // which index represents which value. we have a special
  // index for the custom amount button, where the user
  // supplies their own value.
  // the customAmount variable will be set separately by a pop up
  // window, so we will use null as a placeholder, and override
  // the amount to the variable customAmount, in this scenario.
  const amountByIndex = [null, 25, 50, 100, 200, 500, 1000, 2000];

  // Similar to that in UI/UIInput
  const Error = styled.h1`
    font-size: 10px;
    font-family: AvenirRegular;
    margin-top: 5px;
    color: ${inputError};
  `;

  // If the Custom Amount InputModal was closed, we want to clear
  // the customAmount, and set the activeIndex back to null since the
  // user did not set any amount here.
  const handleInputModalClose = async (event) => {
    setShowInputModal(false);
    setActiveIndex("");
    setCustomAmount("");
  };

  const isMobile = useMediaQuery({ query: "(max-width: 980px) " });

  const amountButtons = [
    <AmountButton
      index="1"
      key="1"
      amount={amountByIndex[1]}
      activeIndex={activeIndex}
      handleAmountUpdate={handleAmountUpdate}
    />,
    <AmountButton
      index="2"
      key="2"
      amount={amountByIndex[2]}
      activeIndex={activeIndex}
      handleAmountUpdate={handleAmountUpdate}
    />,
    <AmountButton
      index="3"
      key="3"
      amount={amountByIndex[3]}
      activeIndex={activeIndex}
      handleAmountUpdate={handleAmountUpdate}
    />,
    <AmountButton
      index="4"
      key="4"
      amount={amountByIndex[4]}
      activeIndex={activeIndex}
      handleAmountUpdate={handleAmountUpdate}
    />,
    <AmountButton
      index="5"
      key="5"
      amount={amountByIndex[5]}
      activeIndex={activeIndex}
      handleAmountUpdate={handleAmountUpdate}
    />,
    <AmountButton
      index="6"
      key="6"
      amount={amountByIndex[6]}
      activeIndex={activeIndex}
      handleAmountUpdate={handleAmountUpdate}
    />,
    <AmountButton
      index="7"
      key="7"
      amount={amountByIndex[7]}
      activeIndex={activeIndex}
      handleAmountUpdate={handleAmountUpdate}
    />,
    <CustomAmountButton
      index="0"
      key="0"
      activeIndex={activeIndex}
      customAmount={customAmount}
      handleAmountUpdate={handleAmountUpdate}
      setShowInputModal={setShowInputModal}
    />,
  ];

  const renderAmountButtonRows = () => {
    let buttonsByRows = [];

    // if mobile view, put 1 button per row
    // if non-mobile, put 4 buttons per row
    var rowSize = isMobile ? 1 : 4;
    for (var index = 0; index < amountButtons.length; index += rowSize) {
      buttonsByRows.push(amountButtons.slice(index, index + rowSize));
    }
    return (
      <Grid className="donateAmountButtonContainer">
        {buttonsByRows.map((row, index) => (
          <Grid.Row key={index}> {row} </Grid.Row>
        ))}
      </Grid>
    );
  };

  return (
    <div className="contentContainer">
      <StyledContainer>
        {showInputModal && (
          <InputModal
            open={showInputModal}
            onClose={(e) => handleInputModalClose(e)}
            text={t("donationPrompt")}
            buttonText={t("confirm")}
            placeholder={t("customAmount")}
            label={t("amountUSD")}
            hook={(e) => setCustomAmount(e.target.value)}
            value={customAmount}
            error={customAmountError}
            onClick={handleInputModalClick}
          />
        )}
        <SuccessModal
          open={wasSuccessful}
          title={t("donationThankYouTitle")}
          textArray={[t("donationThankYouMessage")]}
          secondaryButtonText={t("notNow")}
          secondaryOnClick={handleNotNowClick}
          primaryButtonText={successButtonText}
          primaryOnClick={handleSuccessClick}
        />
        <p />
        <StyledPageHeader>{t("donationPageTitle")}</StyledPageHeader>
        <br />
        <br />

        <StyledParagraph>{t("donationPageSection1ContentA")}</StyledParagraph>
        <StyledParagraph>{t("donationPageSection1ContentB")}</StyledParagraph>
        <br />

        <hr />
        <StyledSectionHeader>
          {t("donationPageSection2Title")}
        </StyledSectionHeader>
        <br />
        <StyledParagraph>{t("donationPageSection2Content")}</StyledParagraph>

        <StyledSectionHeader>{t("donationPrompt")}</StyledSectionHeader>
        <br />
        {renderAmountButtonRows()}
        <br />
        <StyledParagraph>
          <strong>Thank you for helping.</strong>
        </StyledParagraph>
        {amountSelectedError && <Error>{t("donationPageSelectAmount")}.</Error>}
        <UIInput
          label={t("email")}
          hook={(e) => setEmail(e.target.value)}
          value={email}
          error={emailError}
        />
        <UIInput
          label={t("cardHolderName")}
          hook={(e) => setCardHolderName(e.target.value)}
          value={cardHolderName}
          error={cardHolderNameError}
        />
        <StripeCardInput label={t("cardDetails")} error={cardDetailsError} />
        <h2 className="contentDesc">{t("billingAddress")}</h2>
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
              placeholder={zip}
              label={t("zip")}
              hook={(e) => setZip(e.target.value)}
              value={zip}
              error={zipError}
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
        <br />
        <br />

        <hr />
        <h2 className="contentDesc">{t("aboutHelpingHands")}</h2>
        <p className="contentDescItalic">{t("donationPageLegalText")}</p>
        <br />

        <div className="profileButtonContainerProfilePage">
          <UIButton text={t("cancel")} onClick={handleCancel} secondary />
          <UIButton
            text={t("confirm")}
            primary
            disabled={formIsEnabled}
            onClick={handleSubmit}
            loading={submitLoading}
          />
        </div>
      </StyledContainer>
    </div>
  );
}
