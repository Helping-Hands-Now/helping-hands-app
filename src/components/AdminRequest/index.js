import React, { useState, useEffect } from "react";
import { Container } from "semantic-ui-react";

import styled from "styled-components";
import UIInput from "../UI/UIInput";
import UIText from "../UI/UIText";
import { getUberOrderData, getLyftOrderData } from "../../firebase.js";
import { db } from "../../firebase.js";
import InspectedRequest from "../AdminRequestList/InspectedRequest/";
import ReactJson from "react-json-view";

const Styles = styled.div`
  margin: 15px;
`;

export default function AdminRequest() {
  const [requestId, setRequestId] = useState(null);
  const [requestData, setRequestData] = useState(null);
  const [deliveryData, setDeliveryData] = useState([]);

  useEffect(() => {
    if (!requestId) {
      return;
    }

    async function fetchData() {
      await fetchRequestData();
    }

    async function fetchRequestData() {
      let requestDoc = await db.collection("requests").doc(requestId).get();
      if (!requestDoc.exists) {
        // TODO we should show an error...
        return;
      }

      let request = requestDoc.data();
      request.id = requestDoc.id;

      let adminMetaData = await db
        .collection("requests")
        .doc(requestDoc.id)
        .collection("admin")
        .doc("metaData")
        .get();

      await db
        .collection("users")
        .doc(request.createdBy)
        .get()
        .then((user) => {
          request.creator = user.data();
        })
        .catch((e) => {
          console.log("Unable to get creator data: ", e);
        });

      if (adminMetaData) {
        request.adminData = adminMetaData.data();
      }
      setRequestData(request);
      if (request.toBeFulfilledBy === "UBER") {
        try {
          const r = await getUberOrderData({
            requestId,
          });
          console.log("Uber data", r);
          setDeliveryData(r.data || []);
        } catch (e) {
          setDeliveryData([]);
        }
      } else if (request.toBeFulfilledBy === "LYFT") {
        try {
          const r = await getLyftOrderData({
            requestId,
          });
          console.log("Lyft data", r);
          setDeliveryData(r.data || []);
        } catch (e) {
          console.error(e);
          setDeliveryData([]);
        }
      }
    }
    fetchData();
  }, [requestId]);

  const renderTripData = () => {
    if (!requestData) {
      return null;
    }

    let partnerFailureError = null;
    let failureReason = null;
    let deliveryStatus = null;

    if (requestData.uberFailureError) {
      partnerFailureError = `Uber Failure Error: ${requestData.uberFailureError}`;
    }
    if (requestData.lyftFailureError) {
      partnerFailureError = `Lyft Failure Error: ${requestData.lyftFailureError}`;
    }
    switch (requestData.outcome) {
      case "error_creating":
        failureReason =
          "Error creating trip with delivery partner. We failed to send the trip to their API.";
        break;

      case "timed_out":
        failureReason = "Dispatch Timeout";
        break;

      case "COURIER_CANCEL":
        failureReason = "Driver Cancelled";
        break;
      default:
        break;
    }
    if (failureReason) {
      failureReason = `Failure Reason: ${failureReason}`;
    }
    if (requestData.uberStatus) {
      deliveryStatus = `Uber Status: ${requestData.uberStatus}`;
    }
    if (requestData.lyftStatus) {
      deliveryStatus = `Lyft Status: ${requestData.lyftStatus}`;
    }

    const renderTrips = () => {
      if (!deliveryData.length) {
        return null;
      }

      return (
        <React.Fragment>
          Uber Trips:
          {deliveryData.map((data, i) => (
            <ReactJson theme="monokai" src={data} key={i} />
          ))}
        </React.Fragment>
      );
    };

    return (
      <Container>
        <Styles>
          <UIText>Trip Data:</UIText>
          <div>{deliveryStatus}</div>
          <div>{failureReason}</div>
          <div>{partnerFailureError}</div>
          {renderTrips()}
        </Styles>
      </Container>
    );
  };

  return (
    <React.Fragment>
      <UIInput
        hook={(e) => setRequestId(e.target.value)}
        placeholder={`Set request id `}
      />
      {renderTripData()}
      {requestData && (
        <InspectedRequest inspectedRequest={requestData} options={{}} />
      )}
    </React.Fragment>
  );
}
