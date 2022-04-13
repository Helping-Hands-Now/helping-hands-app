/* eslint-disable promise/no-nesting */
var functions = require("firebase-functions"); // Need to initialize this no matter what
var geohash = require("ngeohash");

function toRad(n) {
  return (n * Math.PI) / 180;
}

function toDeg(n) {
  return (n * 180) / Math.PI;
}

function geohashDist(geohash1, geohash2, isMiles) {
  const geo1 = geohash.decode(geohash1);
  const geo2 = geohash.decode(geohash2);
  return haversineDistance(
    geo1.latitude,
    geo1.longitude,
    geo2.latitude,
    geo2.longitude,
    isMiles
  );
}

function haversineDistance(lat1, lon1, lat2, lon2, isMiles) {
  var R = 6371; // km

  var x1 = lat2 - lat1;
  var dLat = toRad(x1);
  var x2 = lon2 - lon1;
  var dLon = toRad(x2);
  var a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  var d = R * c;

  if (isMiles) d /= 1.60934;

  return d;
}

/**
 * Calculates the destination point given a origin(latitude / longitude), bearing, and distance
 *
 * @param {number} lat1 latitude
 * @param {number} lon1 longitude
 * @param {number} brng bearing in a numeric degrees
 * @param {number} dist distance in meters
 * @param {int} distanceMiles the "square mile radius" around the target location
 *
 * Source: https://gist.github.com/mathiasbynens/354587/4137c2350d7cee9b757444ef3a6f13a1f69c2abc
 **/
function destVincenty(lat1, lon1, brng, dist) {
  var a = 6378137,
    b = 6356752.3142,
    f = 1 / 298.257223563, // WGS-84 ellipsiod
    s = dist,
    alpha1 = toRad(brng),
    sinAlpha1 = Math.sin(alpha1),
    cosAlpha1 = Math.cos(alpha1),
    tanU1 = (1 - f) * Math.tan(toRad(lat1)),
    cosU1 = 1 / Math.sqrt(1 + tanU1 * tanU1),
    sinU1 = tanU1 * cosU1,
    sigma1 = Math.atan2(tanU1, cosAlpha1),
    sinAlpha = cosU1 * sinAlpha1,
    cosSqAlpha = 1 - sinAlpha * sinAlpha,
    uSq = (cosSqAlpha * (a * a - b * b)) / (b * b),
    A = 1 + (uSq / 16384) * (4096 + uSq * (-768 + uSq * (320 - 175 * uSq))),
    B = (uSq / 1024) * (256 + uSq * (-128 + uSq * (74 - 47 * uSq))),
    sigma = s / (b * A),
    sigmaP = 2 * Math.PI;
  while (Math.abs(sigma - sigmaP) > 1e-12) {
    var cos2SigmaM = Math.cos(2 * sigma1 + sigma),
      sinSigma = Math.sin(sigma),
      cosSigma = Math.cos(sigma),
      deltaSigma =
        B *
        sinSigma *
        (cos2SigmaM +
          (B / 4) *
            (cosSigma * (-1 + 2 * cos2SigmaM * cos2SigmaM) -
              (B / 6) *
                cos2SigmaM *
                (-3 + 4 * sinSigma * sinSigma) *
                (-3 + 4 * cos2SigmaM * cos2SigmaM)));
    sigmaP = sigma;
    sigma = s / (b * A) + deltaSigma;
  }
  var tmp = sinU1 * sinSigma - cosU1 * cosSigma * cosAlpha1,
    lat2 = Math.atan2(
      sinU1 * cosSigma + cosU1 * sinSigma * cosAlpha1,
      (1 - f) * Math.sqrt(sinAlpha * sinAlpha + tmp * tmp)
    ),
    lambda = Math.atan2(
      sinSigma * sinAlpha1,
      cosU1 * cosSigma - sinU1 * sinSigma * cosAlpha1
    ),
    C = (f / 16) * cosSqAlpha * (4 + f * (4 - 3 * cosSqAlpha)),
    L =
      lambda -
      (1 - C) *
        f *
        sinAlpha *
        (sigma +
          C *
            sinSigma *
            (cos2SigmaM + C * cosSigma * (-1 + 2 * cos2SigmaM * cos2SigmaM))),
    revAz = Math.atan2(sinAlpha, -tmp); // final bearing
  return {
    lat: toDeg(lat2),
    lng: lon1 + toDeg(L),
  };
}

const MILES_TO_METERS = 1609.34;
const GEOHASH_PRECISION = 52;
const TOP_RIGHT_ORIENTATION = 45;
const BOTTOM_LEFT_ORIENTATION = 225;

/**
 * Calculates the bottom-left, top-right geohashes in a square miles radius
 * Example usage:
 *      volunteersInArea = db
 *      .collection("users")
 *      .where("canHelp", "==", true)
 *      .where("geohash", ">=", bottomLeftGeoHash)
 *      .where("geohash", "<=", topRightGeoHash);
 *
 * @param {string} targetGeohash target location
 * @param {int} distanceMiles the "square mile radius" around the target location
 **/
function geohashSearchParams(targetGeohash, distanceMiles) {
  const targetLat = geohash.decode(targetGeohash).latitude;
  const targetLong = geohash.decode(targetGeohash).longitude;
  const bottomLeft = destVincenty(
    targetLat,
    targetLong,
    BOTTOM_LEFT_ORIENTATION,
    distanceMiles * MILES_TO_METERS
  );
  const bottomLeftGeoHash = geohash.encode(
    bottomLeft.lat,
    bottomLeft.lng,
    GEOHASH_PRECISION
  );
  const topRight = destVincenty(
    targetLat,
    targetLong,
    TOP_RIGHT_ORIENTATION,
    distanceMiles * MILES_TO_METERS
  );
  const topRightGeoHash = geohash.encode(
    topRight.lat,
    topRight.lng,
    GEOHASH_PRECISION
  );

  return {
    bottomLeft: bottomLeftGeoHash,
    topRight: topRightGeoHash,
  };
}

module.exports = {
  haversineDistance,
  destVincenty,
  geohashDist,
  geohashSearchParams,
};
