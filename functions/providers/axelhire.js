const { request } = require("express");
const moment = require("moment");
const functions = require("firebase-functions");
const fetch = require("node-fetch");
const { sendSlackMessage } = require("../bots");
const { querySupplierTimeZone } = require("../suppliers");
const { getE164PhoneNumber } = require("./../utils");
const { loadRequestDataFromDocs } = require("./../requests");
const { PROJECT_ID, METHODS, PROVIDERS, REQUEST_STATUS } = require("./utils");

const STAGING_ENDPOINT = "https://api.staging.axlehire.com/v3";
const PROD_ENDPOINT = "https://api.axlehire.com/v3";

const PROD_API_TOKEN = functions.config().axelhire.api_token;
const STAGING_API_TOKEN = functions.config().axelhire.staging_api_token;

const DELIVERY_PROOF_PHOTO_REQUIRED = true;
const SMS_ENABLED = false;
const SIGNATURE_REQUIRED = false; // until pandemic is over
const ID_REQUIRED = false; // until pandemic is over

/**
 *
 * @param {string} relPath
 * @param {value in METHODS enum} method
 * @param {request body} params
 * @param {bool} expectData
 * @returns response data, error if any, and status code
 */
async function callAxelHireAPI(relPath, method, params, expectData = false) {
  const firebaseProjectId = functions.config().gcp.project_id;
  const isProd = firebaseProjectId === PROJECT_ID.PROD ? true : false;
  const endpoint = isProd ? PROD_ENDPOINT : STAGING_ENDPOINT;
  const token = isProd ? PROD_API_TOKEN : STAGING_API_TOKEN;
  let headers = {
    Authorization: "Token " + token,
    "Content-Type": "application/json",
    "Cache-Control": "no-cache",
  };
  if (expectData) {
    headers = {
      ...headers,
      Accept: "application/json",
      "Accept-Charset": "utf-8",
    };
  }

  let options = {
    headers,
    method,
  };
  if (method !== METHODS.GET) {
    options = {
      ...options,
      body: JSON.stringify(params),
      json: true,
    };
  }

  let response = null;
  let responseData = null;
  let error = null;

  try {
    response = await fetch(endpoint + relPath, options);
  } catch (e) {
    error = `Error sending request: ${e}, request body: ${JSON.stringify(
      params
    )}`;
    return {
      data: responseData,
      error,
      statusCode: "",
    };
  }

  if (response.ok) {
    try {
      // Clone is needed so response.text() works if response is not JSON and ends in catch block
      responseData = await response.clone().json();
    } catch (e) {
      responseData = await response.text();
    }
  } else {
    responseError = await response.text();
    error = `Error in AxelHire request: ${responseError}`;
    if (isProd) {
      const enterprisebotWebhook = functions.config().enterprisebotwebhook.url;
      const message =
        "*AXELHIRE API | Error: " +
        relPath +
        "*" +
        "```" +
        error +
        "``` \n *Params*: ```" +
        JSON.stringify(params) +
        "```";
      try {
        sendSlackMessage(enterprisebotWebhook, message);
      } catch (err) {
        // just log to console b/c do not want to disrupt the other requests
        console.error(`Error sending slack message ${JSON.stringify(err)}`);
      }
    }
  }

  return {
    data: responseData,
    error,
    statusCode: response.status,
  };
}

/**
 *
 * @param {int} shipmentTrackingCode - self-explanatory
 * @returns a list of Event objects --> {events: [<event_1>, <event_2>,...]}
 * each "event" will have a "signal" field which is synonymous as status
 * events are sorted by "ts" (timestamp) field, so first entry is the latest update
 */
async function trackShipment(shipmentTrackingCode) {
  const relPath = `/tracking/${shipmentTrackingCode}/events`;
  const method = METHODS.GET;
  return await callAxelHireAPI(relPath, method, null, true);
}

/**
 *
 * @param {int} shipmentId - self-explanatory
 * @returns a Shipment object
 */
async function getShipment(shipmentId) {
  const relPath = `/shipments/${shipmentId}`;
  const method = METHODS.GET;
  return await callAxelHireAPI(relPath, method, null, true);
}

/**
 *
 * @param {} data - data to create a shipment (see constructRequestPayloads function)
 * @returns \{"id": <shipment_id>, "tracking_code": <shipment_tracking_code>}
 */
async function submitAxelHireShipment(data) {
  const relPath = `/shipments`;
  const method = METHODS.POST;
  return await callAxelHireAPI(relPath, method, data, true);
}

/**
 *
 * @param {} db - firebase db
 * @returns void
 * this is a pubsub function scheduled to run every 5 mins to create AxelHire requests
 */
async function createAxelHireRequests(db) {
  // axelhire trips must be scheduled at least 24 hrs prior to pickup
  const one_day_from_now = moment().add(24, "hours").valueOf();
  let requests = await db
    .collection("requests")
    .where("toBeFulfilledBy", "==", PROVIDERS.AXELHIRE)
    .where("status", "in", [REQUEST_STATUS.OPEN, REQUEST_STATUS.ASAP])
    .where("scheduledPickupTime", ">=", one_day_from_now)
    .get();

  if (requests.empty) {
    console.log(`No open AxelHire requests`);
    return;
  }
  console.log(`Total of ${requests.size} open AxelHire requests`);

  // Group requests by supplier
  const requestsGroups = new Map();
  requests.forEach((requestDoc) => {
    const supplierId = requestDoc.get("supplier");
    if (!requestsGroups.has(supplierId)) {
      requestsGroups.set(supplierId, []);
    }
    requestsGroups.get(supplierId).push(requestDoc);
  });

  // process in groups sequentially
  for (let [supplierId, requestDocs] of requestsGroups) {
    try {
      let writeBatch = db.batch(); // each group will execute a batch write
      const supplierSnapshot = await db
        .collection("suppliers")
        .doc(supplierId)
        .get();
      const requestsWithRecipientData = await loadRequestDataFromDocs(
        db,
        requestDocs,
        false
      );
      const {
        eventStartTime,
        eventEndTime,
      } = await genLocalPickupAndDropoffTime(
        requestsWithRecipientData[0].scheduledPickupTime,
        supplierSnapshot
      );
      const requestPayloads = constructRequestPayloads(
        requestsWithRecipientData,
        supplierSnapshot,
        eventStartTime,
        eventEndTime
      );

      // send payloads to create shipment via AxelHire API
      // this will execute in parallel as sequence is not important
      const responses = await Promise.all(
        requestPayloads.map(async (payload) => {
          const res = await submitAxelHireShipment(payload);
          const hasError = res.error !== null;
          return {
            internalRequestId: payload.internal_id,
            shipmentId: hasError ? -1 : res.data.id,
            shipmentTrackingCode: hasError ? "N/A" : res.data.tracking_code,
            error: res.error,
            statusCode: res.statusCode,
          };
        })
      );

      writeBatch = updateAxelHireRequests(db, responses, writeBatch);

      const successResponses = responses.filter((res) => {
        return res.error === null;
      });
      // all requests for this group failed, abort
      if (successResponses.length === 0) {
        await writeBatch.commit(); // update request docs with error messages before aborting
        throw new Error(`Failed to created shipments for all requests.`);
      }

      writeBatch = storeAxelHireOrders(db, successResponses, writeBatch);

      console.log(
        `Supplier group ${supplierId}: Total requests -> ${requestDocs.length}. Total shipments created successfully -> ${successResponses.length}`
      );
      await writeBatch.commit();
    } catch (e) {
      console.error(
        `Failed to process requests for supplier group ${supplierId}. Error: ${e.message}, stack trace: ${e.stack}`
      );
    }
  }
}

/**
 *
 * @param {int} timestamp - scheduled pickup time
 * @param {QueryDocumentSnapshot} supplierSnapshot
 * @returns /{eventStartTime, eventEndTime}
 * axelhire events default to 4 hours unless pre-negotiated
 * setting 4 hours for all events for now
 */
async function genLocalPickupAndDropoffTime(timestamp, supplierSnapshot) {
  let timeZoneId = "";
  if (!supplierSnapshot.data().timeZone) {
    const coordinates = geohash.decode(supplierSnapshot.data().geohash);
    const res = await querySupplierTimeZone(
      db,
      {
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
        supplierId: supplierSnapshot.id,
        timestamp,
      },
      context
    );
    timeZoneId = res;
  } else {
    timeZoneId = supplierSnapshot.data().timeZone;
  }

  // axelhire api requires timestamps to be ISO strings
  const eventStartTime = moment.tz(timestamp, timeZoneId).toISOString(true); // keep offset to avoid utc conversion
  const eventEndTime = moment
    .tz(timestamp, timeZoneId)
    .add(4, "hours")
    .toISOString(true); // keep offset to avoid utc conversion

  return { eventStartTime, eventEndTime };
}

/**
 *
 * @param {array of modified requestDocs} requests - request objects with recipient data added
 * @param {QueryDocumentSnapshot} supplierSnapshot - self-explanatory
 * @param {string} eventStartTime - event's local start time as ISO string
 * @param {string} eventEndTime - event's local end time as ISO string
 * @returns {axelhire_submit_shipment_payload_type}
 * This function constructs the request payloads before submitting them to AH
 * The payload's format has to correspond to AH's API.
 */
function constructRequestPayloads(
  requests,
  supplierSnapshot,
  eventStartTime,
  eventEndTime
) {
  const supplierData = supplierSnapshot.data();
  const pickup_address = {
    street: supplierData.street,
    street2: supplierData.street2 || "",
    city: supplierData.city,
    state: supplierData.state,
    zipcode: supplierData.zipCode,
  };

  const requestPayloads = requests.map((request) => {
    const recipientData = request.recipient;
    const customer = {
      name: recipientData.firstName + " " + recipientData.lastName,
      email: recipientData.email || "",
      phone_number: getE164PhoneNumber(recipientData.phoneNumber),
    };
    const dropoff_address = {
      street: recipientData.street,
      street2: recipientData.street2 || "",
      city: recipientData.city,
      state: recipientData.state,
      zipcode: recipientData.zipCode,
    };

    return {
      customer,
      internal_id: request.id,
      workload: request.parcels.length,
      delivery_items: request.delivery_items || "",
      pickup_address,
      pickup_earliest_ts: eventStartTime,
      pickup_latest_ts: eventEndTime,
      pickup_note: supplierData.pickupInstructions,
      dropoff_address,
      dropoff_earliest_ts: eventStartTime,
      dropoff_latest_ts: eventEndTime,
      dropoff_note: recipientData.dropoffInstructions || "",
      delivery_proof_photo_required: DELIVERY_PROOF_PHOTO_REQUIRED,
      signature_required: SIGNATURE_REQUIRED,
      sms_enabled: SMS_ENABLED,
      id_required: ID_REQUIRED,
      parcels: request.parcels,
    };
  });

  return requestPayloads;
}

/**
 *
 * @param {} db
 * @param {array of parsed responses} successResponses - see caller function
 * @param {Firestore WriteBatch} batch - self-explanatory
 * @returns {Firestore WriteBatch}
 * This function add new doc-writes to the WriteBatch.
 * Docs to be stored in "axelhire_orders" collection.
 */
function storeAxelHireOrders(db, successResponses, batch) {
  for (const res of successResponses) {
    let newOrderRef = db.collection("axelhire_orders").doc();
    batch.create(newOrderRef, {
      requestId: res.internalRequestId,
      shipmentId: res.shipmentId,
      shipmentTrackingCode: res.shipmentTrackingCode,
      axelhireStatus: "GEOCODED", // initial status after shipment creation
    });
  }
  return batch;
}

/**
 *
 * @param {} db
 * @param {array of parsed responses} responses
 * @param {Firestore WriteBatch} batch - self-explanatory
 * @returns {Firestore WriteBatch}
 * This function add update doc-writes to the WriteBatch.
 * Docs in "requests" collection to be updated.
 */
function updateAxelHireRequests(db, responses, batch) {
  for (const res of responses) {
    let requestRef = db.collection("requests").doc(res.internalRequestId);
    const errorMessage =
      res.error === null ? "" : `Status code: ${res.statusCode} | ${res.error}`;
    batch.update(requestRef, {
      axelhireStatus: res.error === null ? "GEOCODED" : "NOT_CREATED",
      axelhireError: errorMessage,
      status:
        res.error === null ? REQUEST_STATUS.PENDING : REQUEST_STATUS.ERROR,
    });
  }
  return batch;
}

module.exports = {
  createAxelHireRequests,
};
