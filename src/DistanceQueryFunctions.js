// Helper functions
function toRad(n) {
  return (n * Math.PI) / 180;
}

// constants
const EARTH_MERI_CIRCUMFERENCE = 40007860;
const BITS_PER_CHAR = 5;
const MAXIMUM_BITS_PRECISION = 22 * BITS_PER_CHAR;
const BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz";
const METERS_PER_DEGREE_LATITUDE = 110574;
const EARTH_EQ_RADIUS = 6378137.0;
const E2 = 0.00669447819799;
const EPSILON = 1e-12;

function log2(x) {
  return Math.log(x) / Math.log(2);
}

/**
 * Calculates the bits necessary to reach a given resolution, in meters, for the latitude.
 *
 * @param resolution The bits necessary to reach a given resolution, in meters.
 * @returns Bits necessary to reach a given resolution, in meters, for the latitude.
 */
function latitudeBitsForResolution(resolution) {
  return Math.min(
    log2(EARTH_MERI_CIRCUMFERENCE / 2 / resolution),
    MAXIMUM_BITS_PRECISION
  );
}

/**
 * Calculates the bits necessary to reach a given resolution, in meters, for the longitude at a
 * given latitude.
 *
 * @param resolution The desired resolution.
 * @param latitude The latitude used in the conversion.
 * @return The bits necessary to reach a given resolution, in meters.
 */
function longitudeBitsForResolution(resolution, latitude) {
  const degs = metersToLongitudeDegrees(resolution, latitude);
  return Math.abs(degs) > 0.000001 ? Math.max(1, log2(360 / degs)) : 1;
}

/**
 * Calculates the maximum number of bits of a geohash to get a bounding box that is larger than a
 * given size at the given coordinate.
 *
 * @param coordinate The coordinate as a [latitude, longitude] pair.
 * @param size The size of the bounding box.
 * @returns The number of bits necessary for the geohash.
 */
function boundingBoxBits(coordinate, size) {
  const latDeltaDegrees = size / METERS_PER_DEGREE_LATITUDE;
  const latitudeNorth = Math.min(90, coordinate[0] + latDeltaDegrees);
  const latitudeSouth = Math.max(-90, coordinate[0] - latDeltaDegrees);
  const bitsLat = Math.floor(latitudeBitsForResolution(size)) * 2;
  const bitsLongNorth =
    Math.floor(longitudeBitsForResolution(size, latitudeNorth)) * 2 - 1;
  const bitsLongSouth =
    Math.floor(longitudeBitsForResolution(size, latitudeSouth)) * 2 - 1;
  return Math.min(
    bitsLat,
    bitsLongNorth,
    bitsLongSouth,
    MAXIMUM_BITS_PRECISION
  );
}

/**
 * Calculates the bounding box query for a geohash with x bits precision.
 *
 * @param geohash The geohash whose bounding box query to generate.
 * @param bits The number of bits of precision.
 * @returns A [start, end] pair of geohashes.
 */
function geohashQuery(geohash, bits) {
  const precision = Math.ceil(bits / BITS_PER_CHAR);
  if (geohash.length < precision) {
    return [geohash, geohash + "~"];
  }
  geohash = geohash.substring(0, precision);
  const base = geohash.substring(0, geohash.length - 1);
  const lastValue = BASE32.indexOf(geohash.charAt(geohash.length - 1));
  const significantBits = bits - base.length * BITS_PER_CHAR;
  const unusedBits = BITS_PER_CHAR - significantBits;
  // delete unused bits
  const startValue = (lastValue >> unusedBits) << unusedBits;
  const endValue = startValue + (1 << unusedBits);
  if (endValue > 31) {
    return [base + BASE32[startValue], base + "~"];
  } else {
    return [base + BASE32[startValue], base + BASE32[endValue]];
  }
}

/**
 * Generates a geohash of the specified precision/string length from the  [latitude, longitude]
 * pair, specified as an array.
 *
 * @param location The [latitude, longitude] pair to encode into a geohash.
 * @param precision The length of the geohash to create. If no precision is specified, the
 * global default is used.
 * @returns The geohash of the inputted location.
 */
function encodeGeohash(location, precision) {
  if (typeof precision !== "undefined") {
    if (typeof precision !== "number" || isNaN(precision)) {
      throw new Error("precision must be a number");
    } else if (precision <= 0) {
      throw new Error("precision must be greater than 0");
    } else if (precision > 22) {
      throw new Error("precision cannot be greater than 22");
    } else if (Math.round(precision) !== precision) {
      throw new Error("precision must be an integer");
    }
  }

  const latitudeRange = {
    min: -90,
    max: 90,
  };
  const longitudeRange = {
    min: -180,
    max: 180,
  };
  let hash = "";
  let hashVal = 0;
  let bits = 0;
  let even: number | boolean = 1;

  while (hash.length < precision) {
    const val = even ? location[1] : location[0];
    const range = even ? longitudeRange : latitudeRange;
    const mid = (range.min + range.max) / 2;

    if (val > mid) {
      hashVal = (hashVal << 1) + 1;
      range.min = mid;
    } else {
      hashVal = (hashVal << 1) + 0;
      range.max = mid;
    }

    even = !even;
    if (bits < 4) {
      bits++;
    } else {
      bits = 0;
      hash += BASE32[hashVal];
      hashVal = 0;
    }
  }

  return hash;
}

/**
 * Calculates a set of queries to fully contain a given circle. A query is a [start, end] pair
 * where any geohash is guaranteed to be lexiographically larger then start and smaller than end.
 *
 * @param center The center given as [latitude, longitude] pair.
 * @param radius The radius of the circle.
 * @return An array of geohashes containing a [start, end] pair.
 */
export default function geohashQueries(center, radius) {
  const queryBits = Math.max(
    1,
    boundingBoxBits([center.latitude, center.longitude], radius)
  );
  const geohashPrecision = Math.ceil(queryBits / BITS_PER_CHAR);
  const coordinates = boundingBoxCoordinates(
    [center.latitude, center.longitude],
    radius
  );
  const queries = coordinates.map((coordinate) => {
    return geohashQuery(encodeGeohash(coordinate, geohashPrecision), queryBits);
  });
  // remove duplicates
  return queries.filter((query, index) => {
    return !queries.some((other, otherIndex) => {
      return (
        index > otherIndex && query[0] === other[0] && query[1] === other[1]
      );
    });
  });
}

/**
 * Calculates the number of degrees a given distance is at a given latitude.
 *
 * @param distance The distance to convert.
 * @param latitude The latitude at which to calculate.
 * @returns The number of degrees the distance corresponds to.
 */
function metersToLongitudeDegrees(distance, latitude) {
  const radians = toRad(latitude);
  const num = (Math.cos(radians) * EARTH_EQ_RADIUS * Math.PI) / 180;
  const denom = 1 / Math.sqrt(1 - E2 * Math.sin(radians) * Math.sin(radians));
  const deltaDeg = num * denom;
  if (deltaDeg < EPSILON) {
    return distance > 0 ? 360 : 0;
  } else {
    return Math.min(360, distance / deltaDeg);
  }
}

/**
 * Wraps the longitude to [-180,180].
 *
 * @param longitude The longitude to wrap.
 * @returns longitude The resulting longitude.
 */
function wrapLongitude(longitude) {
  if (longitude <= 180 && longitude >= -180) {
    return longitude;
  }
  const adjusted = longitude + 180;
  if (adjusted > 0) {
    return (adjusted % 360) - 180;
  } else {
    return 180 - (-adjusted % 360);
  }
}

/**
 * Calculates eight points on the bounding box and the center of a given circle. At least one
 * geohash of these nine coordinates, truncated to a precision of at most radius, are guaranteed
 * to be prefixes of any geohash that lies within the circle.
 *
 * @param center The center given as [latitude, longitude].
 * @param radius The radius of the circle.
 * @returns The eight bounding box points.
 */
function boundingBoxCoordinates(center, radius) {
  const latDegrees = radius / METERS_PER_DEGREE_LATITUDE;
  const latitudeNorth = Math.min(90, center[0] + latDegrees);
  const latitudeSouth = Math.max(-90, center[0] - latDegrees);
  const longDegsNorth = metersToLongitudeDegrees(radius, latitudeNorth);
  const longDegsSouth = metersToLongitudeDegrees(radius, latitudeSouth);
  const longDegs = Math.max(longDegsNorth, longDegsSouth);
  return [
    [center[0], center[1]],
    [center[0], wrapLongitude(center[1] - longDegs)],
    [center[0], wrapLongitude(center[1] + longDegs)],
    [latitudeNorth, center[1]],
    [latitudeNorth, wrapLongitude(center[1] - longDegs)],
    [latitudeNorth, wrapLongitude(center[1] + longDegs)],
    [latitudeSouth, center[1]],
    [latitudeSouth, wrapLongitude(center[1] - longDegs)],
    [latitudeSouth, wrapLongitude(center[1] + longDegs)],
  ];
}
