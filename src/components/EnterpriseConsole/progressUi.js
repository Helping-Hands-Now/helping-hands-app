import React, { useState, useEffect } from "react";
import {
  Grid,
  Container,
  GridColumn,
  GridRow,
  Divider,
} from "semantic-ui-react";
import StatusCount, { UNIFIED_STATUS } from "./statusCount";
import { Link } from "react-router-dom";
import { cancelDeliveryEvent } from "../../firebase.js";
import SuccessModal from "../SuccessModal";
import RMoment from "react-moment";

export function mapUnifiedStatus(trip) {
  let unifiedStatus = UNIFIED_STATUS.UNASSIGNED;
  let failureReason = null;
  if (
    trip.toBeFulfilledBy === "COMMUNITY_VOLUNTEER" &&
    trip.status === "assigned"
  ) {
    unifiedStatus = UNIFIED_STATUS.COMPLETED;
  }
  if (trip.toBeFulfilledBy === "UBER") {
    switch (trip.uberStatus) {
      case "CUSTOMER_CANCEL":
        failureReason = "Customer Cancelled";
        unifiedStatus = UNIFIED_STATUS.INCOMPLETE;
        break;
      case "COURIER_CANCEL":
        failureReason = "Driver Cancelled";
        unifiedStatus = UNIFIED_STATUS.INCOMPLETE;
        break;
      case "MERCHANT_CANCEL":
        failureReason = "Merchant Cancelled";
        unifiedStatus = UNIFIED_STATUS.INCOMPLETE;
        break;
      case "UBER_CANCEL":
        failureReason = "Uber Cancelled";
        unifiedStatus = UNIFIED_STATUS.INCOMPLETE;
        break;
      case "CANCELLED":
        failureReason = "Customer Cancelled";
        unifiedStatus = UNIFIED_STATUS.INCOMPLETE;
        break;
      case "FAILED":
        failureReason = "Unknown Uber Failure";
        unifiedStatus = UNIFIED_STATUS.INCOMPLETE;
        break;
      case "TO_BE_SCHEDULED":
        unifiedStatus = UNIFIED_STATUS.UNASSIGNED;
        break;
      case "ACTIVE":
        unifiedStatus = UNIFIED_STATUS.UNASSIGNED;
        break;
      case "SCHEDULED":
        unifiedStatus = UNIFIED_STATUS.UNASSIGNED;
        break;
      case "EN_ROUTE_TO_PICKUP":
        unifiedStatus = UNIFIED_STATUS.ASSIGNED;
        break;
      case "ARRIVED_AT_PICKUP":
        unifiedStatus = UNIFIED_STATUS.ASSIGNED;
        break;
      case "EN_ROUTE_TO_DROPOFF":
        unifiedStatus = UNIFIED_STATUS.OUT_FOR_DELIVERY;
        break;
      case "EN_ROUTE_TO_BATCHED_DROPOFF":
        unifiedStatus = UNIFIED_STATUS.OUT_FOR_DELIVERY;
        break;
      case "ARRIVED_AT_DROPOFF":
        unifiedStatus = UNIFIED_STATUS.OUT_FOR_DELIVERY;
        break;
      case "COMPLETED":
        unifiedStatus = UNIFIED_STATUS.COMPLETED;
        break;
      default:
        break;
    }
  } else if (trip.toBeFulfilledBy === "LYFT") {
    switch (trip.lyftStatus) {
      case "DRIVER_CANCELLED":
        failureReason = "Driver Cancelled";
        unifiedStatus = UNIFIED_STATUS.INCOMPLETE;
        break;
      case "CANCELLED":
        failureReason = "Delivery Was Cancelled";
        unifiedStatus = UNIFIED_STATUS.INCOMPLETE;
        break;
      case "FAILED":
        failureReason = "Lyft Failed";
        unifiedStatus = UNIFIED_STATUS.INCOMPLETE;
        break;
      case "PENDING":
        unifiedStatus = UNIFIED_STATUS.UNASSIGNED;
        break;
      case "ACTIVE":
        unifiedStatus = UNIFIED_STATUS.UNASSIGNED;
        break;
      case "TO_BE_SCHEDULED":
        unifiedStatus = UNIFIED_STATUS.UNASSIGNED;
        break;
      case "SCHEDULED":
        unifiedStatus = UNIFIED_STATUS.UNASSIGNED;
        break;
      case "ACCEPTED":
        unifiedStatus = UNIFIED_STATUS.ASSIGNED;
        break;
      case "ARRIVED_PICKUP":
        unifiedStatus = UNIFIED_STATUS.ASSIGNED;
        break;
      case "ARRIVED_AT_PICKUP":
        unifiedStatus = UNIFIED_STATUS.ASSIGNED;
        break;
      case "EN_ROUTE_TO_PICKUP":
        unifiedStatus = UNIFIED_STATUS.ASSIGNED;
        break;
      case "PICKED_UP":
        unifiedStatus = UNIFIED_STATUS.OUT_FOR_DELIVERY;
        break;
      case "EN_ROUTE_TO_BATCHED_DROPOFF":
        unifiedStatus = UNIFIED_STATUS.OUT_FOR_DELIVERY;
        break;
      case "EN_ROUTE_TO_DROPOFF":
        unifiedStatus = UNIFIED_STATUS.OUT_FOR_DELIVERY;
        break;
      case "ARRIVED_AT_DROPOFF":
        unifiedStatus = UNIFIED_STATUS.OUT_FOR_DELIVERY;
        break;
      case "DROPPED_OFF":
        unifiedStatus = UNIFIED_STATUS.COMPLETED;
        break;
      case "COMPLETED":
        unifiedStatus = UNIFIED_STATUS.COMPLETED;
        break;
      default:
        break;
    }
  }
  return [unifiedStatus, failureReason];
}

export default function ProgressUI(props) {
  const [confirmModal, setConfirmModal] = useState(null);
  const [totalTripsStatusObject, setTotalTripsStatusObject] = useState({});
  const [suppliersStatusObject, setSuppliersStatusObject] = useState([]);
  const [selectedSupplier, setSelectedSupplier] = useState("");
  const [supplierOptions, setSupplierOptions] = useState([]);

  const setSuppliersStatusesCount = (trips, suppliers) => {
    var seenSuppliers = {};

    //Gets all unique suppliers in the trips
    for (var trip of trips) {
      if (seenSuppliers[trip.supplier.id]) {
        continue;
      }
      let deliveryEvents;
      for (let supplier of suppliers) {
        if (supplier.id === trip.supplier.id) {
          deliveryEvents = supplier.deliveryEvents;
          break;
        }
      }
      seenSuppliers[trip.supplier.id] = {
        id: trip.supplier.id,
        name: trip.supplier.name,
        deliveryEvents: deliveryEvents,
      };
    }

    seenSuppliers = Object.values(seenSuppliers);

    // if there aren't more than one unique pickup location, no point in having seperate status counts.
    for (let supplier of seenSuppliers) {
      var countObj = setStatusesCount(trips, supplier.id);
      supplier.count = countObj;
    }

    return seenSuppliers;
  };

  const setStatusesCount = (trips, supplier) => {
    var pickupsScheduled = 0;
    var enRouteToPickup = 0;
    var outForDelivery = 0;
    var completed = 0;
    var failed = 0;
    var total = 0;
    var deliveryBucket = {};
    let uniqueNameList = new Set();

    for (var trip of trips) {
      if (supplier !== "none") {
        if (trip.supplier.id !== supplier) {
          continue;
        }
      }

      let [unifiedStatus, failureReason] = mapUnifiedStatus(trip);
      switch (unifiedStatus) {
        case UNIFIED_STATUS.UNASSIGNED:
          pickupsScheduled++;
          break;
        case UNIFIED_STATUS.ASSIGNED:
          enRouteToPickup++;
          break;
        case UNIFIED_STATUS.OUT_FOR_DELIVERY:
          outForDelivery++;
          break;
        case UNIFIED_STATUS.COMPLETED:
          completed++;
          break;
        case UNIFIED_STATUS.INCOMPLETE:
          failed++;
          break;
        default:
          break;
      }

      if (trip.toBeFulfilledBy === "UBER") {
        if (
          trip.deliveryEvent &&
          trip.uberStatus !== "COMPLETED" &&
          trip.uberStatus !== "FAILED"
        ) {
          deliveryBucket[trip.deliveryEvent] =
            (deliveryBucket[trip.deliveryEvent] || 0) + 1;
        }
      }

      if (trip.toBeFulfilledBy === "LYFT") {
        if (
          trip.deliveryEvent &&
          trip.lyftStatus !== "COMPLETED" &&
          trip.lyftStatus !== "FAILED"
        ) {
          deliveryBucket[trip.deliveryEvent] =
            (deliveryBucket[trip.deliveryEvent] || 0) + 1;
        }
      }

      let name = trip.recipient.firstName + " " + trip.recipient.lastName;

      if (!uniqueNameList.has(name)) {
        uniqueNameList.add(name);
      }
    }

    total = uniqueNameList.size;

    var object = {};
    object.pickupsScheduled = pickupsScheduled;
    object.enRouteToPickup = enRouteToPickup;
    object.outForDelivery = outForDelivery;
    object.completed = completed;
    object.failed = failed;
    object.total = total;

    object.deliveryBucket = deliveryBucket;
    return object;
  };

  useEffect(() => {
    setTotalTripsStatusObject(() => {
      return setStatusesCount(props.trips, "none");
    });
    setSuppliersStatusObject(() => {
      return setSuppliersStatusesCount(props.trips, props.suppliers);
    });
  }, [props.trips, props.suppliers]);

  const showConfirmModal = (deliveryEvent) => {
    setConfirmModal(
      <SuccessModal
        open={true}
        onClose={() => {
          setConfirmModal(null);
        }}
        title={"Cancel all outstanding requests?"}
        textArray={[
          "Are you sure you want to cancel all outstanding requests?",
          <React.Fragment>
            This will cancel all outstanding trips for this location starting at{" "}
            <RMoment format={`MMMM D, h:mm A`} date={deliveryEvent.startTime} />{" "}
            {"."}
          </React.Fragment>,
        ]}
        primaryButtonText={"Yes, cancel it"}
        primaryOnClick={() => {
          cancelDeliveryEvent({
            orgId: props.currentOrg,
            deliveryEventId: deliveryEvent.id,
          });
          setConfirmModal(null);
        }}
        secondaryButtonText={"No, don't cancel"}
        secondaryOnClick={() => {
          setConfirmModal(null);
        }}
      />
    );
  };

  return (
    <Container>
      {confirmModal}
      <Grid doubling centered style={{ marginTop: "8px", marginBottom: "8px" }}>
        <GridRow>
          <GridColumn>
            <StatusCount
              countObject={totalTripsStatusObject}
              updateFilteredButtonStatuses={(selectedStatus) =>
                props.updateFilteredButtonStatuses(selectedStatus)
              }></StatusCount>
          </GridColumn>
        </GridRow>
      </Grid>
      {suppliersStatusObject.map((supplier) => (
        <React.Fragment key={supplier.id}>
          <Divider></Divider>
          <GridRow verticalAlign="middle" columns={2}>
            <GridColumn>
              <h5>{supplier.name}:</h5>
              {supplier.deliveryEvents &&
                supplier.deliveryEvents.length &&
                supplier.deliveryEvents.map((deliveryEvent) => (
                  <Container fluid>
                    <RMoment
                      format={`MMMM D, h:mm A`}
                      date={deliveryEvent.startTime}
                    />
                    {supplier.count.deliveryBucket[deliveryEvent.id] !==
                      undefined && (
                      <React.Fragment>
                        {": "}
                        <Link
                          onClick={() => showConfirmModal(deliveryEvent)}
                          to="#">
                          Cancel all outstanding requests
                        </Link>
                      </React.Fragment>
                    )}
                  </Container>
                ))}
            </GridColumn>
          </GridRow>
        </React.Fragment>
      ))}
    </Container>
  );
}
