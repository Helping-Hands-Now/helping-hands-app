import React, { useState, useEffect } from "react";
import {
  Container,
  Card,
  Table,
  Label,
  Image,
  Grid,
  Button,
  Dropdown,
} from "semantic-ui-react";
import Moment from "react-moment";
import { db } from "../../../firebase.js";
import "semantic-ui-css/semantic.min.css";
import { Icon } from "semantic-ui-react";
import useGlobalState from "../../../hooks/useGlobalState";
import moment from "moment";
import RMoment from "react-moment";
import geohash from "ngeohash";
import GeohashDistance from "geohash-distance";
import ReactMapGL, { Marker, Popup } from "react-map-gl";
import geohashQueries from "../../../utils/DistanceQueryFunctions";
import { Link } from "react-router-dom";

import UITextArea from "../../UI/UITextArea";
import PolylineOverlay from "../PolyLineOverlay";

import {
  closeRequestGivenOutcome,
  getInspectedRequestData,
} from "../../../firebase.js";

const PUBLIC_TOKEN =
  "pk.eyJ1IjoieWFzaGhoIiwiYSI6ImNrOGxkcXp4ODAzZmczZm12dTV1ejI1bzQifQ.S8S6qlTHoENZvqdGgQaXJA";

export default function InspectRequestComp(props) {
  // options
  // {
  //   disableAdminComments: false,
  //   disableBehalfColumn: false,
  //   editableNeeds: false,
  //   showSocialWorkerColumn: true,
  //   mode: ['active', 'closed'] // active requests we don't expect closed in there.
  //   canCancelRequests: mode === "active" ? true : false,
  //   cancelOrgRequest: cancelOrgRequest // function to cancel request
  //   console: "partner" // this is needed to enable partner console users to use admin functions
  //}
  const options = props.options || {};
  const showComments = !options.disableAdminComments;
  const consoleType = options.console === "partner" ? "partner" : "";
  // can only edit needs if request is open
  const editableNeeds =
    !!options.editableNeeds && props.inspectedRequest?.status === "open";
  const [createdBy, setCreatedBy] = useState({});
  const [beneficiary, setBeneficiary] = useState({});
  const [helper, setHelper] = useState({});
  const [editingNeeds, setEditingNeeds] = useState(false);
  const [editedNeeds, setEditedNeeds] = useState(props.inspectedRequest?.needs);

  const [loading, setLoading] = useState(false);

  const [requestAge, setRequestAge] = useState(null);
  const [requestOutcome, setRequestOutcome] = useState(null);
  const [requestStatus, setRequestStatus] = useState(null);

  const [isBeneficiaryRequest, setIsBeneficiaryRequest] = useState(null);

  const [adminComments, setAdminComments] = useState([]);
  const [comment, setComment] = useState("");
  const [requestCoords, setRequestCoords] = useState({});
  const [createdByCoords, setCreatedByCoords] = useState({});
  const [beneficiaryCoords, setBeneficiaryCoords] = useState({});
  const [helperCoords, setHelperCoords] = useState({});
  const [userLocations, setUserLocations] = useState([]);
  const [selectedUserLocation, setSelectedUserLocation] = useState(null);
  const DistanceToQuery = 25;
  const maxNumberOfNearbyUsers = 10;

  const [dropdownLoading, setDropdownLoading] = useState({
    loading: false,
    icon: null,
  });

  const globalState = useGlobalState();

  const diff_hours = (dt2, dt1) => {
    return moment
      .duration(moment(dt1).diff(moment(dt2)))
      .asHours()
      .toFixed(1);
  };

  const PENDING = "pending_fulfillment";
  const OPEN = "open";
  const CLOSED = "closed";

  const canChangeStatus = options.canChangeStatus;

  const pendingToClosedOptions = [
    {
      key: 0,
      text: "Open",
      value: "open",
    },
    {
      key: 1,
      text: "Closed - Failed",
      value: "failed",
    },
    {
      key: 2,
      text: "Closed - Invalid",
      value: "invalid",
    },
  ];

  const openToClosedOptions = [
    {
      key: 0,
      text: "Open",
      value: "open",
    },
    {
      key: 1,
      text: "Closed - Invalid",
      value: "invalid",
    },
  ];

  const GetAgeInDays = (age) => {
    var requestAgeInDays = "";
    var day = Math.floor(age / 24);
    var hours = Math.floor(age % 24);
    var daysString = day > 1 ? " days " : " day ";
    var hoursString = hours > 1 ? " hrs " : " hr ";
    return (requestAgeInDays = day + daysString + hours + hoursString);
  };

  const showRequestDetails = async () => {
    if (
      props.inspectedRequest.status === PENDING ||
      props.inspectedRequest.status === OPEN
    ) {
      setRequestAge(
        GetAgeInDays(
          diff_hours(new Date(props.inspectedRequest.timeCreated), new Date())
        )
      );

      NearbyVolunteers(DistanceToQuery);
    } else if (props.inspectedRequest.status === CLOSED) {
      setRequestAge(
        GetAgeInDays(
          diff_hours(
            new Date(props.inspectedRequest.timeCreated),
            new Date(props.inspectedRequest.closingVerifiedTextTimeSent)
          )
        )
      );
    }

    setRequestCoords(geohash.decode(props.inspectedRequest.geohash));

    setIsBeneficiaryRequest(
      Boolean(
        props.inspectedRequest.createdBy !== props.inspectedRequest.requester
      )
    );

    let createdByType = props.inspectedRequest.createdByType;

    try {
      setCreatedBy(props.inspectedRequest.creator);
      setCreatedByCoords(
        geohash.decode(props.inspectedRequest.creator.geohash)
      );
    } catch (error) {
      console.log("Could not find requestor creator's details: ", error);
    }

    if (props.inspectedRequest.createdBy !== props.inspectedRequest.requester) {
      getInspectedRequestData({
        id: props.inspectedRequest.requester,
        consoleType: consoleType,
      })
        .then((user) => {
          setBeneficiary(user.data);
          setBeneficiaryCoords(geohash.decode(user.data.geohash));
        })
        .catch((err) => {
          console.log("There was an error: ", err);
        });
    }

    if (props.inspectedRequest.helper) {
      getInspectedRequestData({
        id: props.inspectedRequest.helper,
        consoleType: consoleType,
      })
        .then((user) => {
          setHelper(user.data);
          setHelperCoords(geohash.decode(user.data.geohash));
        })
        .catch((err) => {
          console.log("There was an error: ", err);
        });
    }

    if (props.inspectedRequest.adminData) {
      setAdminComments(props.inspectedRequest.adminData.comments);
    } else {
      setAdminComments([]);
    }

    setRequestStatus(props.inspectedRequest.status);
    setRequestOutcome(props.inspectedRequest.outcome);
  };

  const addAdminComment = () => {
    setLoading(true);
    var newArr = adminComments;
    newArr.push({
      comment: comment,
      name: globalState.userInfo.firstName,
      admin: globalState.user.uid,
      time: new Date(),
    });

    db.collection("requests")
      .doc(props.inspectedRequest.id)
      .collection("admin")
      .doc("metaData")
      .set(
        {
          comments: newArr,
        },
        { merge: true }
      )
      .then(function () {
        props.updateObject(props.inspectedRequest.id);
      })
      .catch(function (error) {
        console.error("Error writing document: ", error);
      })
      .finally(function () {
        setLoading(false);
      });
  };

  useEffect(() => {
    if (props.inspectedRequest !== null) {
      setCreatedBy({});
      setBeneficiary({});
      setHelper({});
      setRequestAge(null);
      setIsBeneficiaryRequest(null);
      setRequestCoords({});
      setCreatedByCoords({});
      setBeneficiaryCoords({});
      setHelperCoords({});
      showRequestDetails();
      setUserLocations([]);
      setSelectedUserLocation(null);
      setEditingNeeds(false);
      setEditedNeeds(props.inspectedRequest.needs);
    }
  }, [props.inspectedRequest]);

  const _onViewportChange = (viewport) => setViewPort({ ...viewport });

  const [viewport, setViewPort] = useState({
    width: "100%",
    height: 500,
    zoom: 8,
    latitude: requestCoords.latitude,
    longitude: requestCoords.longitude,
  });

  async function NearbyVolunteers(distance) {
    var obj = [];
    var index = 0;
    var queries = getQueriesForDocumentsAround(
      geohash.decode(props.inspectedRequest.geohash),
      distance * 1609
    ); // this queries all users  within 25 milies of the inspectedRequester.
    queries.forEach((query) => {
      getInspectedRequestData({
        location: query,
        consoleType: consoleType,
      })
        .then(async (querySnapshot) => {
          var results = await queryRequestData(
            db,
            querySnapshot.data,
            consoleType
          );

          for (var i = 0; i < results.length; i++) {
            if (results[i].requestDistance <= distance) {
              obj.push(results[i]);
            }
          }

          index++;
          if (index === queries.length) {
            // Sorts the array is ascending order and picks the top 10 closest volunteers

            obj.sort(function (a, b) {
              return a.requestDistance - b.requestDistance;
            });
            if (obj.length > maxNumberOfNearbyUsers) {
              setUserLocations(obj.slice(0, maxNumberOfNearbyUsers));
            } else {
              setUserLocations(obj);
            }
          }
        })
        .catch((e) => {
          console.log("There was an unexpected error ", e);
        });
    });
  }

  function queryRequestData(db, querySnapshot, consoleType = "") {
    return new Promise(function (fulfilled, rejected) {
      var allusers = [];
      var counter = 0;

      if (querySnapshot.length === 0) {
        fulfilled([]);
      }

      querySnapshot.forEach(async function (userDoc) {
        var userData = userDoc;

        const userId = userDoc.id;
        if (userData.canHelp === true && props.inspectedRequest.id !== userId) {
          userData.id = userId;
          userData.coordinates = geohash.decode(userData.geohash);

          let snapshot = await db
            .collection("requests")
            .where("helper", "==", userId)
            .where("status", "==", "closed")
            .get()
            .catch((e) => {
              console.log("Insufficient permissions: ", e);
            });

          userData.numberOfCompletedRequests = snapshot.size;
          var requestDistance =
            Math.round(
              GeohashDistance.inMiles(
                props.inspectedRequest.geohash,
                userData.geohash
              ) * 10
            ) / 10;
          userData.requestDistance = requestDistance;
          allusers.push(userData);
        }
        counter++;

        if (counter === querySnapshot.length) {
          fulfilled(allusers);
        }
      });
    });
  }

  const getQueriesForDocumentsAround = (center, radius) => {
    var geohashesToQuery = geohashQueries(center, radius);
    return geohashesToQuery.map(function (location) {
      return location;
    });
  };

  const showPopup = (user) => {
    setSelectedUserLocation(user);
  };

  const closePopup = () => {
    setSelectedUserLocation(null);
  };

  const saveNeeds = () => {
    db.collection("requests").doc(props.inspectedRequest.id).update({
      needs: editedNeeds,
    });
    props.inspectedRequest.needs = editedNeeds;
    setEditingNeeds(false);
  };

  const HandleDropdownChange = (event, data) => {
    var outcome = data.value;
    if (outcome === "open") {
      return;
    }
    closeRequestGivenOutcome({
      requestId: props.inspectedRequest.id,
      outcome: outcome,
    })
      .then((result) => {
        console.log(result);
        setRequestStatus("closed");
        setRequestOutcome(outcome);
        return;
      })
      .catch((error) => {
        console.log(error);
      })
      .finally(() => {});
  };

  function capitalize(string) {
    if (string != null) {
      return string.charAt(0).toUpperCase() + string.slice(1).toLowerCase();
    }
  }

  return (
    <Card fluid style={{ overflow: "scroll", height: "90vh" }}>
      <Card.Content header="Inspected Request" />
      <Card.Content extra>
        <Table celled>
          <Table.Header>
            <Table.Row>
              {requestStatus == CLOSED ? (
                <Table.HeaderCell>Outcome</Table.HeaderCell>
              ) : (
                <Table.HeaderCell>Status</Table.HeaderCell>
              )}
              <Table.HeaderCell>Time Created</Table.HeaderCell>
              <Table.HeaderCell>Time Accepted</Table.HeaderCell>
              <Table.HeaderCell>Time Closed</Table.HeaderCell>
              <Table.HeaderCell>Request Age</Table.HeaderCell>
              <Table.HeaderCell>Action Status</Table.HeaderCell>
              <Table.HeaderCell>Completion Indication</Table.HeaderCell>
            </Table.Row>
          </Table.Header>

          <Table.Body>
            <Table.Row>
              <Table.Cell textAlign="center" className="single line">
                {/* Status/Outcome */}
                {requestStatus === OPEN || requestStatus === PENDING ? (
                  <div>
                    <div>
                      <Label
                        as="a"
                        color={
                          (requestStatus === OPEN && "red") ||
                          (requestStatus === PENDING && "yellow")
                        }>
                        <h5>{capitalize(requestStatus)}</h5>
                      </Label>
                    </div>
                    {canChangeStatus ? (
                      <div>
                        <Dropdown
                          text="Change"
                          textAlign="center"
                          icon={null}
                          style={{ color: "blue", marginTop: "5px" }}
                          options={
                            (requestStatus === OPEN && openToClosedOptions) ||
                            (requestStatus === PENDING &&
                              pendingToClosedOptions)
                          }
                          onChange={HandleDropdownChange}
                        />
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <Label as="a" color={"green"}>
                    <h5>{capitalize(requestOutcome)}</h5>
                  </Label>
                )}
              </Table.Cell>
              <Table.Cell>
                {/*Time Created*/}
                {props.inspectedRequest.timeCreated && (
                  <Label as="a" color={"grey"}>
                    <h5>
                      <Moment
                        format="LLLL"
                        date={props.inspectedRequest.timeCreated}
                      />
                    </h5>
                  </Label>
                )}
              </Table.Cell>
              <Table.Cell>
                {/*Time Accepted*/}
                {props.inspectedRequest.timeAccepted && (
                  <Label as="a" color={"grey"}>
                    <h5>
                      <Moment
                        format="LLLL"
                        date={props.inspectedRequest.timeAccepted}
                      />
                    </h5>
                  </Label>
                )}
              </Table.Cell>
              <Table.Cell>
                {/*Time Closed*/}
                {requestStatus == CLOSED && props.inspectedRequest.timeClosed && (
                  <Label as="a" color={"grey"}>
                    <h5>
                      <Moment
                        format="LLLL"
                        date={props.inspectedRequest.timeClosed.seconds * 1000}
                      />
                    </h5>
                  </Label>
                )}
              </Table.Cell>
              <Table.Cell>
                {/*Request Age*/}
                {props.inspectedRequest.timeAccepted && (
                  <Label as="a" color={"grey"}>
                    <h5>{requestAge}</h5>
                  </Label>
                )}
              </Table.Cell>
              <Table.Cell>
                {/*Action Status*/}
                {requestStatus !== CLOSED ? (
                  <Label
                    as="a"
                    color={
                      (requestAge > 48 && "red") ||
                      (requestAge <= 48 && requestAge > 24 && "yellow") ||
                      (requestAge <= 24 && "green")
                    }>
                    <h5>
                      {requestAge > 48 && "Critical"}
                      {requestAge <= 48 && requestAge > 24 && "Warn"}
                      {requestAge <= 24 && "Okay"}
                    </h5>
                  </Label>
                ) : (
                  <Label as="a">
                    <h5>Done</h5>
                  </Label>
                )}
              </Table.Cell>
              <Table.Cell>
                {/*Completiton Indication*/}
                {requestStatus === CLOSED ? (
                  <Label as="a" color={"grey"}>
                    <h5>{props.inspectedRequest.CompletionIndicationType}</h5>
                  </Label>
                ) : requestStatus === PENDING ? (
                  <h5>Request Still Pending</h5>
                ) : (
                  <h5>Request Still Open</h5>
                )}
              </Table.Cell>
            </Table.Row>
          </Table.Body>
        </Table>
        {isBeneficiaryRequest && (
          <Label as="a" color={"orange"}>
            {"This is a beneficiary request"}
          </Label>
        )}
        <Grid columns={isBeneficiaryRequest ? 2 : 1} divided>
          <Grid.Row>
            <Grid.Column>
              {/*Display Requester*/}
              <Card fluid>
                <Card.Content>
                  {createdBy.photoUrl && (
                    <Image
                      floated="right"
                      size="mini"
                      src={createdBy.photoUrl}
                    />
                  )}
                  <Card.Header>
                    {createdBy.firstName} {createdBy.lastName}{" "}
                    <Label as="a">
                      <h5>Requester</h5>
                    </Label>
                  </Card.Header>
                  <Card.Meta>
                    <strong>{createdBy.phoneNumber}</strong>
                  </Card.Meta>
                  <Card.Description>{createdBy.aboutUser}</Card.Description>
                </Card.Content>
              </Card>
            </Grid.Column>
            <Grid.Column>
              {/*Display beneficiary*/}
              {isBeneficiaryRequest && (
                <Card fluid>
                  <Card.Content>
                    <Card.Header>
                      {beneficiary.firstName} {beneficiary.lastName}{" "}
                      <Label as="a" color="orange">
                        <h5>Beneficiary</h5>
                      </Label>
                    </Card.Header>
                    <Card.Meta>
                      <strong>{beneficiary.phoneNumber}</strong>
                    </Card.Meta>
                    <Card.Description>{beneficiary.aboutUser}</Card.Description>
                  </Card.Content>
                </Card>
              )}
            </Grid.Column>
          </Grid.Row>
        </Grid>
        {/*Request address*/}
        <Card fluid>
          <Card.Content>
            {isBeneficiaryRequest ? (
              <Card.Header>
                Delivery Address: {beneficiary.street} {beneficiary.apartment},{" "}
                {beneficiary.city}, {beneficiary.state}, {beneficiary.zipCode}
              </Card.Header>
            ) : (
              <Card.Header>
                Delivery Address: {createdBy.street} {createdBy.apartment},{" "}
                {createdBy.city}, {createdBy.state}, {createdBy.zipCode}
              </Card.Header>
            )}
          </Card.Content>
        </Card>
        {/*Needs*/}
        <Card fluid>
          <Card.Content>
            <Card.Header>
              <Grid columns={editableNeeds ? 2 : 1}>
                <Grid.Column>Needs</Grid.Column>
                <Grid.Column>
                  {editableNeeds && (
                    <Container fluid textAlign="right">
                      <Link onClick={() => setEditingNeeds(true)} to="#">
                        <Icon name="pencil" />
                      </Link>
                    </Container>
                  )}
                </Grid.Column>
              </Grid>
            </Card.Header>
            <Card.Description>
              {editingNeeds ? (
                <UITextArea
                  value={editedNeeds}
                  hook={(e) => setEditedNeeds(e.target.value)}
                  onBlur={saveNeeds}
                />
              ) : (
                props.inspectedRequest.needs
              )}
            </Card.Description>
          </Card.Content>
        </Card>
        {/*Helper*/}
        {Object.keys(helper).length > 0 && (
          <Card fluid>
            <Card.Content>
              <Image floated="right" size="mini" src={helper.photoUrl} />
              <Card.Header>
                {helper.firstName} {helper.lastName}{" "}
                <Label as="a">
                  <h5>Helper</h5>
                </Label>
              </Card.Header>
              <Card.Meta>
                <strong>{helper.phoneNumber}</strong>
              </Card.Meta>
              <Card.Description>{helper.aboutUser}</Card.Description>
            </Card.Content>
          </Card>
        )}
        {/*Comments*/}
        {showComments && (
          <Card fluid>
            <Card.Content>
              <Card.Header>Admin Comments</Card.Header>
              <Card.Description>
                {Object.keys(adminComments).map((key, index) => (
                  <div>
                    <div
                      style={{
                        padding: "10px",
                        borderRadius: "5px",
                        backgroundColor: "#DCDCDC",
                      }}>
                      <p>{adminComments[index].name}</p>
                      <RMoment
                        format="LLLL"
                        date={
                          adminComments[index].time.seconds * 1000
                        }></RMoment>
                      <p>{adminComments[index].comment}</p>
                    </div>
                    <br />
                  </div>
                ))}
                <UITextArea
                  placeholder={"Comments"}
                  hook={(e) => setComment(e.target.value)}
                  value={comment}
                />
              </Card.Description>
            </Card.Content>
            <Button
              loading={loading}
              onClick={() => {
                setComment("");
                addAdminComment();
              }}>
              Save
            </Button>
          </Card>
        )}
        <Label as="a" style={{ backgroundColor: "#66c2a5" }}>
          Request
        </Label>
        <Label as="a" style={{ backgroundColor: "#3288bd" }}>
          Helper
        </Label>
        <br />
        <br />
        <ReactMapGL
          {...viewport}
          latitude={
            Object.keys(helperCoords).length > 0
              ? (requestCoords.latitude + helperCoords.latitude) / 2
              : requestCoords.latitude
          }
          longitude={
            Object.keys(helperCoords).length > 0
              ? (requestCoords.longitude + helperCoords.longitude) / 2
              : requestCoords.longitude
          }
          onViewportChange={_onViewportChange}
          mapboxApiAccessToken={PUBLIC_TOKEN}>
          {Object.keys(helperCoords).length > 0 && (
            <PolylineOverlay
              points={[
                [requestCoords.longitude, requestCoords.latitude],
                [helperCoords.longitude, helperCoords.latitude],
              ]}
            />
          )}
          <Marker
            latitude={requestCoords.latitude}
            longitude={requestCoords.longitude}
            offsetLeft={-6}
            offsetTop={-3}>
            {/*Request marker*/}
            <div
              style={{
                height: "10px",
                width: "10px",
                borderRadius: "10px",
                backgroundColor: "#66c2a5",
              }}></div>
          </Marker>
          {Object.keys(helperCoords).length > 0 && (
            <Marker
              latitude={helperCoords.latitude}
              longitude={helperCoords.longitude}
              offsetLeft={-6}
              offsetTop={-3}>
              {/*Helper marker*/}
              <div
                style={{
                  height: "10px",
                  width: "10px",
                  borderRadius: "10px",
                  backgroundColor: "#3288bd",
                }}></div>
            </Marker>
          )}
          {userLocations.length > 0 &&
            userLocations.map((user) => (
              <Marker
                key={user.id}
                latitude={user.coordinates.latitude}
                longitude={user.coordinates.longitude}>
                <Icon
                  name="user"
                  color="black"
                  size="small"
                  onClick={() => {
                    setSelectedUserLocation(user);
                  }}
                />
              </Marker>
            ))}
          {selectedUserLocation != null ? (
            <Popup
              latitude={parseFloat(selectedUserLocation.coordinates.latitude)}
              longitude={parseFloat(selectedUserLocation.coordinates.longitude)}
              title={"Nearby User Location"}
              onClose={() => {
                setSelectedUserLocation(null);
              }}>
              <p>
                <b>Nearby User Information</b>
              </p>
              <p>
                <b>Name:</b> {selectedUserLocation.firstName}{" "}
                {selectedUserLocation.lastName}
              </p>
              <p>
                <b>Phone Number:</b> {selectedUserLocation.phoneNumber}
              </p>
              <p>
                <b>Number Of Completed Requests:</b>{" "}
                {selectedUserLocation.numberOfCompletedRequests}
              </p>
              <p>
                <b>Distance from Requester:</b>{" "}
                {selectedUserLocation.requestDistance} {" miles"}
              </p>
            </Popup>
          ) : null}
        </ReactMapGL>
      </Card.Content>
    </Card>
  );
}
