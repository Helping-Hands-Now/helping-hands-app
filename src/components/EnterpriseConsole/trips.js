import React, { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import _ from "lodash";
import {
  Button,
  Container,
  Table,
  Dropdown,
  Grid,
  Modal,
  Loader,
  Dimmer,
  Confirm,
  Message,
} from "semantic-ui-react";
import UIInput from "../UI/UIInput";
import OrgAddress from "../OrgAddress";
import { Link } from "react-router-dom";
import Moment from "react-moment";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import moment from "moment";

import {
  createRequestsForOrganization,
  markTripAsResubmitted,
  cancelUberTrip,
  cancelLyftPath,
} from "../../firebase";
import useGlobalState from "../../hooks/useGlobalState";
import { FilterBy, FilterItemByScheduledPickupTime } from "./filter";
import UIText from "../UI/UIText";
import ProgressUI from "./progressUi.js";
import { mapUnifiedStatus } from "./progressUi.js";
import { CSVLink } from "react-csv";
import { queryRequestRetries } from "../../firebase";
import RetryHistoryTable from "./retryHistoryTable";
import SuccessModal from "../SuccessModal";
import "./communityEvents.css";
const formatDaysToLoad = (val) => {
  let num = parseInt(val, 10);
  if (isNaN(num)) {
    return "";
  }
  return num;
};

// This file contains enterprise console trip sorting and filtering
// To add a new filter look for <add-filter-here> in this file
// To add a new column look for <add-column-here>. Currently, all columns are sortable

export default function Trips(props) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(false);
  const [retryModalOpen, setRetryModalOpen] = useState(false);
  const [filteredDate, setFilteredDate] = useState(null);
  const [renderedTrips, setRenderedTrips] = useState([]);
  const [filteredStatuses, setFilteredStatuses] = useState([]);
  const [filteredUberStatuses, setFilteredUberStatuses] = useState([]);
  const [filteredSuppliers, setFilteredSuppliers] = useState([]);
  const [filteredButtonStatuses, setFilteredButtonStatuses] = useState([]);
  const globalState = useGlobalState();
  const [trips, setTrips] = useState([]);
  const [csvData, setCSVData] = useState([]);
  const [historyModalActive, setHistoryModalActive] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [historyModalData, setHistoryModalData] = useState([]);
  const [openCancelErrorModal, setOpenCancelErrorModal] = useState(false);
  const [cancelErrorMessage, setCancelErrorMessage] = useState("");
  const [open, setOpen] = useState(false);
  const [tripID, setTripId] = useState(false);
  const [searchValue, setSearchValue] = useState();
  const [searchResults, setSearchResults] = useState([]);
  const [filteredFulfilledBy, setFilteredFulfilledBy] = useState([]);
  // <add-filter-here> add state variable for new filter (for the selected option)

  const statusNumbers = {
    open: 0,
    pending_fulfillment: 1,
    closed: 2,
    cancelled: 3,
  };

  const uberStatusNumbers = {
    TO_BE_SCHEDULED: 0,
    ACTIVE: 1,
    SCHEDULED: 2,
    EN_ROUTE_TO_PICKUP: 3,
    ARRIVED_AT_PICKUP: 4,
    EN_ROUTE_TO_BATCHED_DROPOFF: 5,
    EN_ROUTE_TO_DROPOFF: 6,
    ARRIVED_AT_DROPOFF: 7,
    COMPLETED: 8,
    CANCELLED: 9,
    FAILED: 10,
  };

  // Cancel Text
  const cancelLyftText = "Cancel COMPLETE Path";
  const cancelUberText = "Cancel Trip";

  // Resubmit Text
  const resubmitLinkText = "Resubmit";
  const tripWasResubmittedText = "This trip was resubmitted";

  useEffect(() => {
    var trips = props.trips;
    trips.sort((a, b) => {
      var aDate = new Date(a.timeCreated._seconds * 1000);
      var bDate = new Date(b.timeCreated._seconds * 1000);
      aDate = new Date(aDate.toDateString());
      bDate = new Date(bDate.toDateString()); // done to eliminate time when comparing

      let aStatus = statusNumbers[a.status];
      let bStatus = statusNumbers[b.status];

      // Sort by time created.
      if (aDate > bDate) {
        return -1;
      } else if (aDate < bDate) {
        return 1;
      }

      // Tie-break by sort by status.
      if (aStatus > bStatus) {
        return 1;
      } else if (aStatus < bStatus) {
        return -1;
      }

      // Tie-break by scheduled pickup-time.
      if (a.scheduledPickupTime && b.scheduledPickupTime) {
        if (a.scheduledPickupTime > b.scheduledPickupTime) {
          return 1;
        } else if (a.scheduledPickupTime < b.scheduledPickupTime) {
          return -1;
        }
      }

      // Tie-break with Uber status.
      if (a.uberStatus !== undefined && b.uberStatus !== undefined) {
        if (uberStatusNumbers[a.uberStatus] > uberStatusNumbers[b.uberStatus]) {
          return 1;
        } else if (
          uberStatusNumbers[a.uberStatus] < uberStatusNumbers[b.uberStatus]
        ) {
          return -1;
        }
      }

      return 0;
    });

    // Active trips are sorted by Uber status, rather than by update Time.
    // Apply sort for active trips on top of original sort to avoid breaking
    // existing sorts for trips without Uber statuses.
    if (props.mode === "active") {
      trips.sort((trip1, trip2) => {
        const aStatus = uberStatusNumbers[trip1.uberStatus];
        const bStatus = uberStatusNumbers[trip2.uberStatus];
        // Sort by Uber status based on enum.
        if (aStatus !== undefined && bStatus !== undefined) {
          if (aStatus > bStatus) {
            return 1;
          } else if (aStatus < bStatus) {
            return -1;
          }
        }

        const aName = trip1.recipient ? trip1.recipient.firstName : "";
        const bName = trip2.recipient ? trip2.recipient.firstName : "";
        // Sort alphabetically by first name.
        if (aName && bName) {
          return aName > bName ? 1 : -1;
        }

        return 0;
      });
    }
    setTrips(trips);
  }, [props.mode, props.trips]);

  useEffect(() => {
    let csv = [];
    renderedTrips.forEach((trip) => {
      let info = {
        scheduledPickupTime: new Date(trip.scheduledPickupTime),
        status: trip.status,
        toBeFulfilledBy: trip.toBeFulfilledBy,
        deliveryStatus:
          trip.toBeFulfilledBy === "UBER" ? trip.uberStatus : trip.lyftStatus,
        driverName:
          trip.toBeFulfilledBy === "UBER"
            ? trip.uberDriver
            : trip.toBeFulfilledBy === "LYFT"
            ? trip.lyftDriver
            : trip.helperData.firstName + " " + trip.helperData.lastName,
      };
      let recipient = trip.recipient;

      if (recipient) {
        info = {
          ...info,
          firstName: recipient.firstName,
          lastName: recipient.lastName,
          street: recipient.street,
          city: recipient.city,
          state: recipient.state,
          zipCode: recipient.zipCode,
          apartment: recipient.apartment,
          phoneNumber: recipient.phoneNumber,
          numRecipients: recipient.numRecipients,
          dropoffInstructions: recipient.dropoffInstructions,
        };
      }
      if (trip.supplier) {
        info.supplier = trip.supplier.name;
      }
      csv.push(info);
    });

    setCSVData(csv);
  }, [renderedTrips]);

  const closeModal = () => {
    setOpen(false);
  };

  const cancelAllTrips = () => {
    if (tripID.toBeFulfilledBy === "UBER") {
      cancelUberTrip({
        requestId: tripID.id,
      }).then(() => {
        props.reloadTrips();
      });
    } else if (tripID.toBeFulfilledBy === "LYFT") {
      cancelLyftPath({
        requestId: tripID.id,
      })
        .then(() => {
          props.reloadTrips();
        })
        .catch((err) => {
          setOpenCancelErrorModal(true);
          setCancelErrorMessage(err.message);
        });
    }
    setOpen(!open);
  };
  const cancelTrip = (trip) => {
    setOpen(!open);
    setTripId(trip);
  };

  const cancelLyftPathHandler = (trip) => {
    setOpen(!open);
    setTripId(trip);
  };

  const tripsModal = () => {
    return (
      <Confirm
        open={open}
        content="Cancel this trip? This cannot be undone."
        cancelButton="No, go back"
        confirmButton="Yes, cancel this trip"
        onCancel={() => closeModal()}
        onConfirm={() => cancelAllTrips()}
      />
    );
  };

  const status = ["open", "pending_fulfillment"];
  const cancellableStatuses = [
    "ACTIVE",
    "TO_BE_SCHEDULED",
    "SCHEDULED",
    "EN_ROUTE_TO_PICKUP",
  ];

  const isCancellable = (trip) => {
    if (!status.includes(trip.status)) {
      return false;
    }
    if (
      trip.toBeFulfilledBy === "UBER" &&
      (cancellableStatuses.includes(trip.uberStatus) || !trip.uberStatus)
    )
      return true;
    else if (
      trip.toBeFulfilledBy === "LYFT" &&
      (cancellableStatuses.includes(trip.lyftStatus) || !trip.lyftStatus)
    )
      return true;
    return false;
  };

  const canUberBeCancelled = (trip) => {
    if (
      trip.toBeFulfilledBy === "UBER" &&
      (trip.status === "open" || trip.status === "pending_fulfillment") &&
      (trip.uberStatus === "ACTIVE" ||
        trip.uberStatus === "TO_BE_SCHEDULED" ||
        trip.uberStatus === "SCHEDULED" ||
        trip.uberStatus === "EN_ROUTE_TO_PICKUP" ||
        !trip.uberStatus)
    )
      return true;
  };

  const canCancelUberTrip = (trip) => {
    if (canUberBeCancelled(trip))
      return (
        <div>
          <Link onClick={() => cancelTrip(trip)}>{cancelUberText}</Link>
        </div>
      );
  };

  const renderUberCancel = (trip) => {
    return (
      <div>
        <Link onClick={() => cancelTrip(trip)}>{cancelUberText}</Link>
      </div>
    );
  };

  const renderLyftCancel = (trip) => {
    return (
      <Link onClick={() => cancelLyftPathHandler(trip)} to="#">
        {cancelLyftText}
      </Link>
    );
  };

  const renderCancelCell = (trip) => {
    let isLyftCancellable = canCancelLyftTrip(trip);
    let isUberCancellable = canUberBeCancelled(trip);

    let component = isLyftCancellable ? (
      renderLyftCancel(trip)
    ) : isUberCancellable ? (
      renderUberCancel(trip)
    ) : (
      <p></p>
    );
    let rawText = isLyftCancellable
      ? cancelLyftText
      : isUberCancellable
      ? cancelUberText
      : "";

    // Note: we have a rendered component, and separately, the raw text, so that
    // we can continue to show the component with any clickable links, etc., and
    // then continue to use the raw text for sorting (since we can't sort the
    // components themselves).
    return [component, rawText];
  };

  const renderResubmitCell = (trip) => {
    // There are a couple of cases here:
    // 1. trip was already resubmitted ==> return tripWasResubmittedText
    // 2. trip was not resubmitted:
    //    a. if the trip failed ==> return "Resubmit" with the clickable link
    //    b. else ==> return "" (nothing to show or action to take)

    let showResubmitLink = !trip.resubmitted ? resubmitLink(trip) : false;

    let component = !trip.resubmitted ? (
      showResubmitLink && (
        <Link onClick={() => submitRideAgain(trip)} to="#">
          {resubmitLinkText}
        </Link>
      )
    ) : (
      <p>{tripWasResubmittedText}</p>
    );
    // use similar logic as above to generate the raw text equivalent
    let rawText = trip.resubmitted
      ? tripWasResubmittedText
      : showResubmitLink
      ? resubmitLinkText
      : "";

    // Note: we have a rendered component, and separately, the raw text, so that
    // we can continue to show the component with any clickable links, etc., and
    // then continue to use the raw text for sorting (since we can't sort the
    // components themselves).
    return [component, rawText];
  };

  const renderCompletionStatus = (trip) => {
    let cancelLink = "";
    let orderLink = "";
    let modal = "";
    let [unifiedStatus, failureReason] = mapUnifiedStatus(trip);
    let retryHistoryLink = "";

    let status = "PENDING";
    if (trip.toBeFulfilledBy === "UBER" && trip.uberStatus) {
      status = trip.uberStatus;
    } else if (trip.lyftStatus) {
      status = trip.lyftStatus;
    }

    // can be cancelled
    if (isCancellable(trip)) {
      if (trip.scheduledPickupTime) {
        let date;
        if (trip.scheduledPickupTime._seconds) {
          date = new Date(trip.scheduledPickupTime._seconds * 1000);
        } else {
          date = new Date(trip.scheduledPickupTime);
        }
      }
    }

    let showOrderLink = trip.uberTrackingURL && trip.status !== "closed";
    let orderLinkText = "Track Trip";
    if (showOrderLink) {
      orderLink = (
        <a
          href={trip.uberTrackingURL}
          rel="noopener noreferrer"
          target="_blank">
          {orderLinkText}
        </a>
      );
    }

    switch (trip.outcome) {
      case "error_creating":
        failureReason = "Error creating trip with delivery partner";
        break;

      case "timed_out":
        failureReason = "Dispatch Timeout";
        break;

      case "probably_timed_out":
        failureReason = "Probably Dispatch Timeout";
        break;

      case "COURIER_CANCEL":
        failureReason = "Driver Cancelled";
        break;
      default:
        break;
    }

    let showRetryHistoryLink = trip.uberRetries && trip.uberRetries > 0;
    let retryHistoryLinkText = "Retries History";
    if (showRetryHistoryLink) {
      retryHistoryLink = (
        <Link onClick={() => handleRetryModal(trip.id)} to="#">
          {retryHistoryLinkText}
        </Link>
      );
    }

    let isFailure =
      failureReason || trip.lyftFailureError || trip.uberFailureError;
    let failureText =
      trip.lyftFailureError || trip.uberFailureError || failureReason;

    // Note (kelsey, 10/13/2021): if you make any changes to the order of what is displayed
    // below, please make sure to update the rawText variable to be consisent, so that the
    // proper column sorting order is preserved.
    let component = (
      <Container fluid>
        <div>
          {isFailure ? (
            <div>
              Incomplete: <br />
              {failureText}
            </div>
          ) : (
            <div>{unifiedStatus}</div>
          )}
        </div>
        <div>{orderLink}</div>
        <div>{cancelLink}</div>
        <div>{open && modal}</div>
        <div>{retryHistoryLink}</div>
      </Container>
    );

    // We concatenate the entire delivery status here, because there is so much
    // conditional rendering. The initial status, and failure reason should get enough
    // content for sorting. We can continue to add to this if needed in the future.
    let rawText = isFailure ? `Incomplete: ${failureText}` : unifiedStatus;
    rawText += showOrderLink ? ` ${orderLinkText}` : "";
    rawText += showRetryHistoryLink ? ` ${retryHistoryLinkText}` : "";

    // Note: we have a rendered component, and separately, the raw text, so that
    // we can continue to show the component with any clickable links, etc., and
    // then continue to use the raw text for sorting (since we can't sort the
    // components themselves).
    return [component, rawText];
  };

  const datePickerChanged = (date) => {
    setFilteredDate(date);
  };

  // this runs filterTrips anytime the the values in the dependency array change
  // so if any of the data changes, or if any of the filters change, this will refilter the trips
  useEffect(() => {
    filterTrips();
  }, [
    trips,
    filteredDate,
    filteredStatuses,
    filteredUberStatuses,
    filteredSuppliers,
    filteredButtonStatuses,
    searchValue,
    searchResults,
    filteredFulfilledBy,
    // <add-filter-here> add the new state variable here so "filterTrips" is called when this state changes
  ]);

  // all the filtering of the trips data happens here
  // filtering criteria is different per field
  const filterTrips = () => {
    if (trips.length < 0) {
      return;
    }

    const filters = [
      FilterItemByScheduledPickupTime(filteredDate),
      {
        testValue: filteredStatuses.length,
        filter: (trip) => {
          return filteredStatuses.indexOf(trip.status) !== -1;
        },
      },
      {
        testValue: filteredButtonStatuses.length,
        filter: (trip) => {
          let [unifiedStatus, failureReason] = mapUnifiedStatus(trip);
          return filteredButtonStatuses.indexOf(unifiedStatus) !== -1;
        },
      },
      {
        testValue: filteredUberStatuses.length,
        filter: (trip) => {
          return filteredUberStatuses.indexOf(trip.uberStatus) !== -1;
        },
      },
      {
        testValue: filteredSuppliers.length,
        filter: (trip) => {
          return filteredSuppliers.indexOf(trip.supplier.id) !== -1;
        },
      },
      {
        testValue: searchValue,
        filter: (trip) => {
          if (searchValue && searchResults.length === 0) {
            return false;
          }
          return searchResults.indexOf(trip) !== -1;
        },
      },
      {
        testValue: filteredFulfilledBy.length,
        filter: (trip) => {
          if (
            !["UBER", "LYFT"].includes(trip.toBeFulfilledBy) &&
            filteredFulfilledBy.includes("COMMUNITY_DELIVERY")
          ) {
            return true;
          }
          return filteredFulfilledBy.indexOf(trip.toBeFulfilledBy) !== -1;
        },
      },
      // <add-filter-here> specify the new filter here
    ];
    setRenderedTrips(FilterBy(trips, filters));
  };

  const handleRetryModal = async (id) => {
    setModalLoading(true);
    setHistoryModalActive(true);

    var data = await queryRequestRetries({ id: id });

    setHistoryModalData(data);
    setModalLoading(false);
  };

  // we run this any time the value in the search box changes
  useEffect(() => {
    filterSearchResults();
  }, [trips, searchValue]);

  // search results are all the possible matches (from trips) for the search value
  // this gets further filtered in filterTrips based on the other filters
  const filterSearchResults = () => {
    const toSearch = searchValue ? searchValue.toLowerCase() : "";
    // get all trips, not just the filtered ones, thats why we use trips here instead of renderedtrips
    const allTripsInTableFormat = tripDataForTable(trips);
    const results = [];
    for (let i = 0; i < allTripsInTableFormat.length; i++) {
      // add complete name as a posible search result
      for (let key in allTripsInTableFormat[i]) {
        // search through object first level strings
        if (
          typeof allTripsInTableFormat[i][key] === "string" &&
          allTripsInTableFormat[i][key].toLowerCase().indexOf(toSearch) != -1
        ) {
          results.push(allTripsInTableFormat[i].trip);
        }
      }
    }
    setSearchResults(results);
  };

  const renderFilterOptions = () => {
    const options = [
      {
        value: "closed",
        text: "Closed",
      },
      {
        value: "open",
        text: "Open",
      },
      {
        value: "pending_fulfillment",
        text: "Pending",
      },
    ];

    let suppliersDict = {};
    let supplierOptions = [];
    // using trips and not renderedTrips so that the filters don't change dynamically
    trips.forEach((trip) => {
      if (suppliersDict[trip.supplier.id]) {
        return;
      }
      suppliersDict[trip.supplier.id] = true;
      supplierOptions.push({
        value: trip.supplier.id,
        text: trip.supplier.name,
      });
    });
    let columns = 3;
    let supplierFilter = null;

    const updateFilteredButtonStatuses = (selectedStatus) => {
      const index = filteredButtonStatuses.indexOf(selectedStatus);
      if (index !== -1) {
        const removeFilter = [...filteredButtonStatuses];
        if (filteredButtonStatuses.length === 1) {
          setFilteredButtonStatuses([]);
          return;
        }
        removeFilter.splice(index, 1);
        setFilteredButtonStatuses(removeFilter);
        return;
      }
      const newStatuses = [...filteredButtonStatuses, selectedStatus];
      setFilteredButtonStatuses(newStatuses);
      return;
    };
    // Only show days to load input if setDaysToLoad state function is provided
    // Currently this is only used on Past Trips tab
    let daysFilter = null;
    if (props.setDaysToLoad) {
      columns += 1;
      daysFilter = (
        <Grid.Column verticalAlign="middle" floated="right">
          <UIInput
            placeholder={t("daysToLoad")}
            label={t("daysToLoad")}
            hook={(e) =>
              props.setDaysToLoad(formatDaysToLoad(e.target.value, 10))
            }
            value={props.daysToLoad}
            onBlur={() => props.reloadTrips()}
          />
        </Grid.Column>
      );
    }

    const renderSearch = () => {
      const handleTyping = (e) => {
        setSearchValue(e.target.value);
      };

      return (
        <div>
          <div class="ui search">
            <div class="ui icon input">
              <input
                class="prompt"
                type="text"
                placeholder="Search"
                value={searchValue}
                onChange={handleTyping}
              />
              <i class="search icon"></i>
            </div>
          </div>
        </div>
      );
    };

    const renderFulfilledByFilter = () => {
      const options = [
        {
          value: "UBER",
          text: "Uber",
        },
        {
          value: "LYFT",
          text: "Lyft",
        },
        {
          value: "COMMUNITY_DELIVERY",
          text: "Community Delivery",
        },
      ];

      return (
        <div>
          <Dropdown
            fluid
            multiple
            selection
            placeholder={"Fulfulled by"}
            defaultValue={filteredFulfilledBy}
            options={options}
            onChange={(e, d) => setFilteredFulfilledBy(d.value)}
            clearable
          />
        </div>
      );
    };

    const renderPickupLocationFilter = () => {
      // if there's more than one unique supplier, let's add a filter option
      if (supplierOptions.length <= 1) {
        return null;
      }

      return (
        <div>
          <Dropdown
            fluid
            multiple
            selection
            placeholder={"Pickup location"}
            defaultValue={filteredSuppliers}
            options={supplierOptions}
            onChange={(e, d) => setFilteredSuppliers(d.value)}
            clearable
          />
        </div>
      );
    };

    // <add-filter-here> this is where you will define the UI for the new filter
    // see renderPickupLocationFilter above for an example

    const csvHeaders = [
      {
        label: "First Name",
        key: "firstName",
      },
      {
        label: "Last Name",
        key: "lastName",
      },
      {
        label: "Street",
        key: "street",
      },
      {
        label: "City",
        key: "city",
      },
      {
        label: "State",
        key: "state",
      },
      {
        label: "Zip Code",
        key: "zipCode",
      },
      {
        label: "Apartment",
        key: "apartment",
      },
      {
        label: "Phone Number",
        key: "phoneNumber",
      },
      {
        label: "Drop Off Instructions",
        key: "dropoffInstructions",
      },
      {
        label: "Number of Recipients",
        key: "numRecipients",
      },
      {
        label: "Supplier",
        key: "supplier",
      },
      {
        label: "Scheduled Pickup Time",
        key: "scheduledPickupTime",
      },
      {
        label: "Fulfilled by",
        key: "toBeFulfilledBy",
      },
      {
        label: "Status",
        key: "status",
      },
      {
        label: "Delivery Status",
        key: "deliveryStatus",
      },
      {
        label: "Driver Name",
        key: "driverName",
      },
    ];
    return (
      <Container>
        <Grid columns={columns} doubling>
          <Grid.Column>
            <UIText>Filter by scheduled pickup date</UIText>
            <DatePicker
              isClearable={true}
              selected={filteredDate}
              onChange={(date) => datePickerChanged(date)}
              // max days in the future is currently 7 days
              maxDate={moment(new Date()).add(7, "days").valueOf()}
            />
          </Grid.Column>
          {daysFilter}
          {supplierFilter}
        </Grid>
        {props.mode === "active" && (
          <ProgressUI
            trips={props.trips}
            suppliers={props.suppliers}
            currentOrg={props.currentOrg}
            updateFilteredButtonStatuses={(selectedStatus) =>
              updateFilteredButtonStatuses(selectedStatus)
            }
          />
        )}
        <Grid columns={4}>
          <Grid.Column>{renderSearch()}</Grid.Column>
          <Grid.Column>{renderFulfilledByFilter()}</Grid.Column>
          <Grid.Column>{renderPickupLocationFilter()}</Grid.Column>
          {/* <add-filter-here> call the function that renders the new filter UI */}
        </Grid>
        <CSVLink data={csvData} headers={csvHeaders} filename="tripData.csv">
          <br />
          Download CSV
        </CSVLink>
      </Container>
    );
  };

  const cancelLyftPathErrorModal = () => {
    return (
      <Modal
        centered={false}
        open={openCancelErrorModal}
        onClose={() => setOpenCancelErrorModal(false)}
        onOpen={() => setOpenCancelErrorModal(true)}>
        <Modal.Header>Could not cancel trip!</Modal.Header>
        <Modal.Content>
          <Modal.Description>{cancelErrorMessage}</Modal.Description>
        </Modal.Content>
        <Modal.Actions>
          <Button onClick={() => setOpenCancelErrorModal(false)} primary>
            OK
          </Button>
        </Modal.Actions>
      </Modal>
    );
  };

  const submitRideAgain = (trip) => {
    setRetryModalOpen(!retryModalOpen);
    setTripId(trip);
  };
  const confirmRetryTrip = () => {
    const name = recipientName(tripID);

    return (
      <SuccessModal
        open={true}
        onClose={cancelRetryTrip}
        title="Resubmit trip?"
        primaryLoading={loading}
        textArray={[
          `Are you sure you want to retry for ${name}?`,
          `Resubmitting will create a duplicate request for ${name} scheduled shortly.`,
        ]}
        primaryButtonText="Resubmit"
        primaryOnClick={() => retryTrip()}
        secondaryButtonText="Cancel"
        secondaryOnClick={cancelRetryTrip}
      />
    );
  };

  const cancelRetryTrip = () => {
    setRetryModalOpen(false);
  };

  const confirmResubmitMessage = () => {
    const name = recipientName(tripID);
    const selectedDate = moment(Date.now()).add(10, "m").toDate();

    return (
      <Message floating className="confirmation-message">
        The delivery for {name} has been rescheduled for{" "}
        {selectedDate.toString().split(" ")[4]}
      </Message>
    );
  };

  const retryTrip = () => {
    setLoading(true);
    let requestData = {
      orgId: props.currentOrg,
      recipientIds: [tripID.recipient.id],
      fulfiller: tripID.toBeFulfilledBy,
      supplierMap: {
        [tripID.recipient.id]: tripID.supplier.id,
      },
      selectedDate: moment().add(10, "m").toDate().getTime(),
      supplierId: tripID.supplier.id,
    };
    markTripAsResubmitted({
      requestId: tripID.id,
    }).then(() => {
      props.reloadTrips();
    });

    createRequestsForOrganization(requestData)
      .then(() => {
        console.log("Created request.");
      })
      .catch((err) => {
        console.log("Error", err);
      })
      .finally(() => {
        setLoading(false);
        setRetryModalOpen(false);
        setMessage(true);
        setTimeout(() => {
          setMessage(false);
        }, 3000);
      });
  };

  const recipientName = (trip) => {
    return trip.recipient
      ? trip.recipient.firstName +
          " " +
          (trip.recipient.lastName === null ? "" : trip.recipient.lastName)
      : "Unknown recipient";
  };

  const canCancelLyftTrip = (trip) => {
    if (trip.toBeFulfilledBy !== "LYFT") {
      return false;
    }
    return (
      trip.lyftStatus !== "COMPLETED" &&
      trip.lyftStatus !== "FAILED" &&
      trip.lyftStatus !== "CANCELLED"
    );
  };

  const resubmitLink = (trip) => {
    return trip.lyftStatus === "FAILED" || trip.uberStatus === "FAILED";
  };

  // reformat the data so it is more easily sortable
  // we basically do all the data reformating that we have to in this function so that we return strings for each table value
  // that way our sorting function can predictably sort the data
  // ie. you can't sort a function or a react component
  const tripDataForTable = (tripsToConvert) => {
    return tripsToConvert.map((trip, i) => {
      // Note: we have a rendered component, and separately, the raw text, so that
      // we can continue to show the component with any clickable links, etc., and
      // then continue to use the raw text for sorting (since we can't sort the
      // components themselves).
      let [
        deliveryStatusDisplay,
        deliveryStatusRawText,
      ] = renderCompletionStatus(trip);
      let [resubmitComponentDisplay, resubmitRawText] = renderResubmitCell(
        trip
      );
      let [cancelDisplay, cancelRawText] = renderCancelCell(trip);

      return {
        trip: trip,
        // sortable columns
        tripId: trip.id,
        recipient: recipientName(trip),
        addressProfile: trip.recipient,
        recipientAddressRawText: trip.recipient.apartment
          ? `${trip.recipient.street} ${trip.recipient.apartment}, ${trip.recipient.city}, ${trip.recipient.state}`
          : `${trip.recipient.street}, ${trip.recipient.city}, ${trip.recipient.state}`,
        supplier: trip.supplier ? trip.supplier.name : "Unknown supplier",
        fulfiller:
          trip.toBeFulfilledBy === "COMMUNITY_VOLUNTEER" && trip.helperData
            ? trip.helperData.firstName + " " + trip.helperData.lastName
            : trip.toBeFulfilledBy,
        scheduledPickupTime: new Date(trip.scheduledPickupTime),
        deliveryStatusDisplay: deliveryStatusDisplay,
        deliveryStatusRawText: deliveryStatusRawText,
        cancelDisplay: cancelDisplay,
        cancelRawText: cancelRawText,
        resubmitDisplay: resubmitComponentDisplay,
        resubmitRawText: resubmitRawText,
        // <add-column-here> take raw data from trip and return a string to display in the table, this variable is used for sorting
      };
    });
  };

  // manages table sorting using a react reducer
  // we have different actions for setting the original data and sorting the column
  // note: only one column can be sorted at a time
  function tableReducer(state, action) {
    switch (action.type) {
      case "SET_DATA":
        return {
          ...state, // note: we don't overwrite direction so it is preserved
          data: action.payload,
        };
      case "CHANGE_SORT":
        // if the column clicked is already the sorted column, flip it's sort direction
        if (state.column === action.column && !action.refresh) {
          return {
            ...state,
            data: state.data.slice().reverse(),
            direction:
              state.direction === "ascending" ? "descending" : "ascending",
          };
        }

        let sortedData;
        const direction =
          action.refresh && state.direction ? state.direction : "ascending";
        if (action.column === "scheduledPickupTime") {
          // order by the date by computing the date for each
          sortedData = _.sortBy(state.data, [
            function (trip) {
              // We could explicitly sort by the date here, but b/c we changed this back
              // to a Date object, we just use as is. Leaving the commented piece incase
              // we ever need to change this back.
              return trip[action.column];
              //return Date.parse(trip[action.column]);
            },
          ]);
        }
        // if lower case is an option, then we do that here for tripId (which is the requestId),
        // recipient name
        else if (action.column === "tripId" || action.column == "recipient") {
          sortedData = _.sortBy(state.data, [
            function (trip) {
              return trip[action.column].toLowerCase();
            },
          ]);
        } else {
          sortedData = _.sortBy(state.data, [
            function (trip) {
              return trip[action.column];
            },
          ]);
        }
        return {
          column: action.column,
          data: direction === "descending" ? sortedData.reverse() : sortedData,
          direction: direction,
        };
      default:
        throw new Error();
    }
  }

  // set up for table sorting using the reducer above
  const [state, dispatch] = React.useReducer(tableReducer, {
    column: null,
    data: tripDataForTable(renderedTrips),
    direction: null,
  });

  const { column, data, direction } = state;

  // set the data for the reducer once it has loaded
  useEffect(() => {
    dispatch({
      type: "SET_DATA",
      payload: tripDataForTable(renderedTrips),
    });
    // rerun sort
    dispatch({ type: "CHANGE_SORT", column, refresh: true });
  }, [renderedTrips, props.currentOrg]);

  return (
    <Container>
      {message && confirmResubmitMessage()}
      {retryModalOpen && confirmRetryTrip()}
      {open && tripsModal()}
      {cancelLyftPathErrorModal()}
      {renderFilterOptions()}

      {data.length > 0 ? (
        <Table sortable>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell
                sorted={column === "recipient" ? direction : null}
                onClick={() =>
                  dispatch({
                    type: "CHANGE_SORT",
                    column: "recipient",
                  })
                }>
                Recipient
              </Table.HeaderCell>
              <Table.HeaderCell
                sorted={column === "recipientAddressRawText" ? direction : null}
                onClick={() =>
                  dispatch({
                    type: "CHANGE_SORT",
                    column: "recipientAddressRawText",
                  })
                }>
                Delivery Address
              </Table.HeaderCell>
              <Table.HeaderCell
                sorted={column === "supplier" ? direction : null}
                onClick={() =>
                  dispatch({ type: "CHANGE_SORT", column: "supplier" })
                }>
                Supplier
              </Table.HeaderCell>
              <Table.HeaderCell
                sorted={column === "fulfiller" ? direction : null}
                onClick={() =>
                  dispatch({ type: "CHANGE_SORT", column: "fulfiller" })
                }>
                Fulfilled By
              </Table.HeaderCell>
              <Table.HeaderCell
                sorted={column === "scheduledPickupTime" ? direction : null}
                onClick={() =>
                  dispatch({
                    type: "CHANGE_SORT",
                    column: "scheduledPickupTime",
                  })
                }>
                Scheduled Pickup Time
              </Table.HeaderCell>
              <Table.HeaderCell
                sorted={column === "deliveryStatusRawText" ? direction : null}
                onClick={() =>
                  dispatch({
                    type: "CHANGE_SORT",
                    column: "deliveryStatusRawText",
                  })
                }>
                Delivery Status
              </Table.HeaderCell>
              {/* <add-column-here> add a new <Table.HeaderCell> to define the header for the new column. Make sure the onClick calls dispatch with type "CHANGE_SORT". The column name should be the same as is returned in tripDataForTable. */}
              {globalState.user.isAdmin && (
                <Table.HeaderCell
                  sorted={column === "tripId" ? direction : null}
                  onClick={() =>
                    dispatch({ type: "CHANGE_SORT", column: "tripId" })
                  }>
                  Request ID
                </Table.HeaderCell>
              )}
              <Table.HeaderCell
                sorted={column === "cancelRawText" ? direction : null}
                onClick={() =>
                  dispatch({ type: "CHANGE_SORT", column: "cancelRawText" })
                }>
                Cancel
              </Table.HeaderCell>
              {props.mode === "active" && (
                <Table.HeaderCell
                  sorted={column === "resubmitRawText" ? direction : null}
                  onClick={() =>
                    dispatch({ type: "CHANGE_SORT", column: "resubmitRawText" })
                  }>
                  Resubmit
                </Table.HeaderCell>
              )}
            </Table.Row>
          </Table.Header>
          {data.map((row, i) => (
            <Table.Body key={i}>
              <Table.Row>
                <Table.Cell>{row.recipient}</Table.Cell>
                <Table.Cell>
                  {<OrgAddress profile={row.addressProfile} />}
                </Table.Cell>
                <Table.Cell>{row.supplier}</Table.Cell>
                <Table.Cell>{row.fulfiller}</Table.Cell>
                <Table.Cell>
                  {row.scheduledPickupTime.toLocaleTimeString([], {
                    year: "numeric",
                    month: "numeric",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Table.Cell>
                <Table.Cell>{row.deliveryStatusDisplay}</Table.Cell>
                {/* <add-column-here> add Table.Cell and return variable defined in tripDataForTable */}
                {globalState.user.isAdmin && (
                  <Table.Cell>{row.tripId}</Table.Cell>
                )}
                <Table.Cell>{row.cancelDisplay}</Table.Cell>
                {props.mode === "active" && (
                  <Table.Cell>{row.resubmitDisplay}</Table.Cell>
                )}
              </Table.Row>
            </Table.Body>
          ))}
        </Table>
      ) : (
        <p>There are no trips.</p>
      )}
      <Modal
        open={historyModalActive}
        closeIcon
        onClose={() => {
          setHistoryModalActive(false);
          setHistoryModalData([]);
        }}>
        <Dimmer active={modalLoading} inverted>
          <Loader inline />
        </Dimmer>
        <Modal.Header>Retries History</Modal.Header>
        <Modal.Content>
          {historyModalData.length > 0 ? (
            <Grid doubling>
              {historyModalData.map((data, i) => (
                <React.Fragment>
                  <Grid.Row>
                    <h3>{"Retry #" + (i + 1) + " :"}</h3>
                  </Grid.Row>
                  <Grid.Row>
                    <RetryHistoryTable data={data} />
                  </Grid.Row>
                </React.Fragment>
              ))}
            </Grid>
          ) : (
            <p>No Infromation is Avaliable</p>
          )}
        </Modal.Content>
      </Modal>
    </Container>
  );
}
