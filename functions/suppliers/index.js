var functions = require("firebase-functions"); // Need to initialize this no matter what

var { verifyUserCanEditOrg } = require("./../organizations");
var { getE164PhoneNumber } = require("./../utils");
var moment = require("moment");

// duplicated from index.js
function verifyAuth(context) {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "User not authenticated."
    );
  }
}

async function verifyUserCanEditSupplier(db, context, supplierId) {
  let doc = await db.collection("suppliers").doc(supplierId).get();

  let data = doc.data();

  await verifyUserCanEditOrg(db, context, data.organizationId);
}

function getSupplierData(data) {
  let result = {
    name: data.name,
    street: data.street,
    city: data.city,
    state: data.state,
    zipCode: data.zipCode,
    apartment: data.apartment,
    geohash: data.geohash || "",
    placeId: data.placeId || "",
    primaryEmail: data.primaryEmail,
    primaryPhoneNumber: getE164PhoneNumber(data.primaryPhoneNumber),
    secondaryEmail: data.secondaryEmail,
    secondaryPhoneNumber: getE164PhoneNumber(data.secondaryPhoneNumber),
    pickupInstructions: data.pickupInstructions || "",
  };
  if (data.uberStoreId !== undefined) {
    result.uberStoreId = data.uberStoreId;
  }

  // Validation
  if (result.pickupInstructions && result.pickupInstructions.length >= 250) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Pickup note must be less than 250 characters"
    );
  }

  return result;
}

function createSupplier(db, data, context) {
  verifyAuth(context);
  // todo verify organizationId, name, (let's assume address is verified)

  if (!data.organizationId || !data.name) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "invalid data passed."
    );
  }
  const supplierData = getSupplierData(data);
  supplierData.organizationId = data.organizationId;
  supplierData.archived = false;
  const query = async () => {
    await verifyUserCanEditOrg(db, context, data.organizationId);

    const ref = await db.collection("suppliers").add(supplierData);
    return {
      id: ref.id,
    };
  };
  return Promise.resolve(query());
}

async function querySuppliers(db, data, context) {
  verifyAuth(context);

  const query = async () => {
    const supplierSnapshot = await db
      .collection("suppliers")
      .where("organizationId", "==", data.organizationId)
      .where("archived", "==", false)
      .get();

    // let { bucketRequestSnapshot } = require("./../requests");

    // TODO copied

    return await Promise.all(
      supplierSnapshot.docs.map(async (snapshot) => {
        let data = snapshot.data();
        data.id = snapshot.id;

        // let beginning of day
        let today = moment()
          // use UTC offset so we're consistent across timezones
          // now that we have timezones we should start from beginning of previous day
          // only things starting from today are cancellable
          .utcOffset(data.timeZone || 0)
          .set({
            hour: 0,
            minute: 0,
            seconds: 0,
            milliseconds: 0,
          })
          .valueOf();

        // get trip info
        // TODO we need to decide what we want to show here?
        // how many trips total? most recent trips?
        // only completed trips stc
        let [/* requestsSnapshot ,*/ deliverySnapshot] = await Promise.all([
          // db.collection("requests").where("supplier", "==", data.id).get(),
          db
            .collection("delivery_events")
            .where("supplierId", "==", data.id)
            .where("startTime", ">", today)
            .get(),
        ]);
        // let bucket = bucketRequestSnapshot(requestsSnapshot);
        let deliveryEvents = [];
        deliverySnapshot.docs.forEach((doc) => {
          let deliveryEvent = doc.data();
          deliveryEvent.id = doc.id;
          deliveryEvents.push(deliveryEvent);
        });
        data = {
          ...data,
          // ...bucket,
          deliveryEvents,
        };
        return data;
      })
    );
  };
  return Promise.resolve(query());
}

async function deleteSupplier(db, data, context) {
  verifyAuth(context);

  const query = async () => {
    await verifyUserCanEditSupplier(db, context, data.supplierId);

    await db.collection("suppliers").doc(data.supplierId).update({
      archived: true,
    });
    return {
      success: true,
    };
  };
  return Promise.resolve(query());
}

async function editSupplier(db, data, context) {
  verifyAuth(context);

  const supplierData = getSupplierData(data);

  const query = async () => {
    await verifyUserCanEditSupplier(db, context, data.supplierId);

    const ref = await db
      .collection("suppliers")
      .doc(data.supplierId)
      .update(supplierData);

    let promises = [];

    // Making sure that community delivery events are updated when people update their suppliers
    await db
      .collection("community_events")
      .where("supplierID", "==", data.supplierId)
      .get()
      .then((querySnapshot) => {
        querySnapshot.forEach((snapshot) => {
          promises.push(
            db.collection("community_events").doc(snapshot.id).update({
              geohash: supplierData.geohash,
            })
          );
        });
        return;
      });

    return Promise.all(promises).then((result) => {
      return {
        id: ref.id,
      };
    });
  };
  return Promise.resolve(query());
}

async function querySupplierTimeZone(
  db,
  data,
  context,
  googleMaps,
  googleMapsClient
) {
  verifyAuth(context);

  const supplierId = data.supplierId;

  const latitude = data.latitude;
  const longitude = data.longitude;

  const timestamp = data.timestamp
    ? data.timestamp
    : Math.floor(Date.now() / 1000);

  const API_KEY = functions.config().googlegeocodeapi.key;

  googleMaps = googleMaps || require("@googlemaps/google-maps-services-js");
  googleMapsClient = googleMapsClient || new googleMaps.Client({});

  try {
    var response = await googleMapsClient.timezone({
      params: {
        location: { lat: latitude, lng: longitude },
        timestamp: timestamp,
        key: API_KEY,
      },
    });
  } catch (error) {
    console.error(error);
  }

  if (response.status === 200 && response.data.status === "OK") {
    const work = await db
      .collection("suppliers")
      .doc(supplierId)
      .update({ timeZone: response.data.timeZoneId });

    return response.data.timeZoneId;
  } else {
    throw new functions.https.HttpsError(
      "Error",
      "Network error or invalid API usage"
    );
  }
}

async function importSuppliers(db, data, context) {
  const query = async () => {
    verifyAuth(context);
    if (!data.suppliers || !data.suppliers.length) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "invalid data passed."
      );
    }

    let { validateAddress } = require("./../address");
    let googleMaps = null;
    let googleMapsClient = null;

    let batch = db.batch();
    let ids = [];
    await Promise.all(
      data.suppliers.map(async (supplier) => {
        let r = await validateAddress(supplier, googleMaps, googleMapsClient);
        supplier.geohash = r.data.geohash;
        supplier.placeId = r.data.placeId;

        const supplierData = getSupplierData(supplier);
        supplierData.organizationId = data.organizationId;
        supplierData.archived = false;
        const ref = db.collection("suppliers").doc();
        batch.create(ref, supplierData);
        ids.push(ref.id);
      })
    );
    return batch
      .commit()
      .then((result) => {
        return {
          ids,
        };
      })
      .catch((err) => {
        console.error("transaction failure", err);
      });
  };
  return Promise.resolve(query());
}

module.exports = {
  createSupplier,
  querySuppliers,
  deleteSupplier,
  editSupplier,
  importSuppliers,
  querySupplierTimeZone,
};
