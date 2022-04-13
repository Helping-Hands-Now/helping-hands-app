const functions = require("firebase-functions");
const {
  getAccessToken,
  getAndSaveAccessToken,
  createDeliveryPath,
  getDeliveryPath,
  getDeliveryOrder,
  cancelLyftTrip,
  cancelLyftPath,
} = require("./lyft");
const {
  updateDeliveryStatus,
  checkLyftOrderStatuses,
} = require("./lyftStatus");

async function lyftTest(db, data) {
  // Only allow test to run in test environment.
  const firebaseProjectId = functions.config().gcp.project_id;
  if (firebaseProjectId === "helping-hands-community") {
    return { error: "only available in test environment" };
  }

  const type = data.test;
  let result;

  try {
    if (type === "token") {
      result = await accessTokenTest(db, type);
    } else if (type === "requests") {
      result = await requestsTest(db, type);
    } else if (type === "cancel") {
      result = await cancelTest(db, type);
    } else if (type === "getOrder") {
      result = await getOrderTest(db, type, data.orderId);
    } else {
      result = { error: `unknown type: ${type}` };
    }
  } catch (err) {
    throw new functions.https.HttpsError("invalid-argument", err.message);
  }

  return result;
}

async function accessTokenTest(db, type) {
  let accessToken1 = await getAndSaveAccessToken(db, 2000);
  if (!accessToken1) {
    return { error: "token 1 empty" };
  }
  console.log("token1=", accessToken1);
  let accessToken2 = await getAccessToken(db);
  if (!accessToken2) {
    return { error: "token 2 empty" };
  }
  console.log("token2=", accessToken2);
  if (accessToken1 !== accessToken2) {
    return { error: "token 1  !== token 2" };
  }
  await new Promise(function (resolve, reject) {
    setTimeout(() => resolve(1), 5000);
  });
  let accessToken3 = getAndSaveAccessToken(db);
  if (!accessToken3) {
    return { error: "token 3 empty" };
  }
  if (accessToken2 === accessToken3) {
    return { error: "token 3 expected to be a new token" };
  }

  return { type: type, result: "ok" };
}

async function deleteOrders(db, requestId) {
  querySnapshot = await db
    .collection("lyft_orders")
    .where("requestId", "==", requestId)
    .where("orderStatus", "==", "ACTIVE")
    .get();
  try {
    querySnapshot.forEach(async (doc) => {
      await doc.ref.delete();
    });
  } catch (error) {
    console.log("Error getting documents: ", error);
  }
}

async function requestsTest(db, type) {
  const supplierId = "BKzUab0fMnUCZ7lR96mH";
  let supplier;
  const requests = [];

  const supplierDoc = await db.collection("suppliers").doc(supplierId).get();
  supplier = supplierDoc.data();

  const querySnapshot = await db
    .collection("requests")
    .where("supplier", "==", supplierId)
    .get();
  querySnapshot.forEach((doc) => {
    requests.push(doc);
  });
  for (let request of requests) {
    await request.ref.update({ status: "open" });
    await deleteOrders(db, request.id);
  }

  const createdPathId = await createDeliveryPath(db, supplierDoc, requests);

  const ordersSnapshot = await db
    .collection("lyft_orders")
    .orderBy("orderId", "asc")
    .get();
  let error = "";
  let index = 0;
  let orders = [];
  ordersSnapshot.forEach((order) => {
    let orderData = order.data();
    if (orderData.lyftPathId === createdPathId) {
      orders.push(orderData);
      if (orderData.lyftRetries !== 0) {
        error = error + "invalid retry count: " + orderData.lyftRetries + "\n";
      }
      if (orderData.orderStatus !== "ACTIVE") {
        error = error + "invalid order status: " + orderData.orderStatus + "\n";
      }
      if (orderData.pickupTime !== 0) {
        error = error + "invalid pickup time: " + orderData.pickupTime + "\n";
      }
      if (orderData.requestId !== requests[index].id) {
        error =
          error +
          "unexpected request id: " +
          orderData.requestId +
          " should be " +
          requests[index].id +
          "\n";
      }
      console.log("index=", index, " ,orderId=", orderData.orderId);
      index = index + 1;
    }
  });

  if (index !== 3) {
    error = error + index + "ordereds in path but expected 3.\n";
  }

  if (error !== "") {
    return { type: type, error: error, orders: orders };
  } else {
    const lyftOrders = await getDeliveryPath(db, createdPathId);
    console.log("pathId=", createdPathId);
    console.log("orders from lyft=", JSON.stringify(lyftOrders, null, 3));
  }

  let orderId = orders[0].orderId;
  let orderStatus;
  let checkResult;
  orderStatus = await getDeliveryOrder(db, orderId);
  if (orderStatus.data.status !== "pending") {
    return {
      type: type,
      error: `unexpected status: ${orderStatus.data.status}, expected: pending`,
    };
  }
  let params = [
    {
      orderId: orders[0].orderId,
      lyftStatus: "pending",
      orderStatus: "ACTIVE",
      requestLyftStatus: "ACTIVE",
      status: "pending_fulfillment",
    },
    {
      orderId: orders[1].orderId,
      lyftStatus: "pending",
      orderStatus: "ACTIVE",
      requestLyftStatus: "ACTIVE",
      status: "pending_fulfillment",
    },
    {
      orderId: orders[2].orderId,
      lyftStatus: "pending",
      orderStatus: "ACTIVE",
      requestLyftStatus: "ACTIVE",
      status: "pending_fulfillment",
    },
  ];
  checkResult = await checkStatuses(db, type, params);
  if (checkResult) return checkResult;

  checkResult = await checkStatusChange(db, type, orderId, "accepted");
  if (checkResult) return checkResult;
  params = [
    {
      orderId: orders[0].orderId,
      lyftStatus: "accepted",
      orderStatus: "ACTIVE",
      requestLyftStatus: "EN_ROUTE_TO_PICKUP",
      status: "pending_fulfillment",
    },
    {
      orderId: orders[1].orderId,
      lyftStatus: "pending",
      orderStatus: "ACTIVE",
      requestLyftStatus: "ACTIVE",
      status: "pending_fulfillment",
    },
    {
      orderId: orders[2].orderId,
      lyftStatus: "pending",
      orderStatus: "ACTIVE",
      requestLyftStatus: "ACTIVE",
      status: "pending_fulfillment",
    },
  ];
  checkResult = await checkStatuses(db, type, params);
  if (checkResult) return checkResult;

  checkResult = await checkStatusChange(db, type, orderId, "arrived_pickup");
  if (checkResult) return checkResult;
  params = [
    {
      orderId: orders[0].orderId,
      lyftStatus: "arrived_pickup",
      orderStatus: "ACTIVE",
      requestLyftStatus: "ARRIVED_AT_PICKUP",
      status: "pending_fulfillment",
    },
    {
      orderId: orders[1].orderId,
      lyftStatus: "pending",
      orderStatus: "ACTIVE",
      requestLyftStatus: "ACTIVE",
      status: "pending_fulfillment",
    },
    {
      orderId: orders[2].orderId,
      lyftStatus: "pending",
      orderStatus: "ACTIVE",
      requestLyftStatus: "ACTIVE",
      status: "pending_fulfillment",
    },
  ];
  checkResult = await checkStatuses(db, type, params);
  if (checkResult) return checkResult;

  checkResult = await checkStatusChange(db, type, orderId, "picked_up");
  if (checkResult) return checkResult;
  checkResult = await checkStatusChange(db, type, orders[1].orderId, "failed");
  if (checkResult) return checkResult;
  params = [
    {
      orderId: orders[0].orderId,
      lyftStatus: "picked_up",
      orderStatus: "ACTIVE",
      requestLyftStatus: "EN_ROUTE_TO_DROPOFF",
      status: "pending_fulfillment",
    },
    {
      orderId: orders[1].orderId,
      lyftStatus: "failed",
      orderStatus: "FAILED",
      lyftFailureError: "UNKNOWN",
      requestLyftStatus: "FAILED",
      status: "closed",
      outcome: "failed",
    },
    {
      orderId: orders[2].orderId,
      lyftStatus: "pending",
      orderStatus: "ACTIVE",
      requestLyftStatus: "ACTIVE",
      status: "pending_fulfillment",
    },
  ];
  checkResult = await checkStatuses(db, type, params);
  if (checkResult) return checkResult;

  checkResult = await checkStatusChange(db, type, orderId, "dropped_off");
  if (checkResult) return checkResult;
  params = [
    {
      orderId: orders[0].orderId,
      lyftStatus: "dropped_off",
      orderStatus: "COMPLETED",
      requestLyftStatus: "COMPLETED",
      outcome: "completed",
      status: "closed",
    },
    {
      orderId: orders[1].orderId,
      lyftStatus: "failed",
      orderStatus: "FAILED",
      lyftFailureError: "UNKNOWN",
      requestLyftStatus: "FAILED",
      status: "closed",
      outcome: "failed",
    },
    {
      orderId: orders[2].orderId,
      lyftStatus: "pending",
      orderStatus: "ACTIVE",
      requestLyftStatus: "ACTIVE",
      status: "pending_fulfillment",
    },
  ];
  checkResult = await checkStatuses(db, type, params);
  if (checkResult) return checkResult;

  checkResult = await checkStatusChange(
    db,
    type,
    orders[2].orderId,
    "accepted"
  );
  if (checkResult) return checkResult;
  params = [
    {
      orderId: orders[0].orderId,
      lyftStatus: "dropped_off",
      orderStatus: "COMPLETED",
      requestLyftStatus: "COMPLETED",
      outcome: "completed",
      status: "closed",
    },
    {
      orderId: orders[1].orderId,
      lyftStatus: "failed",
      orderStatus: "FAILED",
      lyftFailureError: "UNKNOWN",
      requestLyftStatus: "FAILED",
      status: "closed",
      outcome: "failed",
    },
    {
      orderId: orders[2].orderId,
      lyftStatus: "accepted",
      orderStatus: "ACTIVE",
      requestLyftStatus: "EN_ROUTE_TO_PICKUP",
      status: "pending_fulfillment",
    },
  ];
  checkResult = await checkStatuses(db, type, params);
  if (checkResult) return checkResult;

  let lyftSnapShot = await db
    .collection("lyft_orders")
    .where("orderId", "==", orders[0].orderId)
    .get();
  let lyftOrder = lyftSnapShot.docs[0].data();
  await cancelLyftTrip(db, { requestId: lyftOrder.requestId });
  params = [
    {
      orderId: orders[0].orderId,
      lyftStatus: "CANCELLED",
      orderStatus: "CANCELLED",
      requestLyftStatus: "CANCELLED",
      outcome: "cancelled",
      status: "closed",
    },
    {
      orderId: orders[1].orderId,
      lyftStatus: "failed",
      orderStatus: "FAILED",
      lyftFailureError: "UNKNOWN",
      requestLyftStatus: "FAILED",
      status: "closed",
      outcome: "failed",
    },
    {
      orderId: orders[2].orderId,
      lyftStatus: "accepted",
      orderStatus: "ACTIVE",
      requestLyftStatus: "EN_ROUTE_TO_PICKUP",
      status: "pending_fulfillment",
    },
  ];

  return { type: type, result: "ok" };
}

async function cancelTest(db, type) {
  const supplierId = "BKzUab0fMnUCZ7lR96mH";
  let supplier;
  const requests = [];

  const supplierDoc = await db.collection("suppliers").doc(supplierId).get();
  supplier = supplierDoc.data();

  const querySnapshot = await db
    .collection("requests")
    .where("supplier", "==", supplierId)
    .get();
  querySnapshot.forEach((doc) => {
    requests.push(doc);
  });
  for (let request of requests) {
    await request.ref.update({ status: "open" });
    await deleteOrders(db, request.id);
  }

  const createdPathId = await createDeliveryPath(db, supplierDoc, requests);

  const ordersSnapshot = await db
    .collection("lyft_orders")
    .orderBy("orderId", "asc")
    .get();
  let error = "";
  let index = 0;
  let orders = [];
  ordersSnapshot.forEach((order) => {
    let orderData = order.data();
    if (orderData.lyftPathId === createdPathId) {
      orders.push(orderData);
      if (orderData.lyftRetries !== 0) {
        error = error + "invalid retry count: " + orderData.lyftRetries + "\n";
      }
      if (orderData.orderStatus !== "ACTIVE") {
        error = error + "invalid order status: " + orderData.orderStatus + "\n";
      }
      if (orderData.pickupTime !== 0) {
        error = error + "invalid pickup time: " + orderData.pickupTime + "\n";
      }
      if (orderData.requestId !== requests[index].id) {
        error =
          error +
          "unexpected request id: " +
          orderData.requestId +
          " should be " +
          requests[index].id +
          "\n";
      }
      console.log("index=", index, " ,orderId=", orderData.orderId);
      index = index + 1;
    }
  });

  if (index !== 3) {
    error = error + index + "ordereds in path but expected 3.\n";
  }

  if (error !== "") {
    return { type: type, error: error, orders: orders };
  } else {
    const lyftOrders = await getDeliveryPath(db, createdPathId);
    console.log("pathId=", createdPathId);
    console.log("orders from lyft=", JSON.stringify(lyftOrders, null, 3));
  }

  let orderId = orders[0].orderId;
  let orderStatus;
  let checkResult;
  orderStatus = await getDeliveryOrder(db, orderId);
  if (orderStatus.data.status !== "pending") {
    return {
      type: type,
      error: `unexpected status: ${orderStatus.data.status}, expected: pending`,
    };
  }
  let params = [
    {
      orderId: orders[0].orderId,
      lyftStatus: "pending",
      orderStatus: "ACTIVE",
      requestLyftStatus: "ACTIVE",
      status: "pending_fulfillment",
    },
    {
      orderId: orders[1].orderId,
      lyftStatus: "pending",
      orderStatus: "ACTIVE",
      requestLyftStatus: "ACTIVE",
      status: "pending_fulfillment",
    },
    {
      orderId: orders[2].orderId,
      lyftStatus: "pending",
      orderStatus: "ACTIVE",
      requestLyftStatus: "ACTIVE",
      status: "pending_fulfillment",
    },
  ];
  checkResult = await checkStatuses(db, type, params);
  if (checkResult) return checkResult;

  await cancelLyftPath(db, { pathId: createdPathId });
  params = [
    {
      orderId: orders[0].orderId,
      lyftStatus: "CANCELLED",
      orderStatus: "CANCELLED",
      requestLyftStatus: "CANCELLED",
      outcome: "cancelled",
      status: "closed",
    },
    {
      orderId: orders[1].orderId,
      lyftStatus: "CANCELLED",
      orderStatus: "CANCELLED",
      requestLyftStatus: "CANCELLED",
      outcome: "cancelled",
      status: "closed",
    },
    {
      orderId: orders[2].orderId,
      lyftStatus: "CANCELLED",
      orderStatus: "CANCELLED",
      requestLyftStatus: "CANCELLED",
      outcome: "cancelled",
      status: "closed",
    },
  ];
  checkResult = await checkStatuses(db, type, params);
  if (checkResult) return checkResult;

  orderStatus = await getDeliveryOrder(db, orders[0].orderId);
  if (orderStatus.error) {
    return {
      type: type,
      error: `error getting lyft record: ${orderStatus.error}, statusCode = ${orderStatus.statusCode}`,
    };
  }
  if (orderStatus.data.status !== "canceled") {
    return {
      type: type,
      error: `unexpected status: ${orderStatus.data.status}, expected: canceled`,
    };
  }
  orderStatus = await getDeliveryOrder(db, orders[1].orderId);
  if (orderStatus.error) {
    return {
      type: type,
      error: `error getting lyft record: ${orderStatus.error}, statusCode = ${orderStatus.statusCode}`,
    };
  }
  if (orderStatus.data.status !== "canceled") {
    return {
      type: type,
      error: `unexpected status: ${orderStatus.data.status}, expected: canceled`,
    };
  }
  orderStatus = await getDeliveryOrder(db, orders[2].orderId);
  if (orderStatus.error) {
    return {
      type: type,
      error: `error getting lyft record: ${orderStatus.error}, statusCode = ${orderStatus.statusCode}`,
    };
  }
  if (orderStatus.data.status !== "canceled") {
    return {
      type: type,
      error: `unexpected status: ${orderStatus.data.status}, expected: canceled`,
    };
  }

  return { type: type, result: "ok" };
}

async function checkStatusChange(db, type, orderId, newStatus, failure) {
  console.log("new status=", newStatus);
  const data = { orderId, newStatus };
  if (failure) data.failure = failure;

  await updateDeliveryStatus(db, data);

  orderStatus = await getDeliveryOrder(db, orderId);
  console.log("order=", JSON.stringify(orderStatus, null, 3));
  if (orderStatus.data.status !== newStatus) {
    return {
      type: type,
      error: `unexpected status: ${orderStatus.data.status}, expected: ${newStatus}`,
    };
  }

  if (newStatus === "failed") {
    if (!failure) failure = "UNKNOWN";
    if (orderStatus.data.failure_reason !== failure) {
      return {
        type: type,
        error: `unexpected failure: ${orderStatus.data.failure_reason}, expected: ${failure}`,
      };
    }
  }

  return null;
}

async function checkStatuses(db, type, orders) {
  await checkLyftOrderStatuses(db);

  for (let i = 0; i < orders.length; i++) {
    // eslint-disable-next-line no-await-in-loop
    let lyftSnapShot = await db
      .collection("lyft_orders")
      .where("orderId", "==", orders[i].orderId)
      .get();
    let lyftOrder = lyftSnapShot.docs[0].data();
    console.log("lyftOrder=", JSON.stringify(lyftOrder, null, 3));
    if (lyftOrder.orderStatus !== orders[i].orderStatus) {
      return {
        type: type,
        error: `(i=${i}) unexpected orderStatus: ${lyftOrder.orderStatus}, expected: ${orders[i].orderStatus}`,
      };
    }
    if (lyftOrder.lyftStatus !== orders[i].lyftStatus) {
      return {
        type: type,
        error: `(i=${i}) unexpected lyftStatus: ${lyftOrder.lyftStatus}, expected: ${orders[i].lyftStatus}`,
      };
    }
    let requestId = lyftOrder.requestId;
    // eslint-disable-next-line no-await-in-loop
    let requestDoc = await db.collection("requests").doc(requestId).get();
    let request = requestDoc.data();
    console.log("request=", JSON.stringify(request, null, 3));
    if (request.lyftStatus !== orders[i].requestLyftStatus) {
      return {
        type: type,
        error: `(i=${i}) unexpected request lyftStatus: ${request.lyftStatus}, expected: ${orders[i].requestLyftStatus}`,
      };
    }
    if (orders[i].outcome && request.outcome !== orders[i].outcome) {
      return {
        type: type,
        error: `(i=${i}) unexpected request outcome: ${request.outcome}, expected: ${orders[i].outcome}`,
      };
    }
    if (orders[i].status && request.status !== orders[i].status) {
      return {
        type: type,
        error: `(i=${i}) unexpected request status: ${request.status}, expected: ${orders[i].status}`,
      };
    }
    if (
      orders[i].lyftFailureError &&
      request.lyftFailureError !== orders[i].lyftFailureError
    ) {
      return {
        type: type,
        error: `(i=${i}) unexpected request lyftFailureError: ${request.lyftFailureError}, expected: ${orders[i].lyftFailureError}`,
      };
    }
  }
  return null;
}

async function getOrderTest(db, type, lyftOrderId) {
  return await getDeliveryOrder(db, lyftOrderId);
}

module.exports = {
  lyftTest,
};
