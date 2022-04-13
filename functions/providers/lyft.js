const { request } = require("express");
const moment = require("moment");
const functions = require("firebase-functions");
const fetch = require("node-fetch");
const { sendSlackMessage } = require("../bots");
const { validateAddress } = require("./../address");
const { getE164PhoneNumber } = require("./../utils");

const { loadRequestData } = require("./../requests");
const { getDeliveryBatches } = require("./batching");

const LOGIN_ENDPOINT = "https://api.lyft.com/oauth/token";
const LYFT_ENDPOINT = "https://api.lyft.com/v1/delivery";

const CLIENT_ID = functions.config().lyft.client_id;
const CLIENT_SECRET = functions.config().lyft.client_secret;
const REFRESH_TOKEN = functions.config().lyft.refresh_token;

const LYFT_BATCH_SIZE = parseInt(functions.config().lyft.batch_size) || 1;

async function getAccessToken(db) {
  let accessToken;
  let tokenDoc = await db.collection("lyft_token").doc("token").get();

  if (tokenDoc.exists) {
    let tokenContainer = tokenDoc.data();
    if (tokenContainer.timeCreated + tokenContainer.expiresIn > Date.now()) {
      accessToken = tokenContainer.token;
    }
  }

  // if token doesn't exist or is expired, then get a new token.
  if (!accessToken) {
    accessToken = await getAndSaveAccessToken(db);
  }

  return accessToken;
}

async function getAndSaveAccessToken(db, expires) {
  const timeCreated = Date.now();
  let accessToken;
  let tokenResponse;

  let body = { grant_type: "refresh_token", refresh_token: REFRESH_TOKEN };
  let response = await fetch(LOGIN_ENDPOINT, {
    body: JSON.stringify(body),
    headers: {
      Authorization:
        "Basic " +
        Buffer.from(CLIENT_ID + ":" + CLIENT_SECRET).toString("base64"),
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
    },
    method: "POST",
  });

  if (!response.ok) {
    throw new Error(
      `error status getting an access token from Lyft: ${response.statusCode}`
    );
  }

  try {
    tokenResponse = await response.json();
    accessToken = tokenResponse.access_token;
  } catch (err) {
    throw new Error(
      `internal error returned when getting an access token from Lyft: unexpected body`
    );
  }
  if (!accessToken) {
    throw new Error(
      `error returned when getting an access token from Lyft: ${JSON.stringify(
        tokenResponse
      )}`
    );
  }

  await db
    .collection("lyft_token")
    .doc("token")
    .set({
      token: accessToken,
      timeCreated,
      expiresIn: expires ? expires : tokenResponse.expires_in,
    });

  return accessToken;
}

async function callLyftAPI(accessToken, relPath, method, params) {
  let response;
  let responseData;
  const headers = {
    Authorization: "Bearer " + accessToken,
    "Content-Type": "application/json",
    "Cache-Control": "no-cache",
  };

  if (method !== "GET") {
    response = await fetch(LYFT_ENDPOINT + relPath, {
      body: JSON.stringify(params),
      headers: {
        Authorization: "Bearer " + accessToken,
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
      },
      method: method,
    });
  } else {
    response = await fetch(LYFT_ENDPOINT + relPath, {
      headers: {
        Authorization: "Bearer " + accessToken,
        "Cache-Control": "no-cache",
      },
      method: "GET",
    });
  }

  if (response.ok) {
    try {
      // Clone is needed so response.text() works if response is not JSON and ends in catch block
      responseData = await response.clone().json();
    } catch (e) {
      responseData = await response.text();
    }
    return { data: responseData };
  } else {
    responseData = await response.text();
    return {
      data: responseData,
      error: `Error in Lyft request: ${responseData}`,
      statusCode: response.status,
    };
  }
}

async function makeLyftRequest(db, accessToken, relPath, method, params) {
  let response = await callLyftAPI(accessToken, relPath, method, params);

  // handle goood response
  if (!response.error) {
    return response;
  }

  // Handle errora except bad authorization response.
  if (response.statusCode !== 401) {
    //we only want slack message to get triggered on prod and not dev
    const firebaseProjectId = functions.config().gcp.project_id;
    let message;

    if (firebaseProjectId === "helping-hands-community") {
      const enterprisebotwebhook = functions.config().enterprisebotwebhook.url;
      message =
        "*LYFT INTEGRATION: error making a request to Lyft API at " +
        relPath +
        "*" +
        "```" +
        JSON.stringify(response.data) +
        "``` \n *Params*: ```" +
        JSON.stringify(params) +
        "```";
      try {
        sendSlackMessage(enterprisebotwebhook, message);
      } catch (err) {
        throw new Error(`Error sending slack message ${JSON.stringify(err)}`);
      }
    }

    return response;
  }

  // invalid token, let's try and get a new access token
  // get a new token. this throws if not...
  try {
    accessToken = await getAndSaveAccessToken(db);
  } catch (err) {
    throw new Error(
      `LYFT INTEGRATION: error trying to get a new access token after previous token error ${JSON.stringify(
        err
      )}`
    );
  }

  // try request again with new token!
  try {
    response = await callLyftAPI(accessToken, relPath, params);
  } catch (err) {
    throw new Error`LYFT INTEGRATION: error making a request to lyft API at {relPath} even with new token ${JSON.stringify(
      err
    )}`();
  }

  return response;
}

// Validate address and save formatted address and lat/lng.
async function getAddress(batch, stop, stopRef) {
  if (stop.placeId === "INVALID_ADDRESS") {
    return "cannot create a delivery with a stop with an invalid address";
  }

  return validateAddress(stop)
    .then((r) => {
      let data = r.data;
      stop.geohash = data.geohash;
      stop.placeId = data.placeId;
      stop.address = data.formatted_address;
      stop.lat = data.lat;
      stop.lng = data.lng;
      // save the updated stop address here
      batch.update(stopRef, stop);
      return null;
    })
    .catch((err) => {
      // invalid address
      stop.placeId = "INVALID_ADDRESS";
      batch.update(stopRef, stop);
      return `no valid stop location and tried getting one. didn't work ${err.message}`;
    });
}

// Create a pickup stop object from the supplier and add to stops.
function createPickup(supplier, stops) {
  const location = {
    lat: supplier.lat,
    lng: supplier.lng,
    address: supplier.address,
  };

  const contact = {
    name: supplier.name,
    phone_number: getE164PhoneNumber(supplier.primaryPhoneNumber),
  };

  const stop = {
    stop_type: "pickup",
    location,
    contact,
    package_external_ids: [],
    note:
      supplier.pickupInstructions ||
      // TODO we need a better default message....
      "Look for a Lyft Grocery Pickup sign and pick up donation",
  };

  stops.push(stop);
}

// Create a dropoff stop and package object and add package to the pickupStop.
// Return the description of the package to deliver.
// returnable is "boomerang" for Lyft, whether the package should be returned in case of delivery failure
function createDropoff(request, stops, returnable) {
  let recipient = request.recipient;

  stops[0].package_external_ids.push(request.id);

  const location = {
    lat: recipient.lat,
    lng: recipient.lng,
    address: recipient.address,
  };

  const contact = {
    name: `${recipient.firstName} ${recipient.lastName}`,
    phone_number: getE164PhoneNumber(recipient.phoneNumber),
  };

  // Create a unique package id for each retry.
  const packageId =
    request.lyftRetries > 0
      ? request.id + ":" + request.lyftRetries
      : request.id;

  const stop = {
    stop_type: "dropoff",
    location,
    contact,
    package_external_id: packageId,
    note:
      recipient.dropoffInstructions ||
      "Call the recipient to let them know you’ve arrived",
  };

  const packageToDeliver = {
    external_id: packageId,
    description: `package for ${location.address}`,
    returnable: !!returnable,
  };

  stops.push(stop);
  return packageToDeliver;
}

// Create a Lyft delivery path based on the order of the request objects.
// First a stop for the supplier, then a stop to drop off for each request.
// Note that a supplier doc and requests docs must be given, not just the data.
// Note that this function assumes (and does not check) that each request supplier
//   is the same as the supplier given by supplierDoc.
// createDelivery path will either return the new path id or throw an error.
async function createDeliveryPath(db, supplierDoc, requestDocs) {
  var { loadRequestDataFromDocs } = require("./../requests");

  let errorResult;
  let expandedError;

  // stops is an array to implement an ordered list of pickup and dropoff stops.
  const stops = [];

  // packages is an array of packages to be dropped off.
  const packages = [];

  // Mapping between package id and request ref
  const refs = {};

  // nothing to do here
  if (requestDocs.length === 0) {
    throw new Error("LYFT INTEGRATION: no requests for path delivery call");
  }

  const accessToken = await getAccessToken(db);

  let batch = db.batch();

  let requests = await loadRequestDataFromDocs(db, requestDocs, false);
  let supplierError;

  let promises = requests.map((request) => {
    let recipient = request.recipient;
    if (!recipient) {
      request.status = "closed";
      request.lyftFailureError = `LYFT INTEGRATION: request to be sent to lyft with no recipient`;
      return null;
    }

    // Do not validate apartment as long as apartment is not an empty field
    if (recipient.apartment) {
      recipient.skipApartmentCheck = true;
    }

    if (supplierDoc.get("skipAddressValidation")) {
      recipient.skipAddressCheck = true;
    }

    return getAddress(
      batch,
      recipient,
      db.collection("users").doc(recipient.id)
    ).then((error) => {
      if (error) {
        request.status = "closed";
        request.lyftFailureError = `LYFT INTEGRATION: ${error}`;
      } else {
        request.lyftFailureError = null;
      }
      return null;
    });
  });

  // Just a stop to get packages from the supplier
  let supplier = supplierDoc.data();
  supplier.skipApartmentCheck = true;
  promises.push(
    getAddress(
      batch,
      supplier,
      db.collection("suppliers").doc(supplierDoc.id)
    ).then((error) => {
      if (error) {
        supplierError = `LYFT INTEGRATION error adding supplier ${supplier.id}: ${error}`;
      }
      return null;
    })
  );

  await Promise.all(promises);

  // First stop to pickup from supplier
  createPickup(supplier, stops);

  let request;
  for (request of requests) {
    let requestRef = db.collection("requests").doc(request.id);
    let retries = request.lyftRetries || 0;
    let retryRef =
      retries > 0
        ? requestRef.collection("retries").doc(request.id + ":" + retries)
        : null;

    // Make sure all requested are closed if there was an error with supplier address.
    if (!request.lyftFailureError && supplierError) {
      request.lyftFailureError = supplierError;
    }

    if (!request.lyftFailureError) {
      packageToDeliver = createDropoff(request, stops, supplier.boomerang);
      packages.push(packageToDeliver);

      refs[request.id] = { retryRef, requestRef, retries };
    } else {
      expandedError = `LYFT INTEGRATION: error creating delivery for the lyft integration for request ${request.id}: ${request.lyftFailureError}`;
      console.error(expandedError);

      // if there was an error creating the request, we should just fail the trip as opposed
      // to having trips hanging forever and clogging up the system
      closeRequestWithError(db, batch, request);
    }
  }

  if (packages.length === 0 || stops.length === 0) {
    errorResult =
      "LYFT INTEGRATION: no packages to deliver.  See error log for details.";
    console.error(errorResult);
    await batch.commit();
    throw new Error(errorResult);
  }

  const pathRequestBody = {
    packages: packages,
    stops: stops,
  };
  const deliveryResponse = await makeLyftRequest(
    db,
    accessToken,
    "/paths",
    "POST",
    pathRequestBody
  );

  // If Lyft returns an error, then no orders where taken by Lyft.
  // Fail all requests to keep them from being resubmitted.
  if (deliveryResponse.error) {
    for (request of requests) {
      if (!request.lyftFailureError) {
        request.lyftFailureError = deliveryResponse.error;
      }
      const packageId =
        request.lyftRetries > 0
          ? request.id + ":" + request.lyftRetries
          : request.id;
      const ref = refs[packageId];
      if (!ref) {
        // Not recoverable
        throw new Error(
          "LYFT INTEGRATION: INTERNAL ERROR.  Package not found in list" +
            JSON.stringify(delivery)
        );
      }
      closeRequestWithError(db, batch, request);
    }
    await batch.commit();
    throw new Error(`LYFT INTYEGRATION: ${deliveryResponse.error}`);
  }

  const deliveryResult = deliveryResponse.data;
  const pathId = deliveryResult.delivery_path_id;
  const deliverys = deliveryResult.delivery_orders;

  for (delivery of deliverys) {
    console.log(
      `LYFT INTEGRATION: got order id ${delivery.delivery_order_id} for request ${request.id}`
    );

    let ref = refs[delivery.package_external_id];
    if (!ref) {
      // Not recoverable
      throw new Error(
        "LYFT INTEGRATION: INTERNAL ERROR.  Package not found in list" +
          JSON.stringify(delivery)
      );
    }

    let order = {
      requestId: delivery.package_external_id,
      orderId: delivery.delivery_order_id,
      lyftPathId: pathId,
      orderStatus: "ACTIVE",
      lyftStatus: "pending",
      lyftRetries: ref.retries,
      // it may be confusing when looking at this data later?
      // storing 0 meant itwas scheduled for ASAP at the time of creation
      // check request status if we care
      pickupTime: 0,
      batchSize: stops.length - 1, // Subtracts supplier stop
    };
    let orderRef = db.collection("lyft_orders").doc();
    batch.create(orderRef, order);

    // update the status of the request to pending fulfillment
    // also update lyftStatus
    batch.update(ref.requestRef, {
      lyftStatus: "ACTIVE", // let's start with active to be consistent with what the API returns
      status: "pending_fulfillment",
    });

    if (ref.retryRef) {
      batch.update(ref.retryRef, {
        lyftStatus: "ACTIVE", // let's start with active to be consistent with what the API returns
        status: "pending_fulfillment",
      });
    }
  }

  // make all the changes
  // if this fails, we have dangling trips which isn't good. we have to check the logs and reconcile...
  await batch.commit().catch((err) => {
    console.error(
      "LYFT INTEGRATION: error doing batch commit when creating lyft request. uh oh",
      err
    );
    throw err;
  });

  return pathId;
}

function closeRequestWithError(db, batch, request) {
  let expandedError = `LYFT INTEGRATION: error creating delivery for the lyft integration for request ${request.id}: ${request.lyftFailureError}`;
  console.error(expandedError);

  // if there was an error creating the request, we should just fail the trip as opposed
  // to having trips hanging forever and clogging up the system
  let requestData = {
    status: "closed",
    lyftStatus: "FAILED", // technically it should be never created but that's fine
    outcome: "error_creating", // seems like new outcome here makes sense
    timeClosed: new Date(),
    lyftFailureError: expandedError,
  };

  let requestRef = db.collection("requests").doc(request.id);
  let retries = request.lyftRetries || 0;
  let retryRef =
    retries > 0
      ? requestRef.collection("retries").doc(request.id + ":" + retries)
      : null;

  batch.update(requestRef, requestData);

  if (retryRef) {
    batch.update(retryRef, requestData);
  }
}

async function getDeliveryOrder(db, orderId, accessToken) {
  if (!accessToken) {
    accessToken = await getAccessToken(db);
  }

  try {
    const deliveryOrder = await makeLyftRequest(
      db,
      accessToken,
      `/orders/${orderId}`,
      "GET"
    );
    if (deliveryOrder.error) {
      console.error(
        `LYFT INTEGRATION: error getting delivery order ${orderId} `,
        deliveryOrder.error
      );
    }
    return deliveryOrder;
  } catch (err) {
    console.error(
      `LYFT INTEGRATION: error getting delivery order ${orderId} `,
      err
    );
    throw err;
  }
}

async function getDeliveryPath(db, pathId, accessToken) {
  let deliveryPathResponse;
  let deliveryResponse;

  if (!accessToken) {
    accessToken = await getAccessToken(db);
  }

  try {
    deliveryPathResponse = await makeLyftRequest(
      db,
      accessToken,
      `/paths/${pathId}`,
      "GET"
    );
  } catch (err) {
    console.error(
      `LYFT INTEGRATION: error getting delivery path ${pathId} `,
      err
    );
    throw err;
  }
  if (deliveryPathResponse.error) {
    console.error(
      `LYFT INTEGRATION: error getting delivery path ${pathId} `,
      deliveryPathResponse.error
    );
    throw new Error(deliveryPathResponse.error);
  }

  let promises = deliveryPathResponse.data.delivery_order_ids.map(
    async (orderId) => {
      deliveryResponse = await getDeliveryOrder(db, orderId, accessToken);
      if (deliveryResponse.error) {
        console.log(
          `LYFT INTEGRATION: error getting delivery ${deliveryResponse.error} `,
          ` statusCode=${deliveryResponse.statusCode}`
        );
        return null;
      } else {
        return deliveryResponse.data;
      }
    }
  );

  const deliveryOrders = await Promise.all(promises);

  return deliveryOrders;
}

// Function to create all requests asap every 5 mins.
// We will pull waiting Lyft requests and batch them
async function createLyftRequests(db) {
  // we run this every 5 minutes but add a buffer
  let startTime = moment().add(10, "minutes").valueOf();
  let requests = await db
    // load open lyft requests
    // we want a different status here to differentiate the 2 types so they're fast...
    .collection("requests")
    .where("toBeFulfilledBy", "==", "LYFT")
    .where("status", "in", ["open", "asap_fulfillment"])
    .where("scheduledPickupTime", "<=", startTime)
    .get();

  if (requests.empty) {
    console.log(`No open Lyft requests`);
    return;
  }

  console.log(`Total of ${requests.size} open Lyft requests`);

  // Group requests by supplier
  const requestsGroups = new Map();
  requests.forEach((requestDoc) => {
    const supplierId = requestDoc.get("supplier");
    if (!requestsGroups.has(supplierId)) {
      requestsGroups.set(supplierId, []);
    }
    requestsGroups.get(supplierId).push(requestDoc);
  });
  // For each group, call batching algorithm and createDeliveryPath
  const MAX_REQUESTS = 50;
  for (let [supplierId, requestDocs] of requestsGroups) {
    // Limit each supplier to MAX_REQUESTS deliveries at a time
    if (requestDocs.length > MAX_REQUESTS) {
      requestDocs = requestDocs.slice(0, MAX_REQUESTS);
    }
    const supplierSnapshot = await db
      .collection("suppliers")
      .doc(supplierId)
      .get();

    const batches = getDeliveryBatches(
      supplierSnapshot,
      requestDocs,
      LYFT_BATCH_SIZE
    ); // slow call O(N2)
    console.log(
      `Generated ${batches.length} batches for ${requestDocs.length} requests from the supplier ${supplierId}`
    );
    for (const orderedRequests of batches) {
      console.log(
        `Requests: ${orderedRequests.reduce(
          (accum, req) => `${accum}${req.id} `,
          ""
        )}`
      );
      try {
        const pathId = await createDeliveryPath(
          db,
          supplierSnapshot,
          orderedRequests
        );
        console.log(`Completed batch Lyft path ID: ${pathId}`);
      } catch (err) {
        console.error(err);
        console.error(`Failed batch for Lyft`);
      }
    }
  }
}

async function cancelLyftTrip(db, data) {
  // TODO no orgId passed here...
  let requestRef = db.collection("requests").doc(data.requestId);

  let [orderSnapshot, request] = await Promise.all([
    db
      .collection("lyft_orders")
      .where("requestId", "==", data.requestId)
      .where("orderStatus", "==", "ACTIVE")
      .get(),
    requestRef.get(),
  ]);

  let retryRef =
    request.data().lyftRetries > 0
      ? requestRef
          .collection("retries")
          .doc(data.requestId + ":" + request.data().lyftRetries)
      : null;

  let newRequestData = {
    status: "closed",
    outcome: "cancelled",
    timeClosed: new Date(),
    lyftStatus: "CANCELLED", // not a valid status from lyft's side but that's fine
  };

  if (orderSnapshot.size !== 1) {
    let lyftStatus = request.data().lyftStatus;
    // only allowed to cancel when there's no orders if it hasn't been requested
    // TODO we could end up having a timing issue here where we try to cancel before the job runs
    // to create the trip
    if (orderSnapshot.size !== 0 && lyftStatus !== "TO_BE_SCHEDULED") {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "not a valid request"
      );
    }
    // no lyft order so no need to go to lyft.

    if (retryRef) {
      await retryRef.update(newRequestData);
    }

    return await requestRef.update(newRequestData);
  }

  let orderRef = orderSnapshot.docs[0].ref;
  let order = orderSnapshot.docs[0].data();
  let lyftOrderId = order.orderId;

  let accessToken = await getAccessToken(db);
  if (!accessToken) {
    return null;
  }

  let cancelResponse;
  try {
    cancelResponse = await makeLyftRequest(
      db,
      accessToken,
      `/orders/${lyftOrderId}/cancel`,
      "POST",
      ""
    );
  } catch (err) {
    console.error(`LYFT INTEGRATION: error cancelling ${lyftOrderId} `, err);
    throw err;
  }

  // only acceptable error is 404 if trip is not found
  if (cancelResponse.error && cancelResponse.statusCode !== 404) {
    console.error(
      `LYFT INTEGRATION: Lyft returned error cancelling ${lyftOrderId} `,
      JSON.stringify(cancelResponse, null, 3)
    );
    throw new functions.https.HttpsError(
      "internal",
      `error canceling lyft request: ${JSON.stringify(cancelResponse, null, 3)}`
    );
  }

  let batch = db.batch();
  batch.update(requestRef, newRequestData);

  if (retryRef) {
    batch.update(retryRef, newRequestData);
  }
  // so we no longer try to get status on our end
  batch.update(orderRef, {
    orderStatus: "CANCELLED",
    lyftStatus: "CANCELLED",
  });
  return await batch.commit();
}

async function getPathIdFromRequestId(db, requestId) {
  const lyftOrder = await db
    .collection("lyft_orders")
    .where("requestId", "==", requestId)
    .limit(1)
    .get();
  try {
    return lyftOrder.docs[0].data().lyftPathId;
  } catch (err) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "No valid Lyft Path id, probably you need to wait a few minutes"
    );
  }
}

async function cancelLyftPath(db, data) {
  let pathId = null;
  try {
    pathId = await getPathIdFromRequestId(db, data.requestId);
  } catch (err) {
    // No Lyft Path. Not yet sent to Lyft
    // Just cancel request on our end

    return await db.collection("requests").doc(data.requestId).set({
      status: "closed",
      outcome: "cancelled",
      timeClosed: new Date(),
      lyftStatus: "CANCELLED", // not a valid status from lyft's side but that's fine
    });
  }

  // Cancel path with Lyft
  let accessToken = await getAccessToken(db);
  if (!accessToken) {
    return null;
  }

  let cancelResponse;
  try {
    cancelResponse = await makeLyftRequest(
      db,
      accessToken,
      `/path/${pathId}/cancel`,
      "POST",
      ""
    );
  } catch (err) {
    console.error(`LYFT INTEGRATION: error cancelling path ${pathId} `, err);
    throw err;
  }

  if (cancelResponse.error) {
    console.error(
      `LYFT INTEGRATION: Lyft returned error cancelling path ${pathId} `,
      JSON.stringify(cancelResponse, null, 3)
    );
    throw new Error(
      `LYFT INTEGRATION: Lyft returned error cancelling path ${pathId}: ${JSON.stringify(
        cancelResponse,
        null,
        3
      )}`
    );
  }

  let batch = db.batch();

  let orderSnapshot = await db
    .collection("lyft_orders")
    .where("lyftPathId", "==", pathId)
    .get();

  if (orderSnapshot.empty) {
    console.log(`No Lyft orders found for path`);
    return null;
  }

  let requestRefs = [];
  orderSnapshot.forEach((orderDoc) => {
    let orderRef = orderDoc.ref;
    let order = orderDoc.data();

    batch.update(orderRef, {
      orderStatus: "CANCELLED",
      lyftStatus: "CANCELLED",
    });

    let requestId = order.requestId;
    requestRefs.push(db.collection("requests").doc(requestId));
  });

  let newRequestData = {
    status: "closed",
    outcome: "cancelled",
    timeClosed: new Date(),
    lyftStatus: "CANCELLED", // not a valid status from lyft's side but that's fine
  };

  for (let requestRef of requestRefs) {
    let request = await requestRef.get();
    let retryRef =
      request.data().lyftRetries > 0
        ? requestRef
            .collection("retries")
            .doc(request.id + ":" + request.data().lyftRetries)
        : null;

    batch.update(requestRef, newRequestData);

    if (retryRef) {
      batch.update(retryRef, newRequestData);
    }
  }

  // so we no longer try to get status on our end
  return batch.commit();
}

async function getLyftOrderData(db, data) {
  console.log(data.requestId);
  const pathId = await getPathIdFromRequestId(db, data.requestId);
  const path = await getDeliveryPath(db, pathId);
  return path;
}

module.exports = {
  createLyftRequests,
  getAccessToken,
  getAndSaveAccessToken,
  makeLyftRequest,
  createDeliveryPath,
  getDeliveryOrder,
  getDeliveryPath,
  cancelLyftTrip,
  cancelLyftPath,
  getLyftOrderData,
};
