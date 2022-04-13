import React, { useState, useEffect } from "react";
import "moment-timezone";
import { Container, Loader, Form, Grid } from "semantic-ui-react";
import "semantic-ui-css/semantic.min.css";
import useGlobalState from "../../hooks/useGlobalState";
import { db, analytics } from "../../firebase.js";
import GA from "../../utils/GoogleAnalytics";
import DashboardProfileSnippet from "../DashboardProfileSnippet";
import RequestsList from "../RequestsList";
import EventList from "../EventList";
import { useTranslation } from "react-i18next";
import {
  addLocationToRequests,
  queryPendingRequests,
  queryCommunityDeliveryEvents,
  getUserOrgMemberships,
} from "../../firebase.js";
import geohash from "ngeohash";
import GeohashDistance from "geohash-distance";
import "./styles.css";

import TabItem from "../UI/UITabs";
import Share from "../Share";
import geohashQueries from "../../utils/DistanceQueryFunctions";

export default function HelperBoard(props) {
  const { t } = useTranslation();

  const globalState = useGlobalState();

  var [initialPageLoad, setInitialPageLoad] = useState(false);
  var [activeTabIndex, setActiveTabIndex] = useState(1);
  var [seeMoreFinished, toggleSeeMoreFinished] = useState(false);
  var [distanceV, setDistanceV] = useState(25);
  var [communityDeliveryEvents, setCommunityDeliveryEvents] = useState([]);
  var [openRequests, setOpenRequests] = useState(null);
  var [pendingRequests, setPendingRequests] = useState(null);
  var [pendingEvents, setPendingEvents] = useState([]);
  var [finishedRequests, setFinishedRequests] = useState(null);
  var [finishedEvents, setFinishedEvents] = useState([]);
  var [userIsOrgMember, setUserIsOrgMember] = useState(false);

  // Used for conditional rendering to avoid the flicker we get when there are initially 0 requests in the open requests and community delivery event objects
  var [
    openRequestsFunctionExecuted,
    setOpenRequestsFunctionExecuted,
  ] = useState(false);
  var [
    communityDeliveryFunctionExecuted,
    setCommunityDeliveryFunctionExecuted,
  ] = useState(false);

  const options = [
    // TODO localize?
    { key: "5", text: "5 mi", value: 5 },
    { key: "10", text: "10 mi", value: 10 },
    { key: "15", text: "15 mi", value: 15 },
    { key: "20", text: "20 mi", value: 20 },
    { key: "25", text: "25 mi", value: 25 },
  ];

  function queryRequestData(db, querySnapshot, callback) {
    var allRequests = {};

    if (querySnapshot.size === 0) {
      callback({});
      return;
    }

    querySnapshot.forEach(function (requestDoc) {
      var requestData = requestDoc.data();
      const requestId = requestDoc.id;
      requestData.id = requestId;
      allRequests[requestId] = requestData;
      if (Object.keys(allRequests).length === querySnapshot.size) {
        callback(allRequests);
      }
    });
  }

  const distanceChanged = (distance) => {
    setDistanceV(distance);
    setOpenRequests({});
    queryOpenRequests(distance);
    queryCommunityEvents(distance);
  };

  // check if the user should have a hidden view if they
  // have not yet completed their background check
  // return the current status of the background check so
  // that we can track it via analytics:
  // - has_passed_check
  // - has_not_passed_check
  // - does_not_require_check
  const checkrCheck = (obj) => {
    var backgroundCheckStatus = "";

    if (globalState.userInfo.checkrVerified) {
      backgroundCheckStatus = "has_passed_check";
    } else if (
      globalState.userInfo.checkrVerified === null ||
      Object.keys(obj).length === 0
    ) {
      backgroundCheckStatus = "does_not_require_check";
    } else {
      backgroundCheckStatus = "has_not_passed_check";
    }
    return backgroundCheckStatus;
  };

  const orgMembershipCheck = () => {
    if (!globalState.user.uid) {
      return;
    }
    getUserOrgMemberships()
      .then((results) => {
        if (results.data.length > 0) {
          setUserIsOrgMember(true);
        }
      })
      .catch(function (error) {
        // TODO: add UI displaying error
        console.log(error);
      });
  };

  const queryCommunityEvents = (distance) => {
    var queries = getQueriesForCommunityEventsAround(
      geohash.decode(globalState.userInfo.geohash),
      distance * 1609
    );
    var futureEvents = {};
    var eventArr = [];
    var now = new Date();
    var currentTime = now.getTime();
    queries.forEach((query) => {
      query
        .get()
        .then((querySnapshot) => {
          var promises = [];
          querySnapshot.forEach((event) => {
            if (event.data().eventTime.seconds * 1000 > currentTime) {
              var eventObj = event.data();
              eventObj.id = event.id;
              if (futureEvents[event.data().supplierID]) {
                futureEvents[event.data().supplierID].push(eventObj);
              } else {
                futureEvents[event.data().supplierID] = [eventObj];
                promises.push(
                  db.collection("suppliers").doc(event.data().supplierID).get()
                );
              }
            }
          });
          return Promise.all(promises);
        })
        .then((results) => {
          results.forEach((supplier) => {
            if (supplier.data()) {
              var requestDistance =
                Math.round(
                  GeohashDistance.inMiles(
                    globalState.userInfo.geohash,
                    futureEvents[supplier.id][0].geohash
                  ) * 10
                ) / 10;
              if (requestDistance <= distance) {
                futureEvents[supplier.id].forEach((event) => {
                  event.supplierInfo = supplier.data();
                  eventArr.push(event);
                });
              }
            }
          });
        });
    });
    setCommunityDeliveryEvents(eventArr);
    setCommunityDeliveryFunctionExecuted(true);
  };

  const queryOpenRequests = (distance) => {
    var queries = getQueriesForDocumentsAround(
      geohash.decode(globalState.userInfo.geohash),
      distance * 1609
    );
    var obj = {};
    var index = 0;
    queries.forEach((query) => {
      query
        .get()
        .then((querySnapshot) => {
          return queryRequestData(db, querySnapshot, function (results) {
            results = Object.entries(results).sort((a, b) =>
              a[1].timeCreated < b[1].timeCreated ? 1 : -1
            );
            for (var i = 0; i < results.length; i++) {
              var requestDistance =
                Math.round(
                  GeohashDistance.inMiles(
                    globalState.userInfo.geohash,
                    results[i][1].geohash
                  ) * 10
                ) / 10;
              // add to the list of requests, if the distance is in bounds
              if (requestDistance <= distance) {
                obj[results[i][0]] = results[i][1];
              }
            }
          });
        })
        .then(() => {
          index++;
          if (index === queries.length) {
            // add the location data to the requests so that we
            // can display the city, state and neighborhood
            var addLocationToRequestData = {
              requests: obj,
            };
            addLocationToRequests(addLocationToRequestData)
              .then((result) => {
                updateOpenRequestsAndLogStats(result.data.data.requests);
              })
              .catch(function (error) {
                // if there was any error, just use the original requests
                // without the added location information
                updateOpenRequestsAndLogStats(obj);
              });

            if (!initialPageLoad) {
              GA.sendEvent({
                category: "page",
                action: "page_load",
                label: "requests_dash",
                value: Object.keys(obj).length,
              });
            }
            setInitialPageLoad(true);
          }
        });
    });
  };

  // this function sets the open requests to the ones fetched, as well
  // as fires the Firebase event with the stats that we track for
  // this page
  const updateOpenRequestsAndLogStats = (openRequests) => {
    // first check if the user should be seeing any of the requests
    // based on their current background check status
    var backgroundCheckStatus = checkrCheck(openRequests);

    // if we proceed here, next look up the user object to get the
    // state, city, zip to add to the firebase event
    db.collection("users")
      .doc(globalState.user.uid)
      .get()
      .then((doc) => {
        let city = "";
        let state = "";
        let zip = "";
        if (doc.exists) {
          const data = doc.data();
          city = data.city;
          state = data.state;
          zip = data.zipCode;
        }
        analytics.logEvent("volunteer_viewed_requests_dashboard", {
          available_requests: Object.keys(openRequests).length,
          user_id: globalState.user.uid,
          state: state,
          city: city,
          zip: zip,
          background_check_status: backgroundCheckStatus,
        });
      });

    // finally set the open requests
    setOpenRequests(openRequests);
    setOpenRequestsFunctionExecuted(true);
  };

  const queryPendingRequestsData = () => {
    queryPendingRequests()
      .then((result) => {
        // add the location data to the requests so that we
        // can display the city, state and neighborhood
        var addLocationToRequestData = {
          requests: result.data.requestsData,
        };
        addLocationToRequests(addLocationToRequestData)
          .then((result) => {
            setPendingRequests(result.data.data.requests);
          })
          .catch(function (error) {
            // if there was any error, just use the original requests
            // without the added location information
            setPendingRequests(result.data.requestsData);
          });
        if (Object.keys(result.data.requestsData).length > 0) {
          setActiveTabIndex(0);
        }
      })
      .catch(function (error) {
        // TODO: add UI displaying error
        console.log(error);
      });
  };

  const queryPendingEventsData = () => {
    queryCommunityDeliveryEvents({ type: "active" })
      .then((result) => {
        setPendingEvents(result.data.eventData);
        if (Object.keys(result.data.eventData).length > 0) {
          setActiveTabIndex(0);
        }
      })
      .catch(function (error) {
        // TODO: add UI displaying error
        console.log(error);
      });
  };

  const queryFinishedEventsData = () => {
    queryCommunityDeliveryEvents({ type: "past" })
      .then((result) => {
        setFinishedEvents(result.data.eventData);
      })
      .catch(function (error) {
        // TODO: add UI displaying error
        console.log(error);
      });
  };

  const queryFinishedRequests = () => {
    if (!globalState.user.uid) {
      return;
    }
    db.collection("requests")
      .where("helper", "==", globalState.user.uid)
      .where("status", "==", "closed")
      .get()
      .then(function (querySnapshot) {
        queryRequestData(db, querySnapshot, function (results) {
          // add the location data to the requests so we can display
          // the city, state and neighborhood
          var addLocationToRequestData = {
            requests: results,
          };
          addLocationToRequests(addLocationToRequestData)
            .then((result) => {
              setFinishedRequests(result.data.data.requests);
            })
            .catch(function (error) {
              // if there was any error, just use the original requests
              // without the added location information
              setFinishedRequests(results);
            });
        });
      });
  };

  const refreshData = async () => {
    orgMembershipCheck();
    distanceChanged(distanceV);
    queryPendingRequestsData();
    queryPendingEventsData();
    queryFinishedEventsData();
    queryFinishedRequests();
  };

  const getQueriesForDocumentsAround = (center, radius) => {
    var geohashesToQuery = geohashQueries(center, radius);
    return geohashesToQuery.map(function (location) {
      return db
        .collection("requests")
        .where("geohash", ">=", location[0])
        .where("geohash", "<=", location[1])
        .where("toBeFulfilledBy", "==", "VOLUNTEER")
        .where("status", "==", "open");
    });
  };

  const getQueriesForCommunityEventsAround = (center, radius) => {
    var geohashesToQuery = geohashQueries(center, radius);
    return geohashesToQuery.map(function (location) {
      return db
        .collection("community_events")
        .where("geohash", ">=", location[0])
        .where("geohash", "<=", location[1]);
    });
  };

  useEffect(() => {
    if (!globalState.user.uid) {
      return;
    }
    refreshData();
  }, [globalState.user.uid]);

  return (
    <div>
      {/* For BYOV pilot, July/August 2021 */}
      {/* Displaying modified UI to BYOV users, who do not have verified BGC
      {/* but are org members (role=VOLUNTEER in user_organizations)*/}
      {!globalState.userInfo.checkrVerified && userIsOrgMember ? (
        <div>
          {openRequests === null ||
          pendingRequests === null ||
          finishedRequests === null ? (
            <div className="dashboardContent">
              <Loader active inline="centered" />
            </div>
          ) : (
            <Container fluid>
              <br />
              <div>
                <div className="individualRequestsContainer">
                  <Grid columns="equal" stackable>
                    <Grid.Column>
                      <div className="myEventsDescription">
                        <h1 className="myEventsDescriptionHeader">
                          Your upcoming{" "}
                          {pendingEvents.length === 1 ? "event" : "events"}
                        </h1>
                        <p className="requestDescription">
                          {pendingEvents.length} community delivery
                        </p>
                      </div>
                    </Grid.Column>
                    <Grid.Column width={10}>
                      {pendingEvents.length > 0 && (
                        <div>
                          <EventList
                            volunteerView
                            signedUp
                            events={pendingEvents}
                            refreshParent={refreshData}
                          />
                          <br />
                        </div>
                      )}
                      {Object.keys(pendingRequests).length > 0 && (
                        <RequestsList
                          requests={pendingRequests}
                          refreshParent={refreshData}
                          sensitive
                        />
                      )}
                      {pendingEvents.length === 0 &&
                        Object.keys(pendingRequests).length === 0 &&
                        pendingRequests !== null && (
                          <div className="infoPrompt">
                            <h2 className="infoPrompt" as="h1">
                              {/*
                                * Note (kelsey, 07/27/2021): leave this out for now until
                                * we know how we want to prompt the BYOV users to sign up for
                                * events.
                              "t("noJobsYet")"
                              */}
                            </h2>
                          </div>
                        )}
                    </Grid.Column>
                  </Grid>
                </div>
              </div>
            </Container>
          )}
        </div>
      ) : (
        <div>
          <DashboardProfileSnippet
            helper
            requestsInArea={
              openRequests === null
                ? 0
                : Object.keys(openRequests).length +
                  Object.keys(communityDeliveryEvents).length
            }
          />

          {openRequests === null ||
          pendingRequests === null ||
          finishedRequests === null ? (
            <div className="dashboardContent">
              <Loader active inline="centered" />
            </div>
          ) : (
            globalState.userInfo.canHelp &&
            (globalState.userInfo.checkrVerified === true ||
              (openRequestsFunctionExecuted &&
                communityDeliveryFunctionExecuted &&
                globalState.userInfo.checkrVerified === false &&
                Object.keys(openRequests).length +
                  Object.keys(communityDeliveryEvents).length ===
                  0)) &&
            openRequests !== null && (
              <Container fluid>
                <Container>
                  <div className="boardOptions">
                    <div className="boardOption">
                      <div className="addressBox">
                        <p>
                          {globalState.userInfo.apartment}{" "}
                          {globalState.userInfo.street}
                          {", "}
                          {globalState.userInfo.city}
                          {", "}
                          {globalState.userInfo.state}{" "}
                          {globalState.userInfo.zip}{" "}
                        </p>
                      </div>
                    </div>
                    <div className="boardOption">
                      <Form.Select
                        className="boardInfo distanceSelect"
                        compact
                        options={options}
                        value={distanceV}
                        onChange={(e, d) => distanceChanged(d.value)}
                      />
                    </div>
                  </div>
                </Container>

                <br />

                <Container>
                  <div className="divTabs">
                    <TabItem
                      onClick={() => setActiveTabIndex(0)}
                      title={t("myJobs")}
                      currentIndex={activeTabIndex}
                      index={0}
                      key={"0"}
                    />
                    <TabItem
                      onClick={() => setActiveTabIndex(1)}
                      title={t("allHelpRequests")}
                      currentIndex={activeTabIndex}
                      index={1}
                      key={"1"}
                    />
                  </div>
                </Container>
                <br />

                {activeTabIndex === 0 && (
                  <div>
                    <div className="individualRequestsContainer">
                      <Grid columns="equal" stackable>
                        <Grid.Column>
                          <div className="myEventsDescription">
                            <h1 className="myEventsDescriptionHeader">
                              Your upcoming events
                            </h1>
                            <p className="requestDescription">
                              {pendingEvents.length} community delivery
                            </p>
                          </div>
                        </Grid.Column>
                        <Grid.Column width={10}>
                          {pendingEvents.length > 0 && (
                            <div>
                              <EventList
                                volunteerView
                                signedUp
                                events={pendingEvents}
                                refreshParent={refreshData}
                              />
                              <br />
                            </div>
                          )}
                          {Object.keys(pendingRequests).length > 0 && (
                            <RequestsList
                              requests={pendingRequests}
                              refreshParent={refreshData}
                              sensitive
                            />
                          )}
                          {pendingEvents.length === 0 &&
                            Object.keys(pendingRequests).length === 0 &&
                            pendingRequests !== null && (
                              <div className="infoPrompt">
                                <h2 className="infoPrompt" as="h1">
                                  {t("noJobsYet")}
                                </h2>
                              </div>
                            )}
                        </Grid.Column>
                      </Grid>
                    </div>
                    <div className="completedRequestsContainer">
                      <Grid columns="equal" stackable>
                        <Grid.Column>
                          <div className="myEventsDescription">
                            <h1 className="myEventsDescriptionHeader">
                              Your completed events
                            </h1>
                            <p className="requestDescription">
                              {finishedEvents.length} community delivery
                            </p>
                            <a
                              className="externalLink"
                              onClick={() =>
                                toggleSeeMoreFinished(!seeMoreFinished)
                              }>
                              Show {!seeMoreFinished ? "more" : "less"}
                            </a>
                          </div>
                        </Grid.Column>
                        <Grid.Column width={10}>
                          <Grid stackable>
                            <Grid.Row>
                              <Grid.Column
                                width={8}
                                verticalAlign="middle"
                                align="center">
                                <h2 className="infoPrompt">
                                  {t("neighborsHelped")}:{" "}
                                  <strong>
                                    {Object.keys(finishedRequests).length}
                                  </strong>
                                </h2>
                              </Grid.Column>
                              <Grid.Column
                                width={8}
                                verticalAlign="middle"
                                align="center">
                                {Object.keys(finishedRequests).length > 0 && (
                                  <div>
                                    <strong>
                                      Share with your friends and family
                                    </strong>
                                    <br />
                                    <br />
                                    <Share helper />
                                  </div>
                                )}
                              </Grid.Column>
                            </Grid.Row>
                          </Grid>
                          {finishedEvents.length > 0 && (
                            <div>
                              <EventList
                                volunteerView
                                past
                                events={
                                  seeMoreFinished
                                    ? finishedEvents
                                    : finishedEvents.slice(0, 1)
                                }
                                refreshParent={refreshData}
                              />
                              <br />
                            </div>
                          )}
                          {Object.keys(finishedRequests).length > 0 && (
                            <RequestsList
                              requests={
                                seeMoreFinished
                                  ? finishedRequests
                                  : Object.assign(
                                      {},
                                      Object.values(finishedRequests).slice(
                                        0,
                                        1
                                      )
                                    )
                              }
                              refreshParent={refreshData}
                              sensitive
                            />
                          )}
                        </Grid.Column>
                      </Grid>
                    </div>
                  </div>
                )}
                {activeTabIndex === 1 && (
                  <div>
                    {communityDeliveryEvents.length > 0 && (
                      <div className="individualRequestsContainer color-white">
                        <Grid columns="equal" stackable>
                          <Grid.Column>
                            <div className="communityListDescription">
                              <h1 className="communityRequestDescriptionHeader">
                                Community Delivery
                              </h1>
                              <p className="requestDescription">
                                {t("requestDescComm")}
                              </p>
                              <p className="requestDescription">
                                <a class="howDoesItWorkLink">
                                  {t("requestDescCommHowDoesItWork")}
                                </a>
                              </p>
                            </div>
                          </Grid.Column>
                          <Grid.Column width={10}>
                            {Object.keys(communityDeliveryEvents).length > 0 &&
                            pendingEvents !== null ? (
                              <div>
                                <EventList
                                  acceptable
                                  events={communityDeliveryEvents.sort(
                                    (a, b) =>
                                      a.eventTime.seconds - b.eventTime.seconds
                                  )}
                                  refreshParent={refreshData}
                                />
                              </div>
                            ) : (
                              <div className="infoPrompt">
                                <h2 className="infoPrompt">
                                  {t("noRequestsInArea")}
                                </h2>
                                <h2 className="infoPrompt">
                                  {t("noRequestersYet")}
                                </h2>
                                <Share helper />
                              </div>
                            )}
                          </Grid.Column>
                        </Grid>
                      </div>
                    )}
                  </div>
                )}
              </Container>
            )
          )}
        </div>
      )}
    </div>
  );
}
