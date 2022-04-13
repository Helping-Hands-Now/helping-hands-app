import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import "moment-timezone";
import Moment from "react-moment";
import moment from "moment";
import "semantic-ui-css/semantic.min.css";
import {
  Loader,
  Container,
  Dimmer,
  Grid,
  Label,
  Header,
  Comment,
} from "semantic-ui-react";
import useGlobalState from "../../hooks/useGlobalState";
import {
  signUpForCommunityDeliveryEvent,
  leaveCommunityDeliveryEvent,
  checkIntoCommunityDeliveryEvent,
  unassignCommunityDelivery,
} from "../../firebase.js";
import getLangMap from "./../../lang";
import { useTranslation } from "react-i18next";
import SuccessModal from "../SuccessModal";
import UIButton from "../UI/UIButton";
import GeohashDistance from "geohash-distance";
import { formatPhoneNumber } from "../ProfileForm";
import GA from "../../utils/GoogleAnalytics";
import "./styles.css";
import {
  Editor,
  EditorState,
  getDefaultKeyBinding,
  RichUtils,
  convertFromRaw,
} from "draft-js";

function EventCard(props) {
  const globalState = useGlobalState();

  const [request, setRequest] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showInstructions, toggleInstructions] = useState(true);
  const [showCanHelpSuccessModal, setShowCanHelpSuccessModal] = useState(false);
  const [showCanHelpErrorModal, setShowCanHelpErrorModal] = useState(false);
  const [showCheckInEventModal, setShowCheckInEventModal] = useState(false);
  const [showLeaveEventModal, setShowLeaveEventModal] = useState(false);
  const [editorState, setEditorState] = useState(() =>
    EditorState.createEmpty()
  );
  const [t] = useTranslation();

  const now = new Date();

  useEffect(() => {
    setRequest(props.request);
    try {
      setEditorState(
        EditorState.createWithContent(
          convertFromRaw(JSON.parse(props.request.orgDescription))
        )
      );
    } catch (e) {}
  }, [props.request, request]);

  const signUpforEvent = () => {
    setLoading(true);
    signUpForCommunityDeliveryEvent({ eventID: request.id })
      .then((res) => {
        setLoading(false);
        res.data === "Success"
          ? setShowCanHelpSuccessModal(true)
          : setShowCanHelpErrorModal(true);
      })
      .catch(function (error) {
        console.log(error);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  const checkInToEvent = () => {
    setLoading(true);
    setShowCheckInEventModal(false);
    checkIntoCommunityDeliveryEvent({ eventID: request.id })
      .then((result) => {
        setLoading(false);
        props.refreshParent();
      })
      .catch(function (error) {
        console.log(error);
        if (error.details) {
          if (error.details.label === "limit-exceeded") {
            globalState.setError({ msg: error.message });
          }
        }
      })
      .finally(() => {
        setLoading(false);
        props.refreshParent();
      });
  };

  const unassignDelivery = (volunteer, requestID) => {
    setLoading(true);
    setShowCheckInEventModal(false);
    unassignCommunityDelivery({
      eventID: request.id,
      volunteer: volunteer,
      requestID: requestID,
    })
      .then((result) => {
        setLoading(false);
      })
      .catch(function (error) {
        console.log(error);
      });
  };

  const handleCanHelpSuccessModalClick = () => {
    setShowCanHelpSuccessModal(false);
    props.refreshParent();
  };

  const handleCanHelpErrorModalClick = () => {
    setShowCanHelpErrorModal(false);
    props.refreshParent();
  };

  const leaveEvent = () => {
    setLoading(true);
    setShowLeaveEventModal(false);
    leaveCommunityDeliveryEvent({ eventID: request.id })
      .then((result) => {
        setLoading(false);
        props.refreshParent();
      })
      .catch(function (error) {
        console.log(error);
      })
      .finally(() => {
        setLoading(false);
        props.refreshParent();
      });
  };

  // Custom overrides for "code" style.
  const styleMap = {
    CODE: {
      backgroundColor: "rgba(0, 0, 0, 0.05)",
      fontFamily: '"Inconsolata", "Menlo", "Consolas", monospace',
      fontSize: 16,
      padding: 2,
    },
  };

  function getBlockStyle(block) {
    switch (block.getType()) {
      case "blockquote":
        return "RichEditor-blockquote";
      default:
        return null;
    }
  }

  const canBeDisplayed = (time) => {
    const currentTime = moment(Date.now());
    const eventTime = moment(new Date(time * 1000));
    const threeHoursAfterEvent = moment(eventTime).add(3, "h").toDate();
    let withinTimeRange = moment(currentTime).isBetween(
      eventTime,
      threeHoursAfterEvent
    );
    if (withinTimeRange) {
      return true;
    } else {
      return false;
    }
  };
  const privateInfo = (props, tel, linkToMap) => {
    return (
      <div>
        <p className="deliveryText">
          <a href={tel}>{props.requesterInfo.phoneNumber}</a>
        </p>
        <p className="deliveryText">
          <a href={linkToMap} rel="noopener noreferrer" target="_blank">
            {props.requesterInfo.street}, {props.requesterInfo.apartment},{" "}
            {props.requesterInfo.city}, {props.requesterInfo.state}{" "}
            {props.requesterInfo.zipCode}
          </a>
        </p>
        <p className="deliveryText">
          {props.requesterInfo.dropoffInstructions}
        </p>
      </div>
    );
  };

  return (
    <div>
      <br />
      <SuccessModal
        open={showCanHelpSuccessModal}
        onClose={handleCanHelpSuccessModalClick}
        title={"Thank you for volunteering for this event!"}
        textArray={["This event will now be added to your helper runs."]}
        primaryButtonText={t("okayGotIt")}
        primaryOnClick={handleCanHelpSuccessModalClick}
      />

      {/*
        The ErrorModal component is not as flexible as the SuccessModal,
        hence the SuccessModal is used as an ErrorModal here.
        TODO: Refactor the SuccessModal as a general-purpose Modal OR improve the ErrorModal
      */}
      <SuccessModal
        open={showCanHelpErrorModal}
        onClose={handleCanHelpErrorModalClick}
        title={"Sorry! We are unable to sign you in for this event!"}
        textArray={["There was an error signing you in for this event."]}
        primaryButtonText={t("okayGotIt")}
        primaryOnClick={handleCanHelpErrorModalClick}
      />

      {/*Check In To Event*/}
      <SuccessModal
        open={showCheckInEventModal}
        onClose={() => setShowCheckInEventModal(false)}
        title={"Check In to Event"}
        textArray={["Would you like to check in to this event?"]}
        primaryButtonText={"Check In"}
        primaryOnClick={checkInToEvent}
      />

      {/*Leave Event*/}
      <SuccessModal
        open={showLeaveEventModal}
        onClose={() => setShowLeaveEventModal(false)}
        title={"Leave Event?"}
        textArray={[
          "Would you like to cancel your registration as a volunteer for this Community Delivery Event?",
        ]}
        primaryButtonText={"Leave Event"}
        primaryOnClick={leaveEvent}
      />
      {request && (
        <Dimmer.Dimmable
          as={Container}
          dimmed
          className="communityEventCardContent">
          {loading && (
            <Dimmer simple>
              <Loader />
            </Dimmer>
          )}
          {props.editable && (
            <div className="editEventButton">
              <Label as="a" color="yellow" onClick={props.editCallback}>
                Edit
              </Label>
            </div>
          )}
          <div className="individualRequestHeaderLine">
            <span className="communityEventTitle">COMMUNITY DELIVERY</span>
            <span className="individualRequestTime">
              <Moment fromNow>
                {request.timeCreated._seconds * 1000 ||
                  request.timeCreated.seconds * 1000}
              </Moment>
            </span>
          </div>
          <Grid stackable>
            <Grid.Row>
              <Grid.Column width={8}>
                <p className="communityEventName">{request.eventName}</p>
                <p className="communityEventSupplierInfo">
                  At {request.supplierInfo.name}
                </p>
                <p className="communityEventSupplierInfo">
                  {request.supplierInfo.street}, {request.supplierInfo.city},{" "}
                  {request.supplierInfo.state}, {request.supplierInfo.zipCode}
                </p>
                <br />
                <p className="communityEventSupplierInfo">
                  Contact an admin: {request.phoneNumber}
                  {request.phoneNumberExtension
                    ? `, ext. ${request.phoneNumberExtension}`
                    : ""}
                </p>
                <h1 className="communityEventDescription">
                  <Moment
                    format="dddd MMM D"
                    date={
                      request.eventTime.seconds * 1000 ||
                      request.eventTime._seconds * 1000
                    }
                  />
                  <br />
                  <Moment
                    format="LT"
                    date={
                      request.eventTime.seconds * 1000 ||
                      request.eventTime._seconds * 1000
                    }
                  />
                  {" - "}
                  <Moment
                    format="LT"
                    date={
                      request.eventTimeEnd.seconds * 1000 ||
                      request.eventTimeEnd._seconds * 1000
                    }
                  />
                </h1>
                <p className="communityEventSupplierInfo">
                  Up to {request.recipientsPerVolunteer} recipient
                  {request.recipientsPerVolunteer > 1 ? "s" : ""}
                </p>
              </Grid.Column>
              <Grid.Column width={8}>
                {(props.acceptable || props.signedUp) && (
                  <div className="joinCommunityEventDiv">
                    <div>
                      <div className="volunteersSignedUpContainer">
                        <p className="numVolunteersSignedUpText">
                          {request.volunteers.length} signed up
                        </p>
                      </div>
                      <br />
                      <div className="progressBarOuter">
                        <div
                          className="progressBarInner"
                          style={{
                            width: `${
                              request.volunteers.length >= request.maxVolunteers
                                ? 100
                                : parseFloat(
                                    request.volunteers.length /
                                      request.maxVolunteers
                                  ) * 100
                            }%`,
                          }}></div>
                      </div>
                      <br />
                      <div>
                        <p className="volunteersNeededText">
                          {Math.max(
                            0,
                            request.maxVolunteers - request.volunteers.length
                          )}{" "}
                          volunteers needed
                        </p>
                      </div>
                      <br />
                      <div className="communityAcceptOptions">
                        {props.acceptable &&
                          (request.volunteers.includes(globalState.user.uid) ? (
                            <p className="externalLink">You have signed up!</p>
                          ) : (
                            <UIButton
                              small
                              className="iCanHelpCommunityBtn"
                              disabled={
                                request.volunteers.length >=
                                request.maxVolunteers
                              }
                              loading={loading}
                              onClick={signUpforEvent}
                              text={t("iCanHelp")}
                            />
                          ))}
                      </div>
                    </div>
                  </div>
                )}
              </Grid.Column>
            </Grid.Row>
          </Grid>

          {props.volunteerView && (
            <div>
              {!request.volunteerInfo.checkedIn && (
                <div>
                  <div className="checkInButtonContainer">
                    <UIButton
                      loading={loading}
                      onClick={() => setShowCheckInEventModal(true)}
                      disabled={
                        request.eventTime._seconds * 1000 > now.getTime() ||
                        request.eventTimeEnd._seconds * 1000 < now.getTime()
                      }
                      small
                      text={"Check in"}
                    />
                  </div>
                  <br />
                  {/* Before event start time, display when check in will be available */}
                  {request.eventTime._seconds * 1000 > now.getTime() && (
                    <div>
                      <p className="checkInText checkInSubtext">
                        Check-in available at{" "}
                        <Moment
                          format="LT"
                          date={
                            request.eventTime.seconds * 1000 ||
                            request.eventTime._seconds * 1000
                          }
                        />{" "}
                        on{" "}
                        <Moment
                          format="MMMM D"
                          date={
                            request.eventTime.seconds * 1000 ||
                            request.eventTime._seconds * 1000
                          }
                        />
                        .
                      </p>
                    </div>
                  )}
                  {/* While event check-in is active, display t&c/pp/cg */}
                  {request.eventTime._seconds * 1000 < now.getTime() &&
                    request.eventTimeEnd._seconds * 1000 > now.getTime() && (
                      <div>
                        <p className="checkInText">
                          By checking in, you agree to our{" "}
                          <Link to="/terms">Terms of Service</Link>,{" "}
                          <Link to="/privacy">Privacy Policy</Link>, and{" "}
                          <Link to="/community">Community Guidelines</Link>.
                        </p>
                      </div>
                    )}
                  <br />
                  <div>
                    <p className="checkInText">
                      You will need to check-in once you arrive at your pick-up
                      location. This lets us know you arrived so we can load
                      your car with packages and assign up to 5 deliveries.
                    </p>
                  </div>
                  <br />
                </div>
              )}

              {canBeDisplayed(props.request.eventTime._seconds) &&
                !props.past &&
                request.volunteerInfo.routeLink && (
                  <div>
                    <br />
                    <a href={request.volunteerInfo.routeLink}>
                      <p className="readMoreInstructions">
                        Click here for your delivery route
                      </p>
                    </a>
                  </div>
                )}
              <br />
              {Object.keys(request.volunteerInfo.assignedRequests).map(
                (key, index) => {
                  let startTime = request.eventTime._seconds;
                  let firstName =
                    request.volunteerInfo.assignedRequests[key]
                      .requesterFirstName;
                  let lastName =
                    request.volunteerInfo.assignedRequests[key].requesterInfo
                      .lastName;
                  let tel =
                    "tel:" +
                    request.volunteerInfo.assignedRequests[key].requesterInfo
                      .phoneNumber;
                  let linkToMap =
                    "http://maps.google.com/maps?q=" +
                    request.volunteerInfo.assignedRequests[key].requesterInfo
                      .street +
                    " " +
                    request.volunteerInfo.assignedRequests[key].requesterInfo
                      .city +
                    " " +
                    request.volunteerInfo.assignedRequests[key].requesterInfo
                      .state +
                    " " +
                    request.volunteerInfo.assignedRequests[key].requesterInfo
                      .zipCode;

                  return (
                    <div className="deliveryItem">
                      <p className="deliveryItemNumber">
                        Delivery #{index + 1}
                      </p>
                      <p className="deliveryText deliveryFirstName">
                        {firstName} {lastName ? lastName[0] : ""}
                      </p>
                      {canBeDisplayed(startTime) &&
                        privateInfo(
                          request.volunteerInfo.assignedRequests[key],
                          tel,
                          linkToMap
                        )}
                    </div>
                  );
                }
              )}
              <div className="eventDetailsSection">
                <br />
                {showInstructions && (
                  <div className={"RichEditor-editor"}>
                    <Editor
                      blockStyleFn={getBlockStyle}
                      customStyleMap={styleMap}
                      editorState={editorState}
                      readOnly
                    />
                  </div>
                )}
                <br />
                <p
                  onClick={() => toggleInstructions(!showInstructions)}
                  className="readMoreInstructions">
                  {showInstructions
                    ? "Collapse instructions"
                    : "Read instructions"}
                </p>
              </div>
              <br />
            </div>
          )}

          {props.signedUp && request.volunteers.includes(globalState.user.uid) && (
            <div className="leaveEventButtonContainer">
              <UIButton
                loading={loading}
                onClick={() => setShowLeaveEventModal(true)}
                small
                disabled={request.volunteerInfo.checkedIn}
                text={"Leave Event"}
              />
            </div>
          )}
          {props.admin && (
            <div className="adminVolunteerContainer">
              <div className={"RichEditor-editor"}>
                <Editor
                  blockStyleFn={getBlockStyle}
                  customStyleMap={styleMap}
                  editorState={editorState}
                  readOnly
                />
              </div>
              <Comment.Group threaded>
                <Header as="h2">Volunteers</Header>
                {Object.keys(request.volunteerInfo).map((key) => (
                  <Comment>
                    <Comment.Avatar
                      as="a"
                      src={request.volunteerInfo[key].personalInfo.photoUrl}
                    />
                    <Comment.Content>
                      <Comment.Author as="a">
                        <Header as="h3">
                          {request.volunteerInfo[key].personalInfo.firstName}{" "}
                          {request.volunteerInfo[key].personalInfo.lastName}
                        </Header>
                        Mobile:{" "}
                        {request.volunteerInfo[key].personalInfo.phoneNumber}
                        <br />
                        Email: {request.volunteerInfo[key].personalInfo.email}
                      </Comment.Author>
                      <Comment.Metadata>
                        <span>
                          {request.volunteerInfo[key].checkedIn
                            ? "Checked In!"
                            : "Not Checked In!"}
                        </span>
                      </Comment.Metadata>
                      <Comment.Text>
                        <p>
                          {request.volunteerInfo[key].personalInfo.aboutUser}
                        </p>
                      </Comment.Text>
                    </Comment.Content>

                    <Comment.Group>
                      <Header as="h4">Deliveries</Header>
                      {Object.keys(
                        request.volunteerInfo[key].assignedRequests
                      ).map((req, index) => (
                        <Comment>
                          <Comment.Content>
                            <Comment.Author as="a">
                              {
                                request.volunteerInfo[key].assignedRequests[req]
                                  .requesterFirstName
                              }{" "}
                              {
                                request.volunteerInfo[key].assignedRequests[req]
                                  .requesterInfo.lastName
                              }{" "}
                              (
                              {
                                request.volunteerInfo[key].assignedRequests[req]
                                  .requesterInfo.phoneNumber
                              }
                              )
                            </Comment.Author>
                            <Comment.Metadata>
                              <span>Delivery #{index + 1}</span>
                            </Comment.Metadata>
                            <Comment.Text>
                              {
                                request.volunteerInfo[key].assignedRequests[req]
                                  .requesterInfo.street
                              }
                              ,{" "}
                              {
                                request.volunteerInfo[key].assignedRequests[req]
                                  .requesterInfo.apartment
                              }
                              ,{" "}
                              {
                                request.volunteerInfo[key].assignedRequests[req]
                                  .requesterInfo.city
                              }
                              ,{" "}
                              {
                                request.volunteerInfo[key].assignedRequests[req]
                                  .requesterInfo.state
                              }{" "}
                              {
                                request.volunteerInfo[key].assignedRequests[req]
                                  .requesterInfo.zipCode
                              }
                            </Comment.Text>
                            {!props.past && (
                              <Comment.Actions
                                onClick={() => unassignDelivery(key, req)}>
                                <Label color="red" horizontal>
                                  UNASSIGN
                                </Label>
                              </Comment.Actions>
                            )}
                          </Comment.Content>
                        </Comment>
                      ))}
                    </Comment.Group>
                  </Comment>
                ))}
              </Comment.Group>
            </div>
          )}
        </Dimmer.Dimmable>
      )}
    </div>
  );
}

export default function EventList(props) {
  const [events, setEvents] = useState({ ...props.events });
  useEffect(() => {
    setEvents(props.events);
  }, [props.events]);

  return (
    <div className="requestsList">
      {Object.keys(events).map((key, index) => (
        <EventCard
          key={key}
          request={events[key]}
          sensitive
          editable={props.editable}
          past={props.past}
          volunteerView={props.volunteerView}
          acceptable={props.acceptable}
          signedUp={props.signedUp}
          admin={props.admin}
          editCallback={() => props.editCallback(index)}
          refreshParent={props.refreshParent}
        />
      ))}
    </div>
  );
}
