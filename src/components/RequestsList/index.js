import React, { useState, useEffect } from "react";
import "moment-timezone";
import Moment from "react-moment";
import "semantic-ui-css/semantic.min.css";
import { Card, Grid, Icon, Modal, Accordion } from "semantic-ui-react";
import useGlobalState from "../../hooks/useGlobalState";
import {
  acceptRequest,
  cancelHelpOffer,
  hasExceededCancelHelpLimit,
  closeRequest,
} from "../../firebase.js";
import getLangMap from "./../../lang";
import { useTranslation } from "react-i18next";
import SuccessModal from "../SuccessModal";
import UIButton from "../UI/UIButton";
import GeohashDistance from "geohash-distance";
import { formatPhoneNumber } from "../ProfileForm";
import GA from "../../utils/GoogleAnalytics";
import "./styles.css";

function HelperCard(props) {
  const globalState = useGlobalState();

  const [loading, setLoading] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [closing, setClosing] = useState(false);
  const [showRequest, toggleShowRequest] = useState(false);
  const [request, setRequest] = useState(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [
    cancelHelpOfferRequesterName,
    setCancelHelpOfferRequesterName,
  ] = useState("");
  const [showDisabledAccountModal, setShowDisabledAccountModal] = useState(
    false
  );
  const [
    showDeliveryConfirmationModal,
    setShowDeliveryConfirmationModal,
  ] = useState(false);
  const [showDeliveryThankYouModal, setShowDeliveryThankYouModal] = useState(
    false
  );
  const [showCanHelpSuccessModal, setShowCanHelpSuccessModal] = useState(false);

  const [locationString, setLocationString] = useState("");

  const [t] = useTranslation();
  const langMap = getLangMap(t);

  function diff_hours(dt2, dt1) {
    var diff = (dt2 - dt1) / 1000;
    diff /= 60 * 60;
    return Math.abs(Math.round(diff));
  }

  function diff_minutes(dt2, dt1) {
    var diff = (dt2 - dt1) / 1000;
    diff /= 60;
    return Math.abs(Math.round(diff));
  }

  const sendHelpResponse = () => {
    setLoading(true);
    var requestSucceeded = true;
    acceptRequest({ requestId: request.id })
      .then((result) => {
        GA.sendEvent({
          category: "interaction",
          action: "button_press",
          label: "i_will_help",
        });
        return;
      })
      .catch(function (error) {
        if (error.details) {
          requestSucceeded = false;
          if (error.details.label === "limit-exceeded") {
            globalState.setError({ msg: error.message });
          }
          if (error.details.label === "already-accepted") {
            globalState.setError({ msg: error.message });
          }
          if (error.details.label === "num-cancellations-exceeded") {
            globalState.setError({ msg: error.message });
          }
        }
      })
      .finally(() => {
        setLoading(false);
        // if there was no error, then show the instructions prompt
        if (requestSucceeded) {
          setShowCanHelpSuccessModal(true);
        }
      });
  };

  const handleCanHelpSuccessModalClick = () => {
    setShowCanHelpSuccessModal(false);
    props.refreshParent();
  };

  // trigger the cancel help confirmation pop-up
  // by setting the modal boolean to true, and updating
  // the requester name
  const cancelOfferForHelpConfirmation = (request) => {
    setShowCancelConfirm(true);
    setCancelHelpOfferRequesterName(
      request.sensitive.firstName + " " + request.sensitive.lastName
    );
  };

  const cancelOfferForHelp = () => {
    setCancelling(true);

    cancelHelpOffer({ requestId: request.id })
      .then((result) => {
        return;
      })
      .catch((error) => {
        console.log(error);
      })
      .finally(() => {
        // if the user has exceeded the limit of canceling help offers,
        // we show an additional pop up that lets them know their account
        // is disabled for 24 hours.
        hasExceededCancelHelpLimit({ userId: globalState.user.uid })
          .then((result) => {
            setShowCancelConfirm(false);
            setCancelling(false);

            // limit was exceeded, so show the pop-up
            if (result.data) {
              setShowDisabledAccountModal(true);

              // otherwise, refresh props
            } else {
              props.refreshParent();
            }
            return;
          })
          .catch((error) => {
            console.error(error);
            // if there was an error above, refresh and skip
            // the additional pop-up window
            props.refreshParent();
          })
          .finally(() => {
            // just incase there was an error above, make sure
            // to set these back to false
            setShowCancelConfirm(false);
            setCancelling(false);
          });
      });
  };

  const closeRequestFunction = () => {
    setClosing(true);
    closeRequest({ requestId: request.id })
      .then((result) => {
        return;
      })
      .catch((error) => {
        console.log(error);
      })
      .finally(() => {
        setShowCancelConfirm(false);
        setShowDeliveryConfirmationModal(false);
        setShowDeliveryThankYouModal(true);
        setClosing(false);
      });
  };

  const closeCancelModals = () => {
    setShowCancelConfirm(false);
    setShowDisabledAccountModal(false);
    setCancelHelpOfferRequesterName(""); // reset requester name for pop-up
    props.refreshParent();
  };

  const closeThankYouModal = () => {
    setShowDeliveryThankYouModal(false);
    props.refreshParent();
  };

  const GMapsLink = (params) => {
    var base = "https://www.google.com/maps/place/";
    params = params.replace(/\s+/g, "+").toLowerCase();
    return base + params;
  };

  // In the Thank You modal, we have to separate out the pieces of
  // text to colour them blue, it is easier to do that here and pass
  // it into the SuccessModal component as a textSection instead of trying
  // to insert spans and className through the textArray param.
  const renderThankYouModalTextSection = () => {
    return (
      <div>
        <p key="1" className="successText">
          {t("deliveryThankYouText1")}
        </p>
        <p key="2" className="successText">
          <span className="successText">{t("deliveryThankYouText2")}</span>
          <a
            className="successTextBlue"
            href="mailto:feedback@helpinghands.community">
            feedback@helpinghands.community
          </a>
          <span className="successText">{"."}</span>
        </p>
        <p key="3" className="successText">
          <span className="successText">{t("deliveryThankYouText3")}</span>
          <span className="successTextBlue">{t("helpingHandsHashTag")}</span>
          <span className="successText">{"."}</span>
        </p>
      </div>
    );
  };

  useEffect(() => {
    setRequest(props.request);
    renderLocationString(request);
  }, [props.request, request]);

  const renderLocationString = (request) => {
    if (!request) {
      return;
    }

    var localLocationString = "";
    localLocationString = [
      request.neighborhood,
      request.sublocality,
      request.locality,
      request.state,
    ]
      .filter(Boolean)
      .join(", ");

    // if location string is not empty, add ' in ' prefix so the text becomes
    // X miles away in $neighborhood, $city, $state
    if (localLocationString) {
      localLocationString = " in " + localLocationString;
    }
    setLocationString(localLocationString);
  };

  return (
    <div>
      <SuccessModal
        open={showCanHelpSuccessModal}
        onClose={handleCanHelpSuccessModalClick}
        title={t("thankYouForVolunteeringTitle")}
        textArray={[
          t("thankYouForVolunteeringText1"),
          t("thankYouForVolunteeringText2"),
        ]}
        primaryButtonText={t("okayGotIt")}
        primaryOnClick={handleCanHelpSuccessModalClick}
      />
      <SuccessModal
        open={showCancelConfirm}
        onClose={() => setShowCancelConfirm(false)}
        title={t("unableToHelpTitle")}
        textArray={[
          t("unableToHelpText", {
            requesterName: cancelHelpOfferRequesterName,
          }),
        ]}
        primaryLoading={cancelling}
        primaryButtonText={t("confirmCancel")}
        primaryOnClick={cancelOfferForHelp}
      />
      <SuccessModal
        open={showDisabledAccountModal}
        onClose={closeCancelModals}
        title={t("accountDisabledTitle")}
        textArray={[t("accountDisabledText1"), t("accountDisabledText2")]}
        primaryButtonText={t("okayGotIt")}
        primaryOnClick={closeCancelModals}
      />
      <SuccessModal
        open={showDeliveryConfirmationModal}
        onClose={() => setShowDeliveryConfirmationModal(false)}
        title={t("deliveryConfirmationTitle")}
        textArray={[t("deliveryConfirmationText")]}
        secondaryButtonText={t("cancel")}
        secondaryOnClick={() => setShowDeliveryConfirmationModal(false)}
        primaryLoading={closing}
        primaryButtonText={t("confirm")}
        primaryOnClick={closeRequestFunction}
      />
      <SuccessModal
        open={showDeliveryThankYouModal}
        onClose={closeThankYouModal}
        title={t("deliveryThankYouTitle")}
        textSection={renderThankYouModalTextSection()}
      />
      {request && (
        <div className="requestContent">
          <div className="individualRequestHeaderLine">
            <span className="individualRequestTitle">HELP SOMEONE</span>
            <span className="individualRequestTime">
              <Moment fromNow>
                {request.timeCreated._seconds * 1000 ||
                  request.timeCreated.seconds * 1000}
              </Moment>
            </span>
          </div>
          <div>
            {props.sensitive && request.sensitive ? (
              <p className="IndividualRequestName">
                Help {request.sensitive.firstName} {request.sensitive.lastName}{" "}
                {locationString}
              </p>
            ) : (
              <p className="IndividualRequestName">
                Help {request.requesterFirstName} {locationString}
                <span className="milesAwayText">
                  (
                  {Math.round(
                    GeohashDistance.inMiles(
                      request.geohash,
                      globalState.userInfo.geohash
                    ) * 10
                  ) / 10}
                  mi away)
                </span>
              </p>
            )}
            {request.aboutUser && (
              <p className="requestBio">{request.aboutUser}</p>
            )}

            <div className="languageContainer">
              <Icon name="world" className="languageIcon"></Icon>
              <p className="languagesText">
                {request.languages.map((value, index) => {
                  return index < request.languages.length - 1
                    ? langMap[value] + ", "
                    : langMap[value];
                })}
              </p>
            </div>

            {props.sensitive && request.sensitive && (
              <div className="languageContainer">
                <Icon name="phone" className="languageIcon"></Icon>
                <p className="languagesText">
                  {formatPhoneNumber(request.sensitive.phoneNumber)}
                </p>
              </div>
            )}

            <Accordion>
              <Accordion.Title
                active={showRequest}
                index={0}
                onClick={() => toggleShowRequest(!showRequest)}>
                <p className="requestAccordionTitle">See how you can help</p>
              </Accordion.Title>
              <Accordion.Content active={showRequest}>
                <p className="requestAccordionText">{request.needs}</p>
                {request.status === "open" && (
                  <UIButton
                    small
                    loading={loading}
                    onClick={sendHelpResponse}
                    text={t("iCanHelp")}
                  />
                )}
              </Accordion.Content>
            </Accordion>

            {request.status === "closed" && (
              <div className="dataContainer">
                <Icon name="check circle"></Icon>
                <p className="requestInfo">{t("delivered")}</p>
              </div>
            )}

            <br />

            {request.status === "pending_fulfillment" && (
              <div className="pendingActions">
                <UIButton
                  className="helperRunsButton"
                  onClick={() => setShowDeliveryConfirmationModal(true)}
                  secondary={!request.closingVerifiedTextTimeSent}
                  disabled={request.closingVerifiedTextTimeSent}
                  text={t("deliveredButtonText")}
                />
                <UIButton
                  className="helperRunsButton"
                  loading={loading}
                  onClick={() => cancelOfferForHelpConfirmation(request)}
                  destructive={!request.closingVerifiedTextTimeSent}
                  disabled={request.closingVerifiedTextTimeSent}
                  text={t("noLongerHelp")}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function RequestsList(props) {
  const [requests, setRequests] = useState({ ...props.requests });
  useEffect(() => {
    setRequests(props.requests);
  }, [props.requests]);

  return (
    <div className="requestsList">
      {Object.keys(requests).map((key, index) => (
        <HelperCard
          key={key}
          request={requests[key]}
          sensitive
          refreshParent={props.refreshParent}
        />
      ))}
    </div>
  );
}
