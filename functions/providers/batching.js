const geolib = require("geolib");
const geohash = require("ngeohash");
const GreedyOnion = require("./greedyOnion").GreedyOnion;

/**
 * Splits the requests into groups of <batchSize or less>. Each group is an array of requests in the desired order.
 * @param supplierDoc supplier docs (snapshots, not data)
 * @param requestsDoc array of request docs (snapshots, not data)
 * @param batchSize number of requests each driver can deliver
 */
function getDeliveryBatches(supplierDoc, requestDocs, batchSize = 5) {
  const distanceMatrix = getDistanceMatrix(supplierDoc, requestDocs);

  const greedyOnion = new GreedyOnion(distanceMatrix, batchSize);
  greedyOnion.run();

  const routes = greedyOnion.routes;
  let batches = [];
  routes.map((route) => {
    let orderedRequests = [];
    for (const index of route) {
      // indices were computed based on (supplier + requests), so minus one to get the request index
      orderedRequests.push(requestDocs[index - 1]);
    }
    batches.push(orderedRequests);
  });
  return batches;
}

function getDistanceMatrix(supplierDoc, requestDocs) {
  const supplierCoordinates = geohash.decode(supplierDoc.get("geohash"));

  let matrix = [];
  let locations = requestDocs.map((r) => geohash.decode(r.get("geohash")));
  locations.unshift(supplierCoordinates);
  for (let i = 0; i < locations.length; i++) {
    for (let j = 0; j < locations.length; j++) {
      if (j === 0) {
        matrix.push([]);
      }
      if (i === j) {
        matrix[i].push(0);
      } else if (i < j) {
        matrix[i].push(geolib.getDistance(locations[i], locations[j]));
      } else {
        matrix[i].push(matrix[j][i]);
      }
    }
  }
  return matrix;
}

module.exports = {
  getDeliveryBatches,
};
