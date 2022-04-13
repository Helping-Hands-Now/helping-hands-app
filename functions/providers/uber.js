const rp = require("request-promise");
const url = require("url");
var functions = require("firebase-functions"); // Need to initialize this no matter what
const moment = require("moment");

const { cancelLyftPath } = require("./lyft");

var { verifyUserCanEditOrg } = require("./../organizations");

let { validateAddress } = require("./../address");
const { sendSlackMessage } = require("../bots");
const { saveCourierTrips } = require("./courier");

const crypto = require("crypto");

const LOGIN_ENDPOINT = "https://login.uber.com/oauth/v2/token";
const UBER_ENDPOINT = "https://api.uber.com/v1/eats/deliveries";
const CANCEL_ENDPOINT = "https://api.uber.com/v1/eats/orders";

const CLIENT_ID = functions.config().uber.client_id;
const CLIENT_SECRET = functions.config().uber.client_secret;

// we're limited to 500 max writes in a batch and we know we have at least create estimate, create order, update request for each order
// so need to limit the number we try to do at a given time

const MAX_REQUESTS = 50;
const MAX_UBER_RETRIES = 2;
const UBER_RETRIES_ENABLED = false;

// 2 hours
const SCHEDULED_TIMEOUT = 2 * 60 * 60 * 1000;
const STATUS_TRIP_BUCKETS = 250;

// 90 minutes
const NINETY_MINUTES = 90 * 60 * 1000;

async function getAccessToken(db) {
  let snapshot = await db
    .collection("uber_tokens")
    .orderBy("timeCreated", "desc")
    .limit(1)
    .get();

  // first time! created
  if (snapshot.size !== 1) {
    return await getAndSaveAccessToken(db);
  }
  return snapshot.docs[0].data().token;
}

async function getAndSaveAccessToken(db) {
  let result = await getAccessTokenFromUber();
  if (!result) {
    throw new Error("error getting new access token from uber");
  }

  await db.collection("uber_tokens").add({
    token: result.accessToken,
    timeCreated: new Date(),
    expiresIn: result.expiresIn,
  });
  return result.accessToken;
}

function getAccessTokenFromUber() {
  var endpoint = new url.URL(LOGIN_ENDPOINT);
  endpoint.search = new url.URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    grant_type: "client_credentials",
    scope: "eats.deliveries eats.store.orders.cancel",
  });

  let options = {
    method: "POST",
    uri: endpoint.toString(),
    json: true,
  };
  return rp(options)
    .then((res) => {
      return {
        accessToken: res.access_token,
        expiresIn: res.expires_in,
      };
    })
    .catch((err) => {
      console.error("error getting an access token from uber", err);
    });
}

async function makeUberRequest(uberData, relPath, method, params, callback) {
  let accessToken = uberData.accessToken;
  let uri = uberData.endpoint || UBER_ENDPOINT;
  let endpoint = new url.URL(uri + relPath);
  if (method === "GET") {
    endpoint.search = new url.URLSearchParams(params);
  }
  let options = {
    method: method,
    url: endpoint.toString(),
    headers: {
      Authorization: "Bearer " + accessToken,
      "Content-Type": "application/json",
    },
    json: true,
  };
  if (method === "POST") {
    options.body = params;
  }
  try {
    let res = await rp(options);
    return { data: callback(res) };
  } catch (err) {
    if (err.statusCode !== 401) {
      //so we want to check 500 errors happened and alert them. We also want to check for non 401 errors when creating uber orders and uber estimates.
      // That is why we compare with the relpath of uberRequest to check if it came from /orders or /estimates.

      if (
        err.statusCode === 500 ||
        relPath === "/orders" ||
        relPath === "/estimates"
      ) {
        //we only want this to get triggered on prod and not dev
        const firebaseProjectId = functions.config().gcp.project_id;

        if (firebaseProjectId === "helping-hands-community") {
          const enterprisebotwebhook = functions.config().enterprisebotwebhook
            .url;

          let id = params.external_order_id
            ? ". \n*External order id*: " + params.external_order_id + ". \n\n"
            : ". \n\n";

          let message =
            "*UBER INTEGRATION: error making a request to uber API at " +
            relPath +
            "*" +
            id +
            "```" +
            err.message +
            "``` \n *Params*: ```" +
            JSON.stringify(params, null, 2) +
            "```";

          try {
            sendSlackMessage(enterprisebotwebhook, message);
          } catch (error) {
            console.log(error);
          }
        }
      }

      console.error(
        "UBER INTEGRATION: error making a request to uber API at " + relPath,
        err.message + "\n \n Params: " + JSON.stringify(params, null, 3)
      );
      return {
        error: err,
      };
    }

    let error = err.error;
    // invalid token, let's try and get a new access token
    if (
      error &&
      (error.code === "unauthorized" || error.error === "invalid_token")
    ) {
      // get a new token. this throws if not...
      let token;
      try {
        token = await getAndSaveAccessToken(uberData.db);
        // update the token. js is pass by reference for objects so this works great
        uberData.accessToken = token;
      } catch (err2) {
        console.error(
          "UBER INTEGRATION: error trying to get a new access token after previous token error",
          err2.message
        );
        return { error: err2 };
      }

      // try request again with new token!
      options.headers.Authorization = "Bearer " + token;
      try {
        let res = await rp(options);
        return { data: callback(res) };
      } catch (err2) {
        return console.error(
          "UBER INTEGRATION: error making a request to uber API at " +
            relPath +
            " even with new token",
          err2.message
        );
      }
    } else {
      console.error(
        "UBER INTEGRATION: error making a request to uber API at " +
          relPath +
          " with unexpected 401 error code"
      );
      return {
        error: err,
      };
    }
  }
}

function findDeliverableStore(uberData, supplier) {
  if (supplier.uberStoreId) {
    // to be consistent if we go to the API
    return { data: supplier.uberStoreId };
  }

  if (!supplier.placeId) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "cannot get a store id if supplier doesn't have a google place id."
    );
  }
  return makeUberRequest(
    uberData,
    "/stores",
    "GET",
    {
      place_id: supplier.placeId,
      place_provider: "google_places",
    },
    (res) => {
      let stores = res.stores;
      if (!stores.length) {
        return console.error("could not get a store id for place id");
      }
      // let's just take the first one
      let storeId = stores[0].store_id;

      return storeId;
    }
  );
}

function getTimeForASAPRequest() {
  // request from uber is to return 0
  return 0;
}

function getTimeForASAPRequestInMs() {
  return moment().valueOf();
}

function getDeliveryTime(request, uberData) {
  // meaning ASAP
  if (uberData.now) {
    return getTimeForASAPRequest();
  }

  // override the scheduledPickupTime
  if (uberData.scheduledPickupTime) {
    return uberData.scheduledPickupTime;
  }
  const now = new Date();

  if (request.scheduledPickupTime) {
    if (request.scheduledPickupTime < now) {
      console.log(
        "UBER INTEGRATION: request with scheduled pickup time in past. sending 0 for ASAP"
      );
      return getTimeForASAPRequest();
    }
    return request.scheduledPickupTime;
  }
  // tomorrow at 9am PST
  // TODO: eventually throw here because it means something bad happened since this should no longer be an option
  console.error("UBER INTEGRATION: request with no scheduledPickupTime");

  return moment()
    .utcOffset("-7")
    .add(1, "days")
    .set({ hour: 9, minute: 0, seconds: 0, milliseconds: 0 })
    .valueOf();
}

async function createDeliveryEstimate(uberData, request, supplier, recipient) {
  // request probably has enough information
  if (!supplier.uberStoreId) {
    return console.error(
      "UBER INTEGRATION: cannot create a delivery estimate with no uber store id"
    );
  }

  let updateRecipientInfo = null;
  if (!recipient.placeId) {
    let googleMaps = null;
    let googleMapsClient = null;

    try {
      let r = await validateAddress(recipient, googleMaps, googleMapsClient);
      recipient.geohash = r.data.geohash;
      recipient.placeId = r.data.placeId;

      updateRecipientInfo = {
        geohash: recipient.geohash,
        placeId: recipient.placeId,
      };
    } catch (e) {
      // invalid address
      console.error(
        "UBER INTEGRATION. No recipient id and tried getting one. didn't work",
        e.message
      );

      // save invalid address here
      // we're saving immediately because the flow doesn't work well if we try and batch with a failure
      // TODO: we probably have a dangling request that needs to be addressed
      await uberData.db.collection("users").doc(recipient.id).update({
        placeId: "INVALID_ADDRESS",
      });

      return console.error(
        "UBER INTEGRATION: cannot create a delivery estimate with no recipient place id"
      );
    }
  } else if (recipient.placeId === "INVALID_ADDRESS") {
    return console.error(
      "UBER INTEGRATION: cannot create a delivery estimate with a recipient with an invalid address"
    );
  }

  return makeUberRequest(
    uberData,
    "/estimates",
    "POST",
    {
      pickup: {
        store_id: supplier.uberStoreId,
      },
      dropoff_address: {
        place: {
          id: recipient.placeId,
          provider: "google_places",
        },
      },
      pickup_times: [getDeliveryTime(request, uberData)],
    },
    (res) => {
      if (!res.estimates) {
        return console.error("could not get an estimate for this trip");
      }
      let estimate = res.estimates[0];
      let estimate_id = res.estimate_id;

      return {
        estimateId: estimate_id,
        deliveryInfo: {
          estimateId: estimate_id,

          // total: 400, currency_code: USD, line_items: [{fee_code:FLAT_FEE, value: 400}]
          deliveryFee: estimate.delivery_fee,
          requestId: request.id,
        },
        updateRecipientInfo,
      };
    }
  );
}

function createDelivery(uberData, request, supplier, recipient, estimateId) {
  var id =
    request.uberRetries > 0
      ? request.id + ":" + request.uberRetries
      : request.id;
  var retries = request.uberRetries || 0;

  return makeUberRequest(
    uberData,
    "/orders",
    "POST",
    {
      external_order_id: id,
      order_value: 1500, // $15
      currency_code: "USD",
      order_items: [
        {
          // TODO we probably want to describe this better
          name: "food bank item",
          description: "food bank item",
          external_id: id, // we don't have a different id for external id
          quantity: parseInt(recipient.numRecipients, 10) || 1, // quantity changes based on how many people are on the recipient side of things
          price: 1500,
          currency_code: "USD",
        },
      ],
      pickup: {
        store_id: supplier.uberStoreId,
        external_store_id: supplier.id,
        instructions:
          supplier.pickupInstructions ||
          // TODO once we have multiple organizations this doesn't work....
          "Look for a Uber Grocery Pickup sign and pick up a Wider Circle food donation",
      },
      dropoff: {
        address: {
          // needs to be a string
          apt_floor_suite: recipient.apartment
            ? `${recipient.apartment}`
            : null,
          place: {
            id: recipient.placeId,
            provider: "google_places",
          },
        },
        contact: {
          first_name: recipient.firstName,
          last_name: recipient.lastName,
          email: "",
          phone: recipient.phoneNumber,
        },
        type: "LEAVE_AT_DOOR",
        instructions:
          recipient.dropoffInstructions ||
          "Call the recipient to let them know you’ve arrived",
      },
      pickup_at: getDeliveryTime(request, uberData),
      estimate_id: estimateId,
      courier_tip: 0, // request from uber. tip is included in the base fare. see #285
      external_user_id: request.recipient.id,
    },
    (res) => {
      return {
        orderId: res.order_id,
        orderInfo: {
          estimateId: estimateId,
          requestId: request.id,
          orderId: res.order_id,
          fullFee: res.full_fee,
          orderStatus: res.order_status || "ACTIVE",
          uberRetries: retries,
          // it may be confusing when looking at this data later?
          // storing 0 meant itwas scheduled for ASAP at the time of creation
          // check request status if we care
          pickupTime: getDeliveryTime(request, uberData),
        },
      };
    }
  );
}

// Function to create all requests asap every 5 mins.
async function createUberRequests(db) {
  // we run this every 5 minutes but add a buffer
  let startTime = moment().add(10, "minutes").valueOf();
  return await createRequestsImpl(
    db,
    db
      // load open uber requests
      // we want a different status here to differentiate the 2 types so they're fast...
      .collection("requests")
      .where("toBeFulfilledBy", "==", "UBER")
      .where("status", "in", ["open", "asap_fulfillment"])
      .where("scheduledPickupTime", "<=", startTime)
      // we still want the MAX_REQUESTS buffer incase there's a lot
      // we just have to wait till the next buffer in our system
      .limit(MAX_REQUESTS)
      .get(),
    {
      now: true, // create these as ASAP requests
    }
  );
}

async function createUberRequestsImmediately(db, requestIds) {
  // if we have more than max requests, we'll just schedule for the next time (in 5 minutes) and it won't necessarily
  // be as quickly as possible
  if (requestIds.length > MAX_REQUESTS) {
    requestIds = requestIds.slice(0, MAX_REQUESTS);
    console.log(
      "UBER INTEGRATION: limiting the number of requests happening now to ",
      MAX_REQUESTS
    );
  }
  let refs = requestIds.map((requestId) =>
    db.collection("requests").doc(requestId)
  );
  // load requests by id (just created requests)
  return createRequestsImpl(db, db.getAll(...refs), { now: true });
}

async function createRequestsImpl(db, requestSnapshot, options) {
  var { loadRequestData } = require("./../requests");

  options = options || {};
  const requests = await loadRequestData(db, requestSnapshot);

  // nothing to do here
  if (!requests.length) {
    return [];
  }

  let accessToken = await getAccessToken(db);
  if (!accessToken) {
    return [];
  }

  let uberData = {
    db,
    accessToken,
    scheduledPickupTime: options.scheduledPickupTime,
    now: options.now,
  };

  let batch = db.batch();
  // if there was an error creating the request, we should just fail the trip as opposed
  // to having trips hanging forever and clogging up the system
  const failTrip = (requestRef, retryRef, error) => {
    let requestData = {
      status: "closed",
      uberStatus: "FAILED", // technically it should be never created but that's fine
      outcome: "error_creating", // seems like new outcome here makes sense
      timeClosed: new Date(),
    };
    if (error && error.message) {
      requestData.uberFailureError = error.message;
    }

    batch.update(requestRef, requestData);

    if (retryRef) {
      batch.update(retryRef, requestData);
    }
  };
  let promises = requests.map(async (request) => {
    // we wrap this entire piece in a try-catch so that if anything
    // fails for a single trip, we still continue to process and update
    // the ones that did succeed.

    try {
      const requestRef = db.collection("requests").doc(request.id);
      let retryRef =
        request.uberRetries > 0
          ? requestRef
              .collection("retries")
              .doc(request.id + ":" + request.uberRetries)
          : null;

      let supplier = request.supplier;
      if (!supplier) {
        console.error("request to be sent to uber with no supplier");
        return failTrip(requestRef, retryRef);
      }
      let recipient = request.recipient;
      if (!recipient) {
        console.error("request to be sent to uber with no recipient");
        return failTrip(requestRef, retryRef);
      }
      let storeResult = await findDeliverableStore(uberData, supplier);
      let storeId = null;
      if (storeResult) {
        storeId = storeResult.data.trim();
      }

      if (!storeResult || storeResult.error || !storeId) {
        console.error(
          `UBER INTEGRATION: couldn't get a deliverable store for supplier ${supplier.id}`
        );
        return failTrip(
          requestRef,
          retryRef,
          (storeResult && storeResult.error) || "No valid supplier ID"
        );
      }
      if (!supplier.uberStoreId) {
        // if we didn't have a storeId before, schedule to save.
        const supplierRef = db.collection("suppliers").doc(supplier.id);
        batch.update(supplierRef, {
          uberStoreId: storeId,
        });
        console.log(
          `UBER INTEGRATION: got new store id ${storeId} for supplier ${supplier.id}`
        );
      }
      // put this in the object for all the other changes needed
      supplier.uberStoreId = storeId;

      let estimateResult = await createDeliveryEstimate(
        uberData,
        request,
        supplier,
        recipient
      );

      if (!estimateResult || estimateResult.error) {
        console.error(
          `UBER INTEGRATION: error creating an estimate for the uber delivery for request ${request.id}`
        );
        // [Note, kelsey] on 08/13/2021 we had a bug where the estimateResult was empty
        // so calling estimateResult.error caused the function to exit early, which had
        // really bad side effects of creating duplicate uber rides on every cron run,
        // because this function never made it to completion at the end where the DB status
        // is updated for the other trips that made progress before the one that failed here.
        let estimateErrorMessage = !estimateResult
          ? "Error creating estimate. estimateResult is empty"
          : estimateResult.error;
        return failTrip(requestRef, retryRef, estimateErrorMessage);
      }
      let estimate = estimateResult.data;
      console.log(
        `UBER INTEGRATION: got estimate id ${estimate.estimateId} for request ${request.id}`
      );

      let deliveryResult = await createDelivery(
        uberData,
        request,
        supplier,
        recipient,
        estimate.estimateId
      );

      if (!deliveryResult || deliveryResult.error) {
        console.error(
          `UBER INTEGRATION: error creating delivery for the uber integration for request ${request.id}`
        );
        // see [Note, kelsey] on 08/13/2021 above about potential empty estimateResult. we
        // apply the same safety net here.
        let deliveryErrorMessage = !deliveryResult
          ? "Error creating delivery. deliveryResult is empty"
          : deliveryResult.error;
        return failTrip(requestRef, retryRef, deliveryErrorMessage);
      }
      let delivery = deliveryResult.data;
      console.log(
        `UBER INTEGRATION: got order id ${delivery.orderId} for request ${request.id}`
      );

      if (estimate.updateRecipientInfo) {
        // if we have to update the recipient to get the placeId, do it now
        batch.update(
          db.collection("users").doc(recipient.id),
          estimate.updateRecipientInfo
        );
      }

      // store the estimate info
      let estimateRef = db.collection("uber_estimates").doc();
      batch.create(estimateRef, estimate.deliveryInfo);

      let orderRef = db.collection("uber_orders").doc();
      batch.create(orderRef, delivery.orderInfo);

      // update the status of the request to pending fulfillment
      // also update uberStatus
      batch.update(requestRef, {
        uberStatus: "ACTIVE", // let's start with active to be consistent with what the API returns
        status: "pending_fulfillment",
      });

      if (retryRef) {
        batch.update(retryRef, {
          uberStatus: "ACTIVE", // let's start with active to be consistent with what the API returns
          status: "pending_fulfillment",
        });
      }
    } catch (error) {
      // see [Note, kelsey] on 08/13/2021 above about potential early function exit.
      // we apply an extra safety net here.
      console.error(
        `Error was raised for request ${request.id}: ${error}. Logging error and continuing with other requests.`
      );
    }
  });

  await Promise.all(promises);
  // make all the changes
  // if this fails, we have dangling trips which isn't good. we have to check the logs and reconcile...
  return batch.commit().catch((err) => {
    console.error(
      "error doing batch commit when creating uber request. uh oh",
      err
    );
  });
}

async function checkUberOrderStatuses(db, context) {
  let now = moment().valueOf();
  // only do this for orders that have started e.g. don't do this for future scheduled orders
  let orderSnapshot = await db
    .collection("uber_orders")
    .where("orderStatus", "==", "ACTIVE")
    .where("pickupTime", "<", now)
    .get();

  if (!orderSnapshot.size) {
    return null;
  }
  let accessToken = await getAccessToken(db);
  if (!accessToken) {
    return null;
  }
  let uberData = {
    db,
    accessToken,
  };

  let docs = orderSnapshot.docs.map((doc) => doc);

  const times = Math.ceil(orderSnapshot.size / STATUS_TRIP_BUCKETS);

  let pos = 0;
  for (let i = 0; i < times; i++) {
    const currentDocs = docs.slice(pos, pos + STATUS_TRIP_BUCKETS);
    /* eslint-disable no-await-in-loop */
    await checkUberOrderStatusesImpl(db, uberData, currentDocs);
    /* eslint-enable no-await-in-loop*/
    pos += STATUS_TRIP_BUCKETS;
  }
}

async function requestUberStatusChecks(docChunk, uberData, db) {
  let batch = db.batch();
  let promises = docChunk.map(async (orderSnapshot) =>
    updateUberStatus(orderSnapshot, uberData, db, batch)
  );
  await Promise.all(promises);
  return batch.commit().catch((err) => {
    console.error(
      "error doing batch commit when creating uber request. uh oh",
      err
    );
  });
}

async function updateUberStatus(orderSnapshot, uberData, db, batch) {
  let orderId = orderSnapshot.id;
  let orderData = orderSnapshot.data();

  let uberOrderId = orderData.orderId;

  let requestRef = db.collection("requests").doc(orderData.requestId);

  let retryRef =
    orderData.uberRetries > 0
      ? requestRef
          .collection("retries")
          .doc(orderData.requestId + ":" + orderData.uberRetries)
      : null;

  let uberOrderResult = await makeUberRequest(
    uberData,
    `/orders/${uberOrderId}`,
    "GET",
    {},
    (res) => {
      return res;
    }
  );
  if (!uberOrderResult || uberOrderResult.error) {
    if (uberOrderResult.error && uberOrderResult.error.statusCode === 404) {
      let requestSnapshot = await db
        .collection("requests")
        .doc(orderData.requestId)
        .get();
      let requestData = requestSnapshot.data();
      if (
        requestData.uberStatus === "SCHEDULED" &&
        requestData.scheduledPickupTime &&
        requestData.scheduledPickupTime - now > SCHEDULED_TIMEOUT
      ) {
        // fail trip for timing out

        batch.update(requestRef, {
          status: "closed",
          uberStatus: "FAILED",
          outcome: "timed_out",
          timeClosed: new Date(),
        });

        if (retryRef) {
          batch.update(requestRef, {
            status: "closed",
            uberStatus: "FAILED",
            outcome: "timed_out",
            timeClosed: new Date(),
          });
        }

        console.log(
          `UBER INTERGRATION: closing uber order ${uberOrderId} for timing out`
        );
      }
    }

    console.error(`UBER INTEGRATION: error loading uber order ${uberOrderId}`);
    return;
  }
  let uberOrder = uberOrderResult.data;
  let orderStatus = uberOrder.order_status;
  if (!orderStatus) {
    // nothing to do here
    return;
  }
  await saveCourierTrips(db, orderId, batch, uberOrder);
  let uberStatus = orderStatus;
  // ACTIVE | COMPLETED | FAILED
  let updatedOrderData = {
    orderStatus,
  };
  // TO_BE_SCHEDULED (pre-schedule) | ACTIVE | COMPLETED | FAILED | SCHEDULED | EN_ROUTE_TO_PICKUP | ARRIVED_AT_PICKUP | ARRIVED_AT_DROPOFF
  let requestData = {
    uberStatus: uberStatus,
  };
  let closeTrip = false;
  let outcome = null;
  if (orderStatus === "FAILED") {
    // if trip cannot be retried anymore or there were problems, we pass "False" to indicate the program to close this request.
    const tripRetried = await checkAndRetryUberTrip(
      db,
      uberOrder,
      orderData.requestId
    );
    if (tripRetried === false) {
      closeTrip = true;
    }

    if (
      uberOrder.courier_trips.length &&
      uberOrder.courier_trips[0].status.failure
    ) {
      // flag reason for failing
      // we've mostly seen courier cancel but there could theoretically be other reasons...

      requestData.uberFailureError =
        uberOrder.courier_trips[0].status.failure.reason_code;

      outcome = requestData.uberFailureError;

      if (requestData.uberFailureError === "COURIER_CANCEL") {
        let now = moment().valueOf();

        if (
          requestData.scheduledPickupTime &&
          requestData.scheduledPickupTime - now > NINETY_MINUTES
        ) {
          outcome = "probably_timed_out";
        }
      }
    } else {
      outcome = "failed";
    }
  } else if (orderStatus === "COMPLETED") {
    closeTrip = true;
    outcome = "completed";
  } else if (orderStatus === "ACTIVE") {
    // active and no courier trips, nothing to do here.
    if (!uberOrder.courier_trips || !uberOrder.courier_trips.length) {
      return;
    }

    // update uber trip status as this changes
    // e.g. as it updates from SCHEDULED -> EN_ROUTE_TO_PICKUP -> ARRIVED_AT_PICKUP -> ARRIVED_AT_DROPOFF
    // we get COMPLETED from orderStatus anyways...
    uberStatus = uberOrder.courier_trips[0].status.status_code;
    if (uberStatus === requestData.uberStatus) {
      // nothing to do here
      return;
    }
    let statusHistory = orderData.statusHistory || [];
    let last = statusHistory[statusHistory.length - 1];
    if (last !== uberStatus) {
      statusHistory.push(uberStatus);
      updatedOrderData.statusHistory = statusHistory;
    }

    if (uberStatus === "EN_ROUTE_TO_BATCHED_DROPOFF") {
      requestData.uberBatchedOrder = true;
    }
    // update uberStatus
    requestData.uberStatus = uberStatus;

    if (
      uberOrder.courier_trips[0].courierTripsArray &&
      uberOrder.courier_trips[0].courierTripsArray[0].contact &&
      uberOrder.courier_trips[0].courierTripsArray[0].contact.first_name &&
      uberOrder.courier_trips[0].courierTripsArray[0].contact.last_name
    ) {
      requestData.uberDriver =
        uberOrder.courier_trips[0].courierTripsArray[0].contact.first_name +
        " " +
        uberOrder.courier_trips[0].courierTripsArray[0].contact.last_name;
    }
    // save tracking url if we have it
    if (!requestData.uberTrackingURL && uberOrder.order_tracking_url) {
      requestData.uberTrackingURL = uberOrder.order_tracking_url;
    }
  } else {
    console.error("UBER INTEGRATION: unexpected order status returned");
    return;
  }
  let orderRef = db.collection("uber_orders").doc(orderId);
  batch.update(orderRef, updatedOrderData);

  if (closeTrip) {
    requestData = {
      ...requestData,
      status: "closed",
      outcome: outcome,
      timeClosed: new Date(),
    };
  }

  batch.update(requestRef, requestData);

  if (retryRef) {
    batch.update(retryRef, requestData);
  }
  return;
}

async function checkUberOrderStatusesImpl(db, uberData, docs) {
  var docChunks = [];
  var chunk = 100;

  for (i = 0; i < docs.length; i += chunk) {
    let temparray = docs.slice(i, i + chunk);
    docChunks.push(temparray);
  }

  console.log("DOCS LENGTH: " + docs.length);
  console.log("DOC CHUNKS: " + docChunks.length);

  for (i = 0; i < docChunks.length; i++) {
    await requestUberStatusChecks(docChunks[i], uberData, db);
  }
  return;
}

async function handleUberWebhook(db, req, res) {
  const signature = req.get("X-Uber-Signature");
  if (!signature) {
    console.error("Signature missing");
    return res.sendStatus(403);
  } else {
    const digest = crypto
      .createHmac("sha256", CLIENT_SECRET)
      .update(req.rawBody)
      .digest("hex");
    if (digest !== signature) {
      console.error("Signature mismatch");
      return res.sendStatus(403);
    }
  }

  console.log("X-Environment:" + req.get("X-Environment"));
  console.log("req.body:" + JSON.stringify(req.body));

  const prefix = UBER_ENDPOINT + "/orders/";
  const orderId = req.body.resource_href.substr(prefix.length);

  if (!orderId) {
    return res.status(404).send("orderId not found:" + req.body.resource_href);
  }

  let orderSnapshot = await db
    .collection("uber_orders")
    .where("orderId", "==", orderId)
    .get();

  if (!orderSnapshot.size) {
    return res.status(404).send("order not found:" + orderId);
  }

  if (orderSnapshot.docs[0].data().orderStatus !== "ACTIVE") {
    return res.status(200).send();
  }

  let accessToken = await getAccessToken(db);
  if (!accessToken) {
    return res.status(403).send("access token not found");
  }
  let uberData = {
    db,
    accessToken,
  };

  let batch = db.batch();
  await updateUberStatus(orderSnapshot.docs[0], uberData, db, batch);
  await batch.commit();

  return res.status(200).send();
}

async function checkAndRetryUberTrip(db, uberOrder, requestId) {
  // TODO do we still need a per-pickup location/per-day way of disabling this
  // e.g. when we know there's no one else waiting at the location
  if (
    !UBER_RETRIES_ENABLED ||
    // TODO can't really test these until we go live because we don't have
    // accessible test data with these characteristics
    // orders in the test store just eventually fail but don't go through the normal flow
    uberOrder.order_status !== "FAILED" ||
    !uberOrder.courier_trips.length ||
    !uberOrder.courier_trips[0].status.failure ||
    uberOrder.courier_trips[0].status.failure.reason_code !== "COURIER_CANCEL"
  ) {
    return false;
  }
  const requestRef = db.collection("requests").doc(requestId);
  const [requestSnapshot, previousRequestsSnapshot] = await Promise.all([
    requestRef.get(),
    db.collection("requests").where("previousRequestId", "==", requestId).get(),
  ]);

  let deliveryEvent = null;
  if (data.deliveryEvent) {
    let snapshot = await db
      .collection("delivery_events")
      .doc(data.deliveryEvent)
      .get();

    deliveryEvent = snapshot.data();
    let now = moment().valueOf();

    // don't retry if we've set an end time for the deliveryEvent that's in the past
    if (deliveryEvent.endTime !== null && deliveryEvent.endTime < now) {
      return false;
    }
  }

  // this should no longer be needed. kill it
  if (previousRequestsSnapshot.size > 0) {
    // we should have a linked list type thing where each trip knows the previous one
    // so if we need to try for more than one time, we need to be retrying A -> B -> C
    // not A -> C
    console.log(
      `UBER INTEGRATION: not retrying request ${requestId} because it's been already retried`
    );
    return false;
  }
  const data = requestSnapshot.data();
  const retries = data.uberRetries || 0;
  if (retries >= MAX_UBER_RETRIES) {
    // already retried max times. nothing to do here
    console.log(
      `UBER INTEGRATION: max retries reached for request: ${requestId}`
    );
    return false;
  }

  console.log(`UBER INTEGRATION: retrying trip with request ${requestId}`);

  data.uberRetries = retries + 1;

  var tempScheduledPickupTime = moment().add(5, "minutes").valueOf();

  var newRetryObject = {
    scheduledPickupTime: tempScheduledPickupTime,
    retryAttempt: data.uberRetries,
    timeCreated: new Date(),
    autoRetry: true,
  };

  const retryResult = await requestRef
    .collection("retries")
    .doc(requestId + ":" + data.uberRetries)
    .set(newRetryObject);

  const updateRequest = await requestRef.update({
    uberRetries: data.uberRetries,
  });

  // ok "reloading" because we need to fetch all this extra data like supplier info, recipient info etc
  const result = await createRequestsImpl(db, db.getAll(requestRef), {
    scheduledPickupTime: tempScheduledPickupTime,
  });

  return true;
}

async function markTripAsResubmitted(db, data) {
  const requestRef = db.collection("requests").doc(data.requestId);
  const res = await requestRef.update({ resubmitted: true });
}

async function cancelUberTrip(db, data) {
  // TODO no orgId passed here...
  let requestRef = db.collection("requests").doc(data.requestId);

  let [orderSnapshot, request] = await Promise.all([
    db.collection("uber_orders").where("requestId", "==", data.requestId).get(),
    requestRef.get(),
  ]);

  let retryRef =
    request.data().uberRetries > 0
      ? requestRef
          .collection("retries")
          .doc(data.requestId + ":" + request.data().uberRetries)
      : null;

  let newRequestData = {
    status: "closed",
    outcome: "cancelled",
    timeClosed: new Date(),
    uberStatus: "CANCELLED", // not a valid status from uber's side but that's fine
  };

  if (orderSnapshot.size !== 1) {
    let uberStatus = request.data().uberStatus;
    // only allowed to cancel when there's no orders if it hasn't been requested
    // TODO we could end up having a timing issue here where we try to cancel before the job runs
    // to create the trip
    if (uberStatus !== "TO_BE_SCHEDULED") {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "not a valid request"
      );
    }
    // no uber order so no need to go to Uber.

    if (retryRef) {
      retryRef.update(newRequestData);
    }

    return requestRef.update(newRequestData);
  }

  let orderRef = orderSnapshot.docs[0].ref;
  let order = orderSnapshot.docs[0].data();
  let uberOrderId = order.orderId;

  let accessToken = await getAccessToken(db);
  if (!accessToken) {
    return null;
  }
  let uberData = { db, accessToken };
  // cancel endpoint is different
  uberData.endpoint = CANCEL_ENDPOINT;

  // don't really know what a response is here since it's never worked...
  // let
  let result = await makeUberRequest(
    uberData,
    `/${uberOrderId}/cancel`,
    "POST",
    {
      // TODO provide ui option
      reason: "OUT_OF_ITEMS",
      details: data.details || "details",
    },
    (res) => {
      return res;
    }
  );
  // only acceptable error is 404 if trip is not found
  if (!result || (result.error && result.error.statusCode !== 404)) {
    throw new functions.https.HttpsError(
      "internal",
      "error canceling uber request"
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
  });
  return batch.commit();
}

async function cancelDeliveryEvent(db, data, context) {
  await verifyUserCanEditOrg(db, context, data.orgId);

  // set endTime...
  // anytime we cancel a deliveryEvent, we update the end time so any new trips go to a new delivery event
  await db.collection("delivery_events").doc(data.deliveryEventId).update({
    endTime: moment().valueOf(),
    //    prevEndTime
  });

  // this cancels across all days if for some reason trips for a future day are scheduled.
  // we can eventually make this less scary by associating requests with the deliveryEvent so only those won't get cancelled
  let snapshot = await db
    .collection("requests")
    .where("deliveryEvent", "==", data.deliveryEventId)
    .where("status", "in", ["pending_fulfillment", "open", "asap_fulfillment"])
    .get();

  let accessToken = await getAccessToken(db);
  if (!accessToken) {
    console.log("couldn't get uber access token");
    return null;
  }
  let uberData = {
    db,
    accessToken,
  };

  // we may not have the right data
  return await snapshot.docs.map(async (doc) => {
    let requestId = doc.id;
    let uberDataForRequest = await getUberOrderImpl(db, uberData, requestId);

    let cancelTrip = false;

    if (!uberDataForRequest.length) {
      // just cancel i guess. nothing has been scheduled yet
      cancelTrip = true;
    } else {
      uberDataForRequest.forEach((uberInfo) => {
        let uberOrder = uberInfo.apiData;
        // no longer active. nothing to do here.
        if (uberOrder.order_status !== "ACTIVE") {
          return;
        }
        let uberStatus = uberOrder.courier_trips[0].status.status_code;
        // only cancel if driver hasn't picked up yet
        switch (uberStatus) {
          case "SCHEDULED":
          case "ACTIVE":
          case "EN_ROUTE_TO_PICKUP":
          case "ARRIVED_AT_PICKUP":
            cancelTrip = true;
            break;
        }
      });
    }

    if (cancelTrip) {
      // This function as a whole should not be in uber.js because cancelDeliveryEvent could contain Uber or Lyft
      if (doc.get("toBeFulfilledBy") === "LYFT") {
        console.log("Cancelling Lyft Request", doc.id);
        await cancelLyftPath(db, {
          requestId,
        });
      } else {
        console.log("Cancelling Uber Request", doc.id);
        await cancelUberTrip(db, {
          requestId,
        });
      }
    }
  });
}

async function getUberOrderData(db, data, context) {
  if (!context.auth.token.admin) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "User not an admin."
    );
  }
  let accessToken = await getAccessToken(db);
  if (!accessToken) {
    return [];
  }
  let uberData = {
    db,
    accessToken,
  };

  return getUberOrderImpl(db, uberData, data.requestId);
}

async function getUberOrderImpl(db, uberData, requestId) {
  let orderSnapshot = await db
    .collection("uber_orders")
    .where("requestId", "==", requestId)
    .get();

  if (!orderSnapshot.size) {
    return [];
  }

  return await Promise.all(
    orderSnapshot.docs.map(async (orderDoc) => {
      let data = orderDoc.data();
      let uberOrderId = data.orderId;

      let uberOrderResult = await makeUberRequest(
        uberData,
        `/orders/${uberOrderId}`,
        "GET",
        {},
        (res) => {
          return res;
        }
      );
      if (!uberOrderResult || uberOrderResult.error) {
        return null;
      }
      return {
        apiData: uberOrderResult.data,
        stausHistory: data.statusHistory || [],
      };
    })
  );
}

module.exports = {
  createUberRequests,
  checkUberOrderStatuses,
  createUberRequestsImmediately,
  markTripAsResubmitted,
  cancelUberTrip,
  getUberOrderData,
  cancelDeliveryEvent,
  handleUberWebhook,
};
