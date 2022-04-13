import React, { useState, useEffect } from "react";
import { Grid, Card, Icon, Modal } from "semantic-ui-react";
import Moment from "react-moment";
import "semantic-ui-css/semantic.min.css";
import { useTranslation } from "react-i18next";
import CreateRequest from "../CreateRequest";
import UIButton from "../UI/UIButton";
import UITextArea from "../UI/UITextArea";
import "./styles.css";
import {
  sendThankYouText,
  closeRequest,
  cancelRequest,
} from "../../firebase.js";
import Share from "../Share";
import { formatPhoneNumber } from "../ProfileForm";

import { cancelHelperFromRequest } from "../../firebase.js";

export default function RequestCard(props) {
  const [request, setRequest] = useState(null);
  const [t] = useTranslation();
  const [showEditModal, setShowEditModal] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cancellingOrder, setCancellingOrder] = useState(false);
  const [cancellingHelper, setCancellingHelper] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showThanksModal, setShowThanksModal] = useState(false);
  const [showCancelHelperConfirm, setShowCancelHelperConfirm] = useState(false);
  const [thankYou, setThankYou] = useState("");
  const [thankYouDone, setThankYouDone] = useState(false);

  useEffect(() => {
    setRequest(props.request);
  }, [props.request]);

  const closeRequestFunc = async () => {
    setArchiving(true);
    closeRequest({ requestId: props.request.id })
      .catch((error) => {
        console.log(error);
      })
      .finally(() => {
        setArchiving(false);
        setThankYouDone(false);
        setThankYou("");
        setShowThanksModal(true);
      });
  };

  const closeThankYou = () => {
    setShowThanksModal(false);
    props.refreshParent();
  };

  const sendThanks = () => {
    setLoading(true);
    sendThankYouText({
      requesterFirstName: request.requesterData.firstName,
      helperPhone: request.helperData.helperPhoneNumber,
      helperLangs: request.helperData.helperLanguages,
      requesterThanks: thankYou,
    })
      .then(() => {})
      .catch((error) => {
        console.log(error);
      })
      .finally(() => {
        setLoading(false);
        setThankYouDone(true);
      });
  };

  const cancelOrder = async () => {
    setCancellingOrder(true);
    cancelRequest({ requestId: props.request.id })
      .catch((error) => {
        console.log(error);
      })
      .finally(() => {
        setShowCancelConfirm(false);
        setCancellingOrder(false);
        props.refreshParent();
      });
  };

  const cancelHelper = async () => {
    setCancellingHelper(true);
    cancelHelperFromRequest({
      requestId: request.id,
      helperPhone: request.helperData.helperPhoneNumber,
    })
      .catch((error) => {
        console.log(error);
      })
      .finally(() => {
        setCancellingHelper(false);
        setShowCancelHelperConfirm(false);
        props.refreshParent();
      });
  };

  const refreshData = () => {
    props.refreshParent();
  };

  return (
    <div className="requestEntry">
      {request && (
        <Card fluid>
          <div className="requestContent">
            <Grid stackable>
              <Grid.Row>
                <Grid.Column width={11}>
                  <div className="dataContainer">
                    <Icon name="user"></Icon>
                    <p className="requestInfo">
                      {request.requesterData.firstName +
                        " " +
                        request.requesterData.lastName}
                    </p>
                    <br />
                  </div>

                  <div className="dataContainer">
                    <Icon name="calendar"></Icon>
                    <p className="requestInfo">
                      <Moment
                        format="LLLL"
                        date={request.timeCreated._seconds * 1000}></Moment>
                    </p>
                    <br />
                  </div>

                  <div
                    className="dataContainer"
                    style={{ display: "flex", alignItems: "top" }}>
                    <div style={{ display: "inline-block" }}>
                      <Icon name="cart"></Icon>
                    </div>
                    <div style={{ display: "inline-block" }}>
                      <p className="requestInfoNeeds">{request.needs}</p>
                    </div>
                    <br />
                  </div>

                  <div className="dataContainer">
                    <Icon name="point"></Icon>
                    <p className="requestInfo">
                      {request.requesterData.street}{" "}
                      {request.requesterData.apartment},{" "}
                      {request.requesterData.city},{" "}
                      {request.requesterData.state}{" "}
                      {request.requesterData.zipCode}
                    </p>
                    <br />
                  </div>

                  <div className="dataContainer">
                    <Icon name="phone"></Icon>
                    <p className="requestInfo">
                      {formatPhoneNumber(request.requesterData.phoneNumber)}
                    </p>
                    <br />
                  </div>

                  {request.helperData && (
                    <div>
                      {request.status === "pending_fulfillment" ? (
                        <p>{t("orderDeliveredBy")}</p>
                      ) : (
                        <p>{t("orderWasDeliveredBy")}</p>
                      )}
                      <div className="dataContainer">
                        <Icon name="user"></Icon>
                        <p className="requestInfo">
                          {request.helperData.helperFirstName +
                            " " +
                            request.helperData.helperLastName}
                        </p>
                        <br />
                        {request.helperData.helperAboutUser && (
                          <div>
                            <p className="requestBio">
                              <em>"{request.helperData.helperAboutUser}"</em>
                            </p>
                            <br />
                          </div>
                        )}
                      </div>

                      <div className="dataContainer">
                        <Icon name="phone"></Icon>
                        <p className="requestInfo">
                          {formatPhoneNumber(
                            request.helperData.helperPhoneNumber
                          )}
                        </p>
                        <br />
                      </div>
                    </div>
                  )}
                </Grid.Column>
                <Grid.Column width={5}>
                  <div className="requestAction" align="center">
                    {request.status === "open" && (
                      <div>
                        <p>{t("orderListed")}</p>

                        <CreateRequest
                          openRequest={request}
                          isOpen={showEditModal}
                          refreshParent={refreshData}
                          turnOffModal={() => setShowEditModal(false)}
                        />
                        <UIButton
                          text={t("editOrder")}
                          secondary
                          floated="right"
                          onClick={() => setShowEditModal(true)}
                        />
                        <br />

                        <Modal
                          size="mini"
                          className="modal"
                          closeIcon
                          open={showCancelConfirm}
                          onClose={() => setShowCancelConfirm(false)}>
                          <Modal.Header>
                            <p className="modalTitle">{t("areYouSure")}</p>
                          </Modal.Header>
                          <Modal.Content>
                            <p className="modalText">
                              {t("confirmCancelOrderPrompt1")}
                            </p>
                            <p className="modalText">
                              {t("confirmCancelOrderPrompt2")}
                            </p>
                            <UIButton
                              loading={cancellingOrder}
                              destructive
                              text={t("confirmCancelOrderAction")}
                              onClick={cancelOrder}
                            />
                          </Modal.Content>
                        </Modal>

                        <UIButton
                          text={t("cancelOrder")}
                          destructive
                          floated="right"
                          onClick={() => setShowCancelConfirm(true)}
                        />
                      </div>
                    )}

                    {request.status === "pending_fulfillment" && (
                      <div>
                        <p>
                          {request.helperData.helperFirstName}{" "}
                          {t("volunteerPickingUpOrder")}
                        </p>

                        <Modal
                          size="mini"
                          className="modal"
                          closeIcon
                          open={showCancelHelperConfirm}
                          onClose={() => setShowCancelHelperConfirm(false)}>
                          <Modal.Header>
                            <p className="modalTitle">
                              {t("confirmCancelHelperTitle")}
                            </p>
                          </Modal.Header>
                          <Modal.Content>
                            <p className="modalText">
                              {t("confirmCancelHelperPrompt1")}
                            </p>
                            <p className="modalText">
                              {request.helperData.helperFirstName}{" "}
                              {t("confirmCancelHelperPrompt2")}
                            </p>
                            <UIButton
                              loading={cancellingHelper}
                              destructive
                              text={t("confirmCancelHelperAction")}
                              onClick={cancelHelper}
                            />
                          </Modal.Content>
                        </Modal>

                        <div style={{ marginBottom: "12px" }}>
                          <UIButton
                            text={t("theyCantHelp")}
                            destructive
                            floated="right"
                            onClick={() => setShowCancelHelperConfirm(true)}
                          />
                        </div>
                        <UIButton
                          loading={archiving}
                          text={t("gotItemsBtn")}
                          primary
                          floated="right"
                          onClick={closeRequestFunc}
                        />

                        <Modal
                          size="mini"
                          className="modal"
                          closeIcon
                          open={showThanksModal}
                          onClose={closeThankYou}>
                          <Modal.Header>
                            <p className="modalTitle">
                              Request marked as completed!
                            </p>
                          </Modal.Header>
                          <Modal.Content>
                            <p className="modalText">{t("shareIfHelpful")}</p>
                            <Share requester />
                            <br />
                            <br />
                            {!thankYouDone ? (
                              <div>
                                <p className="modalText thanksInstr">
                                  {t("sendThankYou1")}{" "}
                                  {request.helperData.helperFirstName}{" "}
                                  {t("sendThankYou2")}
                                </p>
                                <UITextArea
                                  className="thanksButton"
                                  placeholder={t("thankYouPlaceholder")}
                                  hook={(e) => setThankYou(e.target.value)}
                                  value={thankYou}
                                />
                                <UIButton
                                  loading={loading}
                                  disabled={thankYou.length === 0}
                                  primary
                                  text={t("thankYouButton")}
                                  onClick={sendThanks}
                                />
                              </div>
                            ) : (
                              <p>{t("thankYouSent")}</p>
                            )}
                          </Modal.Content>
                        </Modal>
                      </div>
                    )}
                  </div>
                </Grid.Column>
              </Grid.Row>
            </Grid>
          </div>
        </Card>
      )}
    </div>
  );
}
