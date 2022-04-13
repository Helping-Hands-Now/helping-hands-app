var functions = require("firebase-functions");
var geohash = require("ngeohash");
var fetch = require("node-fetch");
var xml2js = require("xml2js");

// Validate Address Field Helper
function checkField(name, value) {
  if (name && !value) {
    const message = `No value for ${name}`;
    console.error(message);
    throw new Error(message);
  }
  return value;
}

async function lookupNeighborhood(data, googleMaps, googleMapsClient) {
  googleMaps = googleMaps || require("@googlemaps/google-maps-services-js");
  googleMapsClient = googleMapsClient || new googleMaps.Client({});

  try {
    const placeId = data.placeId;
    const params = {
      place_id: `${placeId}`,
      key: functions.config().googlegeocodeapi.key,
    };

    var r = await googleMapsClient
      .geocode({
        params: params,
        timeout: 1000, //milliseconds
      })
      .catch((e) => {
        console.log(`Sending response to client: 500 ${e}`);
        throw new functions.https.HttpsError(
          "unavailable",
          "error looking up neighborhood"
        );
      });

    if (r.data.error_message) {
      console.error(
        `error hitting the google maps API: ${r.data.error_message}`
      );
      throw new functions.https.HttpsError(
        "unavailable",
        "error looking up neighborhood"
      );
    }

    // initialize to empty, then will override when we fetch the correct
    // address component from the result
    var neighborhood = "";
    var locality = "";
    var sublocality = "";
    var state = "";

    var result = r.data.results[0];
    let addressComponents = result["address_components"];

    // For the States, generally we have the following address components:
    // - administrative_area_level_1: state
    // - locality/sublocality: city
    // - sublocality/neighborhood: neighborhood
    // The city and neighborhood are sometimes set in different positions,
    // so we just return the neighborhood, sublocality and locality and let
    // the front-end display whichever ones are defined, rather than infer
    // the city, since it changes from SF to NY, etc.
    //
    // Once we expand internationally, we should revisit what we pull from
    // the response, since different nations have different components.
    // See https://developers.google.com/maps/documentation/geocoding/intro#Types
    // for more details
    addressComponents.forEach((addressComponent) => {
      if (addressComponent["types"].includes("administrative_area_level_1")) {
        // take short name e.g., CA (vs. long name California)
        state = addressComponent["short_name"];
      }
      if (addressComponent["types"].includes("sublocality")) {
        sublocality = addressComponent["long_name"];
      }
      if (addressComponent["types"].includes("locality")) {
        locality = addressComponent["long_name"];
      }
      if (addressComponent["types"].includes("neighborhood")) {
        neighborhood = addressComponent["long_name"];
      }
    });

    return {
      status: "success",
      data: {
        neighborhood: neighborhood,
        sublocality: sublocality,
        locality: locality,
        state: state,
      },
    };
  } catch (err) {
    console.error(
      "Error looking up neighborhood with placeId " + placeId + ":",
      err
    );
    throw new functions.https.HttpsError("invalid-argument", err.message);
  }
}

async function addLocationToRequests(
  admin,
  db,
  data,
  googleMaps,
  googleMapsClient
) {
  var requests = data.requests;
  var requestsWithLocation = Object.assign({}, requests);

  let promises = [];
  for (const key in requests) {
    const value = requests[key];
    var userId = value.requester;

    promises.push(
      db
        .collection("users")
        .doc(userId)
        .get()
        .then(async (requesterUser) => {
          // now lookup the neighborhood from the placeId
          var placeId = requesterUser.data().placeId;
          var lookupNeighborhoodData = {
            placeId: placeId,
          };

          // Note: placeId is sometimes set to INVALID_ADDRESS, so we don't want
          // to run the neighborhood lookup in that scenario
          if (placeId && placeId !== "INVALID_ADDRESS") {
            var localLocationString = "";
            await lookupNeighborhood(lookupNeighborhoodData)
              .then((result) => {
                var locality = result.data["locality"];
                var sublocality = result.data["sublocality"];
                var state = result.data["state"];
                var neighborhood = result.data["neighborhood"];

                if (sublocality) {
                  requestsWithLocation[key].sublocality = sublocality;
                }
                if (locality) {
                  requestsWithLocation[key].locality = locality;
                }
                if (state) {
                  requestsWithLocation[key].state = state;
                }
                if (neighborhood) {
                  requestsWithLocation[key].neighborhood = neighborhood;
                }
                return;
              })
              .catch(function (error) {
                console.error(
                  "Error looking up neighborhood for placeId " + placeId + ": ",
                  error
                );
              });
          }
          return;
        })
    );
  }
  //})
  return Promise.all(promises).then((result) => {
    return {
      status: "success",
      data: {
        requests: requestsWithLocation,
      },
    };
  });
}

async function validateAddress(data, googleMaps, googleMapsClient) {
  googleMaps = googleMaps || require("@googlemaps/google-maps-services-js");
  googleMapsClient = googleMapsClient || new googleMaps.Client({});

  try {
    const USPSaddress = await validateUSPSAddress(data);
    const formattedAddress = `${USPSaddress.street} ${USPSaddress.apartmentAsString}, ${USPSaddress.city}, ${USPSaddress.state}, ${USPSaddress.zip}`;

    const params = {
      address: formattedAddress,
      components: "country:US",
      key: functions.config().googlegeocodeapi.key,
    };

    var r = await googleMapsClient
      .geocode({
        params: params,
        timeout: 1000, //milliseconds
      })
      .catch((e) => {
        console.log(`Sending response to client: 500 ${e}`);
      });

    if (r.data.error_message) {
      console.error(
        `error hitting the google maps API: ${r.data.error_message}`
      );
      throw new functions.https.HttpsError(
        "unavailable",
        "error validating address"
      );
    }
    var result = r.data.results[0];

    let lat = result.geometry.location.lat;
    let lng = result.geometry.location.lng;
    // console.log(
    //   `Sending response to client: 200 formatted_address: ${result.formatted_address}, lat: ${lat}, lng: ${lng}, placeId: ${result.place_id}`
    // );

    return {
      status: "success",
      data: {
        formatted_address: result.formatted_address,
        lat: lat,
        lng: lng,
        geohash: geohash.encode(
          lat + (Math.random() * 0.001 + 0.001),
          lng + (Math.random() * 0.001 + 0.001),
          52
        ),
        placeId: result.place_id,
        normalized: {
          street: USPSaddress.street,
          city: USPSaddress.city,
          state: USPSaddress.state,
          zip: USPSaddress.zip,
          apartment: USPSaddress.apartment,
          formattedAddress: formattedAddress,
        },
      },
    };
  } catch (err) {
    throw new functions.https.HttpsError("invalid-argument", err.message);
  }
}

async function validateUSPSAddress(data) {
  if (data.skipAddressCheck) {
    return {
      street: data.street,
      city: data.city,
      state: data.state,
      zip: data.zip,
      apartment: data.apartment || "",
      apartmentAsString: data.apartment || "",
    };
  }
  const street = checkField("street", data.street); // Required
  const city = checkField("city", data.city); // Required
  const state = checkField("state", data.state); // Required
  const zip = data.zip || ""; // Optional
  const apartment = data.apartment ? `APT ${data.apartment}` : ""; // Optional

  const userid = "XXX";
  let xml = `<AddressValidateRequest USERID="${userid}"><Revision>1</Revision><Address ID="0">`;
  xml = xml + `<Address1>${apartment}</Address1>`;
  xml = xml + `<Address2>${street}</Address2>`;
  xml = xml + `<City>${city}</City>`;
  xml = xml + `<State>${state}</State>`;
  xml = xml + `<Zip5>${zip}</Zip5><Zip4/>`;
  xml = xml + `</Address></AddressValidateRequest>`;

  return fetch("http://production.shippingapis.com/ShippingAPI.dll", {
    body: `API=Verify&XML=${encodeURIComponent(xml)}`,
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    method: "POST",
  })
    .then((response) => response.text())
    .then((xmlResponse) => {
      const parser = new xml2js.Parser({ explicitArray: false });
      // console.log("response=",xmlResponse);
      return parser.parseStringPromise(xmlResponse);
    })
    .then((jsonResponse) => {
      let message = "";
      const addressResponse = jsonResponse.AddressValidateResponse.Address;
      if (addressResponse.Error) {
        message = addressResponse.Error.Description;
      } else if (addressResponse.DPVConfirmation !== "Y") {
        if (addressResponse.DPVConfirmation === "D") {
          if (!data.skipApartmentCheck) {
            message = "Apartment number expected";
          }
        } else if (addressResponse.DPVConfirmation === "S") {
          if (!data.skipApartmentCheck) {
            message = "Invalid apartment number";
          }
        } else {
          message = "Invalid address";
        }
      }
      if (message !== "") {
        throw new functions.https.HttpsError("invalid-argument", message);
      }
      const USPSaddress = jsonResponse.AddressValidateResponse.Address;
      const address1 = USPSaddress.Address1 || "";
      const apartmentArray = address1.split(" ");
      const USPSapartment =
        apartmentArray.length === 2 ? apartmentArray[1] : apartment;
      return {
        street: USPSaddress.Address2,
        city: USPSaddress.City,
        state: USPSaddress.State,
        zip: USPSaddress.Zip5,
        apartment: USPSapartment, // the apartment number extracted from USPS normalized address
        apartmentAsString: address1, // the apartment number in USPS address line including APT or STE
      };
    });
}

module.exports = {
  addLocationToRequests,
  lookupNeighborhood,
  validateAddress,
};
