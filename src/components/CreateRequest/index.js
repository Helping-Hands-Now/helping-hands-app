import React, { useState, useEffect } from "react";
import useGlobalState from "../../hooks/useGlobalState";
import { Modal, Container } from "semantic-ui-react";
import "semantic-ui-css/semantic.min.css";
import { useTranslation } from "react-i18next";
import ProfileForm from "../ProfileForm";
import GA from "../../utils/GoogleAnalytics";
import { createProfile, createRequest } from "../../firebase.js";

import UIButton from "../UI/UIButton";
import UITextArea from "../UI/UITextArea";
import UICheckbox from "../UI/UICheckbox";
import UIRequestPrompt from "../UI/UIRequestPrompt";

import { db } from "../../firebase.js";

export default function CreateRequest(props) {
  const globalState = useGlobalState();

  const { t } = useTranslation();

  const [needs, setNeeds] = useState("");
  const [needsOriginal, setNeedsOriginal] = useState("");

  const [openRequest, setOpenRequest] = useState(null);
  // force the flow to always be creating on behalf of someone else e.g. enterprise console
  const [onBehalf, setOnBehalf] = useState(props.alwaysOnBehalf || false);
  const [aboutBeneficiary, setAboutBeneficiary] = useState("");
  const [needsError, setNeedsError] = useState("");
  const [aboutBeneficiaryError, setAboutBeneficiaryError] = useState("");

  const [submitLoading, setSubmitLoading] = useState(false);

  const handleNeedsSubmit = () => {
    setSubmitLoading(true);
    if (openRequest) {
      editRequest();
    } else {
      setNeedsError("");
      if (needs.length === 0) {
        setNeedsError("Please fill out your needs.");
        setSubmitLoading(false);
        return;
      }
      createRequestForRequester(globalState.user.uid);
    }
  };

  const handleCreateBeneficiary = (profileData) => {
    setNeedsError("");
    if (needs.length === 0) {
      setNeedsError("Please fill out your needs.");
      setSubmitLoading(false);
      return;
    }

    setSubmitLoading(true);

    // Create a beneficiary user
    const uidCreatedBy = globalState.user.uid;

    var createProfileData = {
      firstName: profileData.firstName,
      lastName: profileData.lastName,
      gender: profileData.gender,
      street: profileData.street,
      city: profileData.city,
      state: profileData.state,
      zipCode: profileData.zipCode,
      apartment: profileData.apartment,
      phoneNumber: profileData.phoneNumber,
      geohash: profileData.geohash,
      placeId: profileData.placeId,
      createdBy: uidCreatedBy,
      isAuthed: false,
      needsHelp: true,
      canHelp: false,
      languages: profileData.languages,
      isBeneficiaryProfile: true,
      aboutUser: aboutBeneficiary,
    };

    // TODO HH-272
    if (props.createBeneficiaryHandler) {
      return props
        .createBeneficiaryHandler(createProfileData, needs)
        .catch(function (error) {
          if (error.details) {
            if (error.details.label === "limit-exceeded") {
              globalState.setError({ msg: error.message });
            }
          }
        })
        .finally(() => {
          setSubmitLoading(false);
          clearFields();
          props.refreshParent();
        });
    }

    createProfile(createProfileData)
      .then((result) => {
        var beneficiaryUid = result.data.uid;

        // Now, create a request for that newly created user
        return createRequestForRequester(beneficiaryUid);
      })
      .catch(function (error) {
        if (error.details) {
          if (error.details.label === "limit-exceeded") {
            globalState.setError({ msg: error.message });
          }
        }
      })
      .finally(() => {
        setSubmitLoading(false);
      });
  };

  const clearFields = () => {
    setNeeds("");
    setNeedsOriginal("");
    setAboutBeneficiary("");
    setOpenRequest(null);
    setOnBehalf(false);
  };

  const createRequestForRequester = (requesterUid) => {
    var createRequestData = {
      requesterUid: requesterUid,
      needs: needs,
    };

    createRequest(createRequestData)
      .then((result) => {
        GA.sendEvent({
          category: "interaction",
          action: "button_press",
          label: "submit_request",
        });
        clearFields();
        props.turnOffModal();
      })
      .catch((error) => {
        // TODO: add UI displaying error
        console.log(error);
        if (error.details) {
          if (error.details.label === "single-request-error") {
            props.turnOffModal();
            globalState.setError({ msg: error.message });
          }
          if (error.details.label === "limit-exceeded") {
            props.turnOffModal();
            globalState.setError({ msg: error.message });
          }
        }
      })
      .finally(() => {
        setSubmitLoading(false);
        props.refreshParent();
      });
  };

  const editRequest = async () => {
    setSubmitLoading(true);
    const requestRef = db.collection("requests").doc(openRequest.id);
    await requestRef.update({
      needs: needs,
    });
    setSubmitLoading(false);
    props.turnOffModal();
    props.refreshParent();
  };

  useEffect(() => {
    setOpenRequest(props.openRequest);
    var needs =
      props.openRequest && props.openRequest.needs
        ? props.openRequest.needs
        : "";
    setNeeds(needs);
    setNeedsOriginal(needs);
  }, [props.openRequest]);

  return (
    <Modal
      open={props.isOpen}
      className="modal"
      closeIcon
      onClose={props.turnOffModal}>
      <Modal.Header>
        <p className="dashboardTitle">
          {openRequest ? t("editRequest") : t("createRequest")}
        </p>
      </Modal.Header>
      <div className="createRequestContainer">
        <Container>
          {!openRequest && !props.alwaysOnBehalf && (
            <UICheckbox
              label={t("requestOnBehalf")}
              checked={onBehalf}
              onChange={() => setOnBehalf(!onBehalf)}
            />
          )}
          {!openRequest && onBehalf ? (
            <div>
              {/* Display form to submit needs as well as a profileForm. */}
              <UITextArea
                label={t("whatDoTheyNeed")}
                placeholder={t("exampleNeed")}
                value={needs}
                hook={(e) => setNeeds(e.target.value)}
                disabled={
                  openRequest && openRequest.status === "pending_fulfillment"
                }
                error={needsError}
              />
              <UIRequestPrompt>
                <div>
                  <strong>{t("requestPromptDir1")}</strong>
                  <text>{t("requestPromptDesc1")}</text>
                </div>
                <div>
                  <strong>{t("requestPromptDir2")}</strong>
                  <text>{t("requestPromptDesc2")}</text>
                </div>
                <div>
                  <strong>{t("requestPromptDir3")}</strong>
                  <text>{t("requestPromptDesc3")}</text>
                </div>
              </UIRequestPrompt>
              <UITextArea
                placeholder={t("introduceThem")}
                label={t("tellUsAboutThem")}
                hook={(e) => setAboutBeneficiary(e.target.value)}
                value={aboutBeneficiary}
                error={aboutBeneficiaryError}
              />

              <p>{t("enterNeedsInfo")}</p>
              <ProfileForm
                beneficiary
                loading={submitLoading}
                setLoading={setSubmitLoading}
                submitCallback={handleCreateBeneficiary}
                initialRegistration={true}
                profileType={"beneficiary"}
              />
            </div>
          ) : (
            <div>
              <UITextArea
                label={
                  onBehalf ||
                  (openRequest &&
                    openRequest.requester !== openRequest.createdBy)
                    ? t("whatDoTheyNeed")
                    : t("whatDoYouNeed")
                }
                placeholder={t("exampleNeed")}
                value={needs}
                hook={(e) => setNeeds(e.target.value)}
                disabled={
                  openRequest && openRequest.status === "pending_fulfillment"
                }
                error={needsError}
              />
              <UIRequestPrompt>
                <div>
                  <strong>{t("requestPromptDir1")}</strong>
                  <text>{t("requestPromptDesc1")}</text>
                </div>
                <div>
                  <strong>{t("requestPromptDir2")}</strong>
                  <text>{t("requestPromptDesc2")}</text>
                </div>
                <div>
                  <strong>{t("requestPromptDir3")}</strong>
                  <text>{t("requestPromptDesc3")}</text>
                </div>
              </UIRequestPrompt>

              <div className="profileButtonContainerProfilePage">
                {/*disabled={(openRequest && openRequest.status === "pending_fulfillment") || needs === needsOriginal}*/}
                <UIButton
                  text={openRequest ? t("edit") : t("makeRequest")}
                  primary
                  onClick={handleNeedsSubmit}
                  loading={submitLoading}
                />
              </div>
            </div>
          )}
        </Container>
      </div>
    </Modal>
  );
}
