const functions = require("firebase-functions");
const crypto = require("crypto");
const util = require("util");

const { getAccessToken, makeLyftRequest, getDeliveryOrder } = require("./lyft");

// 2 hours
const SCHEDULED_TIMEOUT = 2 * 60 * 60 * 1000;
const STATUS_TRIP_BUCKETS = 250;

const VERIFICATION_TOKEN = functions.config().lyft.verification_token;
// copied from lyft.js
const LYFT_ENDPOINT = "https://api.lyft.com/v1/delivery";

async function updateDeliveryStatus(db, data) {
  const orderId = data.orderId;
  const newStatus = data.newStatus;
  const failure = data.failure;

  let accessToken = await getAccessToken(db);

  const requestBody = { status: newStatus };
  if (newStatus === "failed") {
    requestBody.failure_reason = failure || "UNKNOWN";
  }

  try {
    deliveryOrder = await makeLyftRequest(
      db,
      accessToken,
      `/sandbox/order/${orderId}`,
      "PUT",
      requestBody
    );
    if (deliveryOrder.error) {
      console.error(
        `LYFT INTEGRATION: error updating status for delivery order ${orderId} `,
        deliveryOrder.error
      );
      throw new Error(deliveryOrder.error);
    }
  } catch (err) {
    console.error(
      `LYFT INTEGRATION: error updating status for delivery order ${orderId} `,
      err
    );
    throw err;
  }
}

async function checkLyftOrderStatuses(db, context) {
  // only do this for orders that have started e.g. don't do this for future scheduled orders
  let orderSnapshot = await db
    .collection("lyft_orders")
    .where("orderStatus", "==", "ACTIVE")
    .where("pickupTime", "<", Date.now())
    .get();

  if (!orderSnapshot.size) {
    return null;
  }

  const accessToken = await getAccessToken(db);
  if (!accessToken) {
    return null;
  }

  const docs = orderSnapshot.docs.map((doc) => doc);

  const times = Math.ceil(orderSnapshot.size / STATUS_TRIP_BUCKETS);
  let pos = 0;
  for (let i = 0; i < times; i++) {
    let currentDocs = docs.slice(pos, pos + STATUS_TRIP_BUCKETS);
    /* eslint-disable no-await-in-loop */
    await checkLyftOrderStatusesImpl(db, accessToken, currentDocs);
    /* eslint-enable no-await-in-loop*/
    pos += STATUS_TRIP_BUCKETS;
  }

  return null;
}

async function checkLyftOrderStatusesImpl(db, accessToken, docs) {
  // This function uses the following naming convention to make source of data clear.
  //    lyft prefix if data directly from lyft.
  //    request prefix if data from requests collection.
  //    order only if data from lyft_orders.
  let batch = db.batch();

  let promises = docs.map(async (orderSnapshot) => {
    let orderId = orderSnapshot.id;
    let orderData = orderSnapshot.data();

    let lyftOrderId = orderData.orderId;

    const lyftResponse = await makeLyftRequest(
      db,
      accessToken,
      `/orders/${lyftOrderId}`,
      "GET"
    );

    const { requestRef, retryRef } = getRequestRefInfo(db, orderData);

    if (lyftResponse.error) {
      if (lyftResponse.statusCode === 404) {
        batch.update(requestRef, {
          status: "closed",
          lyftStatus: "FAILED",
          outcome: "timed_out",
          timeClosed: new Date(),
        });

        if (retryRef) {
          batch.update(retryRef, {
            status: "closed",
            lyftStatus: "FAILED",
            outcome: "timed_out",
            timeClosed: new Date(),
          });
        }

        // fail the order so that we don't keep pinging lyft for these orders
        let orderRef = db.collection("lyft_orders").doc(orderId);
        batch.update(orderRef, {
          orderStatus: "FAILED",
          lyftStatus: "failed",
        });

        console.log(
          `LYFT INTEGRATION: closing lyft order ${lyftOrderId} because not found in Lyft/`
        );
      } else {
        console.error(
          `LYFT INTEGRATION: error loading lyft order ${lyftOrderId}`
        );
      }
      return;
    }

    const ret = getLyftOrderStatusInfo(orderData, lyftResponse.data);

    if (!ret) {
      return;
    }

    const { updatedOrderData, requestData } = ret;

    let orderRef = db.collection("lyft_orders").doc(orderId);
    batch.update(orderRef, updatedOrderData);

    batch.update(requestRef, requestData);

    if (retryRef) {
      batch.update(retryRef, requestData);
    }
  });

  await Promise.all(promises);
  return batch.commit().catch((err) => {
    console.error(
      "error doing batch commit when creating lyft request. uh oh",
      err
    );
  });
}

function getLyftOrderStatusInfo(orderData, lyftOrder) {
  console.log(
    "LYFT INTEGRATION debug:",
    util.inspect(orderData, undefined, 3),
    util.inspect(lyftOrder, undefined, 3)
  );
  let lyftStatus = lyftOrder.status;
  if (!lyftStatus) {
    // nothing to do here
    return;
  }

  // There is nothing to do if lyftStatus has not changed.
  if (lyftStatus === orderData.lyftStatus) {
    return;
  }

  // Map the Lyft status code to the Lyft status codes which are used by this app
  let requestLyftStatus;
  let orderStatus;
  let lyftDriver;
  switch (lyftStatus) {
    case "pending":
      requestLyftStatus = "ACTIVE";
      orderStatus = "ACTIVE";
      break;
    case "accepted":
      requestLyftStatus = "EN_ROUTE_TO_PICKUP";
      orderStatus = "ACTIVE";
      if (lyftOrder.driver && lyftOrder.driver.first_name) {
        lyftDriver = lyftOrder.driver.first_name;
      } else {
        lyftDriver = null;
      }
      break;
    case "arrived_pickup":
      requestLyftStatus = "ARRIVED_AT_PICKUP";
      orderStatus = "ACTIVE";
      break;
    case "picked_up":
      requestLyftStatus = "EN_ROUTE_TO_DROPOFF";
      orderStatus = "ACTIVE";
      break;
    case "dropped_off":
      requestLyftStatus = "COMPLETED";
      orderStatus = "COMPLETED";
      break;
    case "failed":
      requestLyftStatus = "FAILED";
      orderStatus = "FAILED";
      break;
    case "canceled":
      requestLyftStatus = "CANCELLED";
      orderStatus = "CANCELLED";
      break;
  }

  // ACTIVE | COMPLETED | FAILED
  // lyftStatus is the raw status returned from Lyft.
  let updatedOrderData = { orderStatus, lyftStatus };

  // TO_BE_SCHEDULED (pre-schedule) | ACTIVE | COMPLETED | FAILED | EN_ROUTE_TO_PICKUP | ARRIVED_AT_PICKUP | ENROUTE_TO_DROPOFF
  let requestData = { lyftStatus: requestLyftStatus, outcome: null };

  let closeTrip = false;
  let outcome = null;
  if (orderStatus === "FAILED") {
    closeTrip = true;
    if (lyftOrder.failure_reason) {
      requestData.lyftFailureError = lyftOrder.failure_reason;
    }
    outcome = "failed";
  } else if (orderStatus === "COMPLETED") {
    closeTrip = true;
    outcome = "completed";
    if (lyftOrder.dropoff_image_url) {
      // Image naturally appears only after dropoff; link expires in 1 hour
      updatedOrderData.droppoffImageTempUrl = lyftOrder.dropoff_image_url;
    }
  } else if (orderStatus === "ACTIVE") {
    // update lyft trip status as this changes
    // e.g. as it updates from SCHEDULED -> EN_ROUTE_TO_PICKUP -> ARRIVED_AT_PICKUP -> ARRIVED_AT_DROPOFF
    // we get COMPLETED from orderStatus anyways...
    let statusHistory = orderData.statusHistory || [];
    let last = statusHistory[statusHistory.length - 1];
    if (last !== requestLyftStatus) {
      statusHistory.push(requestLyftStatus);
      updatedOrderData.statusHistory = statusHistory;
    }
  } else {
    // cancelled we're expecting
    // nothing to do since we canceled so we should have the right data on our side
    if (orderStatus !== "CANCELLED") {
      console.error(
        `LYFT INTEGRATION: unexpected order status returned :${orderStatus}`
      );
    }
    return;
  }

  if (closeTrip) {
    requestData = {
      ...requestData,
      status: "closed",
      outcome: outcome,
      timeClosed: new Date(),
    };
    if (lyftOrder.price) {
      requestData.lyftCost = lyftOrder.price.amount;
      requestData.lyftCostDescription = lyftOrder.price.description;
    } else {
      console.info("Field price not included in Lyft response");
    }
  }

  return { updatedOrderData, requestData };
}

function getRequestRefInfo(db, orderData) {
  let requestRef = db.collection("requests").doc(orderData.requestId);

  let retryRef =
    orderData.lyftRetries > 0
      ? requestRef
          .collection("retries")
          .doc(orderData.requestId + ":" + orderData.lyftRetries)
      : null;

  return { requestRef, retryRef };
}

async function handleLyftWebhook(db, req, res) {
  const signature = req.get("X-Lyft-Signature");
  console.log("LYFT INTEGRATION: debug: lyft signature", signature);
  if (!signature) {
    console.error("Lyft Signature missing");
    return res.sendStatus(403);
  } else {
    console.log("LYFT INTEGRATION: debug: raw body", req.rawBody.toString());
    const digest = crypto
      .createHmac("sha256", VERIFICATION_TOKEN)
      .update(req.rawBody)
      .digest("base64");
    if ("sha256=" + digest !== signature) {
      console.error(`Lyft Signature mismatch ${digest} ${signature}`);
      return res.sendStatus(403);
    }
  }

  const data = req.body;

  // only type of event we care about
  // ignore the other 2
  if (req.body.event_type !== "delivery_order.status.updated") {
    return res.status(200).send();
  }

  // using orderId as we seem to save this over the event_id
  const prefix = LYFT_ENDPOINT + "/order/";
  const orderId = data.href.substr(prefix.length);

  if (!orderId) {
    return res.status(404).send("orderId not found:" + req.body.resource_href);
  }

  let orderSnapshot = await db
    .collection("lyft_orders")
    .where("orderId", "==", orderId)
    .get();

  if (!orderSnapshot.size) {
    return res.status(404).send("order not found:" + orderId);
  }

  if (orderSnapshot.size !== 1) {
    console.error(
      `LYFT INTEGRATION: more than one order found with order ${orderId}`
    );
    return res.status(501).send("order not found:" + orderId);
  }

  const orderDoc = orderSnapshot.docs[0];
  const orderData = orderDoc.data();

  const ret = getLyftOrderStatusInfo(orderData, data.event);
  if (!ret) {
    console.log("LYFT INTEGRATION debug: nothing to update");
    // nothing to do here
    return res.status(200).send();
  }
  const { requestRef, retryRef } = getRequestRefInfo(db, orderData);

  const { updatedOrderData, requestData } = ret;

  let batch = db.batch();
  batch.update(orderDoc.ref, updatedOrderData);

  batch.update(requestRef, requestData);

  console.log(
    `LYFT INTEGRATION updating ${util.inspect(
      requestData,
      undefined,
      3
    )}. isRetry: ${!!retryRef}`
  );
  if (retryRef) {
    batch.update(retryRef, requestData);
  }

  return batch
    .commit()
    .catch((err) => {
      console.error(
        "error doing batch commit when handling lyft web hook. uh oh",
        err
      );
    })
    .finally(() => {
      return res.status(200).send();
    });
}

module.exports = {
  updateDeliveryStatus,
  checkLyftOrderStatuses,
  handleLyftWebhook,
};
