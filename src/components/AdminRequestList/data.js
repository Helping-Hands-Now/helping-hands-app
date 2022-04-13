import React, { useState, useEffect } from "react";
import moment from "moment";
import {
  Container,
  Table,
  Grid,
  Button,
  Checkbox,
  Icon,
  Header,
} from "semantic-ui-react";
import { db } from "../../firebase.js";
import "./styles.css";
import { useTranslation } from "react-i18next";

import InspectedRequest from "./InspectedRequest";
import SuccessModal from "../SuccessModal";
import UIStateDropdown from "../UI/UIStateDropdown";
import UIRegionDropdown from "../UI/UIRegionDropdown";
import { stateInRegion, northOrSouthCA } from "./location-helper";

const diff_hours = (dt2, dt1) => {
  return moment
    .duration(moment(dt1).diff(moment(dt2)))
    .asHours()
    .toFixed(1);
};

export function handleFocus(e) {
  e.target.setAttribute("autocomplete", "nope");
}

export function handleBlur(e) {
  e.target.setAttribute("autocomplete", "on");
}

// this is the raw data and doesn't fetch anything
// depends on caller to determine what the criteria of requests shown are
export default function AdminRequestListData({ options, requests }) {
  const { t } = useTranslation();

  options = options || {};
  // options
  // {
  //   changeStatusDropdown: false, (true if the this is being called by the admin console.)
  //   disableAdminComments: false,
  //   disableBehalfColumn: false,
  //   editableNeeds: false,
  //   showCreatorColumn: false,
  //   mode: ['active', 'closed'] // active requests we don't expect closed in there.
  //   canCancelRequests: mode === "active" ? true : false,
  //   cancelOrgRequest: cancelOrgRequest // function to cancel request
  //   console: "partner" // this is needed to enable partner console users to use admin functions
  //}
  const [data, setData] = useState([]);
  const [showOpen, setShowOpen] = useState(true);
  const [showPending, setShowPending] = useState(true);
  const [showCompleted, setShowCompleted] = useState(true);
  const [showFailed, setShowFailed] = useState(true);
  const [showCancelled, setShowCancelled] = useState(true);
  const [showInvalid, setShowInvalid] = useState(true);
  const [sucessModal, setSuccessModal] = useState(null);
  const [state, setState] = useState(null);
  const [region, setRegion] = useState(null);

  const [inspectedRequest, setInspectedRequest] = useState(null);

  const PENDING = "pending_fulfillment";
  const OPEN = "open";
  const CLOSED = "closed";
  const CANCELLED = "cancelled";

  const COMPLETED = "completed";
  const FAILED = "failed";
  const INVALID = "invalid";

  const status_numbers = {
    open: 0,
    pending_fulfillment: 1,
    pending_acceptance: 1, // is this a valid case? it seems like it's a valid (old? status)
    closed: 2,
  };

  const columns = [
    {
      Header: "Action",
      accessor: "action",
    },
    {
      Header: "Status",
      accessor: "status",
    },
    {
      Header: "Total Age In Days",
      accessor: "requestAgeInDays",
    },
    {
      Header: "Recipient Name",
      accessor: "requesterFullName",
    },
    {
      Header: "Request ID",
      accessor: "id",
    },
  ];
  const showBehalfColumn = !options.disableBehalfColumn;
  const showCreatorColumn = options.showCreatorColumn;
  const activeMode = options.mode === "active";
  const closedMode = options.mode === "closed";
  const canCancelRequests = options.canCancelRequests;
  if (closedMode) {
    // replace the 2nd column with resolution
    columns[1] = {
      Header: "Outcome",
      accessor: "outcome",
    };
  }
  if (showBehalfColumn) {
    columns.push({
      Header: "Behalf",
      accessor: "onBehalf",
    });
  }
  if (showCreatorColumn) {
    columns.push({
      Header: "Creator",
      accessor: "creatorName",
    });
  }
  if (canCancelRequests) {
    columns.push({
      Header: "Cancel Request",
      accessor: "cancelRequest",
    });
  }

  const filterApplies = (column) => {
    return column.accessor === "status" || column.accessor === "outcome";
  };

  // Calculate quantity of requests by `status` if active and `outcome` if closed
  const statusCounts = activeMode
    ? {
        [OPEN]: null,
        [PENDING]: null,
      }
    : {
        [COMPLETED]: null,
        [FAILED]: null,
        [CANCELLED]: null,
        [INVALID]: null,
      };

  data.forEach(
    (request) =>
      (statusCounts[activeMode ? request.status : request.outcome] += 1)
  );

  let filterOptions = [];
  if (activeMode) {
    filterOptions = [
      {
        checked: showOpen,
        label: "Open",
        count: statusCounts[OPEN],
        onChange: setShowOpen,
      },
      {
        checked: showPending,
        label: "Pending",
        count: statusCounts[PENDING],
        onChange: setShowPending,
      },
    ];
  } else if (closedMode) {
    // not using constants here as these could eventually be translated.
    filterOptions = [
      {
        checked: showCompleted,
        label: "Completed",
        count: statusCounts[COMPLETED],
        onChange: setShowCompleted,
      },
      {
        checked: showFailed,
        label: "Failed",
        count: statusCounts[FAILED],
        onChange: setShowFailed,
      },
      {
        checked: showCancelled,
        label: "Cancelled",
        count: statusCounts[CANCELLED],
        onChange: setShowCancelled,
      },
      {
        checked: showInvalid,
        label: "Invalid",
        count: statusCounts[INVALID],
        onChange: setShowInvalid,
      },
    ];
  }

  useEffect(() => {
    let formattedData = requests.map((request) => {
      return addNeededFieldsToObject(request);
    });
    oneTimeSort(formattedData);
  }, [requests]);

  useEffect(() => {
    // clear location filter & inspectedRequest when switch between Active/Closed mode
    setRegion(null);
    setState(null);
    setInspectedRequest(null);
  }, [options.mode]);

  useEffect(() => {
    // clear inspected request when location filter changes
    setInspectedRequest(null);
  }, [data]);

  const updateRequestObject = (id) => {
    let index = data.findIndex((x) => x.id === id);
    var objects = data;

    let newObject;
    db.collection("requests")
      .doc(id)
      .get()
      .then(function (request) {
        newObject = request.data();
        newObject.id = request.id;
        newObject.creator = request.creator;

        newObject = addNeededFieldsToObject(newObject);
        return db
          .collection("requests")
          .doc(id)
          .collection("admin")
          .doc("metaData")
          .get();
      })
      .then((adminMetaData) => {
        newObject.adminData = adminMetaData.data();
        objects[index] = newObject;
        oneTimeSort(objects);
      })
      .catch(function (error) {
        console.log("Error getting documents: ", error);
      });
  };

  const addNeededFieldsToObject = (newObject) => {
    newObject.statusNumber = status_numbers[newObject.status];
    const timeCreated =
      (newObject.timeCreated.seconds || newObject.timeCreated._seconds) * 1000;
    newObject.timeCreated = timeCreated;
    let timeAccepted;
    if (newObject.timeAccepted) {
      timeAccepted =
        (newObject.timeAccepted.seconds || newObject.timeAccepted._seconds) *
        1000;
      newObject.timeAccepted = timeAccepted;
    }

    try {
      switch (newObject.status) {
        case OPEN:
          newObject.requestAge = parseFloat(
            diff_hours(new Date(timeCreated), new Date())
          );
          newObject.requestAgeInDays = GetAgeInDays(newObject.requestAge);
          newObject.timeToAccepted = null;
          newObject.fulfillmentAge = null;

          break;
        case PENDING:
          newObject.requestAge = parseFloat(
            diff_hours(new Date(timeCreated), new Date())
          );
          newObject.requestAgeInDays = GetAgeInDays(newObject.requestAge);
          newObject.timeToAccepted = parseFloat(
            diff_hours(new Date(timeCreated), new Date(timeAccepted))
          );
          newObject.fulfillmentAge = parseFloat(
            diff_hours(new Date(timeAccepted), new Date())
          );
          break;
        case CLOSED:
          if (newObject.closingVerifiedTextTimeSent) {
            const closingVerifiedTextTimeSent =
              (newObject.closingVerifiedTextTimeSent.seconds ||
                newObject.closingVerifiedTextTimeSent._seconds) * 1000;
            newObject.closingVerifiedTextTimeSent = closingVerifiedTextTimeSent;

            newObject.requestAge = parseFloat(
              diff_hours(
                new Date(timeCreated),
                new Date(closingVerifiedTextTimeSent)
              )
            );
            newObject.requestAgeInDays = GetAgeInDays(newObject.requestAge);
            newObject.timeToAccepted = parseFloat(
              diff_hours(new Date(timeCreated), new Date(timeAccepted))
            );
            newObject.fulfillmentAge = parseFloat(
              diff_hours(
                new Date(timeAccepted),
                new Date(closingVerifiedTextTimeSent)
              )
            );
          }
          //quick fix to make sure that outcome doesn't default to invalid.
          //because of how we use outcome now, we should change this.
          if (
            newObject.outcome === FAILED ||
            newObject.uberStatus === "FAILED" ||
            newObject.CompletionConfirmationType === "UBER_TRIP_FAILED" ||
            newObject.CompletionConfirmationType === "Expired"
          ) {
            newObject.outcome = FAILED;
          } else if (
            newObject.outcome === CANCELLED ||
            newObject.uberStatus === "CANCELLED" ||
            newObject.CompletionConfirmationType === "UBER_TRIP_CANCELELED"
          ) {
            newObject.outcome = CANCELLED;
          } else if (
            newObject.outcome === COMPLETED ||
            newObject.resolutionType ||
            newObject.markedCompleteBy ||
            newObject.marked_complete_by ||
            newObject.CompletionIndicationType ||
            newObject.closingVerifiedTextTimeSent ||
            newObject.uberStatus === "COMPLETED" ||
            newObject.CompletionConfirmationType === "UBER_TRIP_COMPLETED"
          ) {
            newObject.outcome = COMPLETED;
          } else {
            newObject.outcome = INVALID; // Invalid/unknown
          }
          break;
        case CANCELLED:
          newObject.outcome = CANCELLED;
          break;
        default:
          break;
      }
    } catch (e) {}

    if (newObject.createdBy !== newObject.requester) {
      try {
        newObject.onBehalf = newObject.creator.firstName;
      } catch (error) {
        console.log("Could not find creator info ", error);
      }
    } else {
      try {
        newObject.requesterFullName =
          newObject.creator.firstName + " " + newObject.creator.lastName;
      } catch (error) {
        newObject.requesterFullName = "";
        console.log("Could not find creator info", error);
      }
      newObject.onBehalf = "";
    }

    return newObject;
  };

  function sort(column, ascending) {
    var field = column;
    var dataToSort = [...data];

    if (column === "requestAgeInDays") {
      if (ascending) {
        dataToSort.sort(
          (a, b) =>
            parseFloat(a.requestAge) - parseFloat(b.requestAge) ||
            isNaN(parseFloat(a.requestAge)) - isNaN(parseFloat(b.requestAge))
        );
      } else {
        dataToSort.sort(
          (a, b) =>
            parseFloat(b.requestAge) - parseFloat(a.requestAge) ||
            isNaN(parseFloat(a.requestAge)) - isNaN(parseFloat(b.requestAge))
        );
      }
    } else if (column === "requesterFullName") {
      if (ascending) {
        dataToSort.sort((a, b) =>
          a.requesterFullName.localeCompare(b.requesterFullName)
        );
      } else {
        dataToSort.sort((a, b) =>
          b.requesterFullName.localeCompare(a.requesterFullName)
        );
      }
    } else if (column === "status") {
      if (ascending) {
        dataToSort.sort(
          (a, b) =>
            a.statusNumber - b.statusNumber ||
            isNaN(a.statusNumber) - isNaN(b.statusNumber)
        );
      } else {
        dataToSort.sort(
          (a, b) =>
            b.statusNumber - a.statusNumber ||
            isNaN(a.statusNumber) - isNaN(b.statusNumber)
        );
      }
      // TODO resolution?
    } else {
      if (ascending) {
        dataToSort.sort((a, b) => (a[field] > b[field] ? 1 : -1));
      } else {
        dataToSort.sort((a, b) => (a[field] < b[field] ? 1 : -1));
      }
    }
    setData(dataToSort);
  }

  const GetAgeInDays = (age) => {
    var day = Math.floor(age / 24);
    var hours = Math.floor(age % 24);
    var daysString = day > 1 ? " days " : " day ";
    var hoursString = hours > 1 ? " hrs " : " hr ";
    return day + daysString + hours + hoursString;
  };

  const requestVisible = (request) => {
    if (activeMode) {
      return (
        (showOpen && request.status === OPEN) ||
        (showPending && request.status === PENDING)
      );
    }
    return (
      (showCompleted && request.outcome === COMPLETED) ||
      (showFailed && request.outcome === FAILED) ||
      (showCancelled && request.outcome === CANCELLED) ||
      (showInvalid && request.outcome === INVALID)
    );
  };

  const oneTimeSort = (requests) => {
    if (closedMode) {
      setData(requests);
    }

    requests.sort(function (a, b) {
      // Sort by status
      var status = a.statusNumber - b.statusNumber;

      if (status) return status;

      // If there is a tie, sort by request age
      var age = parseFloat(a.requestAge) - parseFloat(b.requestAge);
      return age;
    });

    setData(requests);
  };

  const cancelRequest = (request) => {
    options.cancelOrgRequest(request);
  };

  const displaySuccessModal = (request) => {
    setSuccessModal(
      <SuccessModal
        open={true}
        onClose={() => {
          setSuccessModal(null);
        }}
        title={t("cancelRequest")}
        textArray={[
          t("confirmCancelOrderPrompt1"),
          t("confirmCancelOrderPrompt2"),
        ]}
        primaryButtonText={t("confirmCancelHelpAction")}
        primaryOnClick={() => {
          cancelRequest(request);
          setSuccessModal(null);
        }}
        secondaryButtonText={t("stopCancelOrderPrompt")}
        secondaryOnClick={() => {
          setSuccessModal(null);
        }}
      />
    );
  };

  const CellValue = ({ column, request }) => {
    if (column.accessor === "action") {
      return (
        <Button
          primary
          onClick={() => setInspectedRequest(request)}
          style={{
            marginTop: "2px",
            marginBottom: "2px",
            marginLeft: "2px",
            marginRight: "2px",
          }}>
          Show
        </Button>
      );
    } else if (column.accessor === "cancelRequest") {
      return (
        <div>
          <Button
            className="basic"
            onClick={() => {
              displaySuccessModal(request);
            }}>
            <Icon className="trash red" />
          </Button>
        </div>
      );
    } else {
      let returnVal = request[column.accessor];
      // returnVal is undefined for 'age in days' column. Need this check to return null if the value is undefined
      if (returnVal) {
        return returnVal;
      } else {
        return null;
      }
    }
  };

  const filterLocation = (d, isRegionFilter) => {
    if (isRegionFilter) {
      setRegion(d.value);
    } else {
      setState(d.value);
    }

    const filteredLocations = requests.filter((req) => {
      if (
        !req.creator ||
        !req.creator.state ||
        (req.createdBy !== req.requester && !req.state)
      ) {
        return false;
      }

      let isRobo = req.createdBy !== req.requester;

      let destinationState = isRobo ? req.state : req.creator.state;
      let destinationZipCode = isRobo ? req.zipCode : req.creator.zipCode;

      if (d.value.slice(0, 2) === "CA") {
        // CA region/state is handled by zipcodes
        return northOrSouthCA(destinationState, destinationZipCode, d.value);
      } else {
        if (isRegionFilter) {
          return stateInRegion(destinationState, d.value);
        } else {
          return destinationState === d.value;
        }
      }
    });

    setData(filteredLocations);
  };

  return (
    <div className="requestListContainer">
      <Header as="h3" block>
        <UIRegionDropdown
          label={t("region")}
          placeholder={t("region")}
          hook={(e, d) => filterLocation(d, true)}
          search
          selection
          onFocus={handleFocus}
          onBlur={handleBlur}
          region={region}
        />
        {region && (
          <UIStateDropdown
            label={t("state")}
            placeholder={t("state")}
            hook={(e, d) => filterLocation(d, false)}
            search
            selection
            onFocus={handleFocus}
            onBlur={handleBlur}
            region={region}
            state={state}
          />
        )}
      </Header>
      {sucessModal}
      <Grid columns={1} padded>
        <Grid.Row>
          <Grid.Column>
            <div className={"adminRequestList"}>
              <Table celled>
                <Table.Header>
                  <Table.Row>
                    {columns.map((column, i) => (
                      <Table.HeaderCell key={i}>
                        {column.Header}
                        <br />
                        <div>
                          <Icon
                            className="sort content ascending"
                            onClick={() => sort(column.accessor, true)}></Icon>
                          <Icon
                            className="sort content descending"
                            onClick={() => sort(column.accessor, false)}></Icon>

                          <br />
                          {filterApplies(column) &&
                            filterOptions.map((option, j) => (
                              <Container fluid key={j}>
                                <Checkbox
                                  label={`${option.label}${
                                    option.count ? ` (${option.count})` : ""
                                  }`}
                                  onChange={() =>
                                    option.onChange(!option.checked)
                                  }
                                  checked={option.checked}
                                />
                                <br />
                              </Container>
                            ))}
                        </div>
                      </Table.HeaderCell>
                    ))}
                  </Table.Row>
                </Table.Header>

                <Table.Body>
                  {data.map(
                    (request, i) =>
                      requestVisible(request) && (
                        <Table.Row key={i}>
                          {columns.map((column, j) => (
                            <Table.Cell key={j}>
                              <CellValue column={column} request={request} />
                            </Table.Cell>
                          ))}
                        </Table.Row>
                      )
                  )}
                </Table.Body>
              </Table>
            </div>
          </Grid.Column>
          <Grid.Column>
            {inspectedRequest && (
              <InspectedRequest
                inspectedRequest={inspectedRequest}
                updateObject={updateRequestObject}
                options={options}
              />
            )}
          </Grid.Column>
        </Grid.Row>
      </Grid>
    </div>
  );
}
