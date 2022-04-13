const _ = require("lodash");

/*
 Given the uber Order data from firebase,
 this function compares the last known Uber Courier trips
  with the fresh Courier trips coming from Uber API.
 If they are the same, returns false to indicate there is nothing to update.

 If they are different, it pushes the fresh object along with a timestamp
 to the existent courierTrips array or encloses this object in a single object
 array. Then it returns the array, in order to be used as an argument to the
 firebird update() function.

*/
const getUpdatedCourierTrips = (orderData, freshCourierTrips) => {
  const readedCourierTrips = orderData.courierTrips || [];
  const n = readedCourierTrips.length;
  const lastCourierTrip = n
    ? readedCourierTrips[n - 1].courierTripsArray
    : null;
  if (_.isEqual(lastCourierTrip, freshCourierTrips)) {
    console.log("Nothing new to update");
    return false;
  }
  readedCourierTrips.push({
    time: Date.now(),
    courierTripsArray: freshCourierTrips,
  });
  return readedCourierTrips;
};

const saveCourierTrips = async (db, orderId, batch, uberOrder) => {
  try {
    const freshCourierTrips = uberOrder.courier_trips;
    const orderRef = db.collection("uber_orders").doc(orderId);
    const orderSnapshot = await orderRef.get();
    const updatedCourierTrips = getUpdatedCourierTrips(
      orderSnapshot.data(),
      freshCourierTrips
    );
    if (updatedCourierTrips)
      batch.update(orderRef, {
        courierTrips: updatedCourierTrips,
      });
  } catch (err) {
    console.warn("Failed saving courier trips", err);
  }
};

module.exports = {
  saveCourierTrips,
};
