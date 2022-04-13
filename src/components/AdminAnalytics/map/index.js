import React, { useState, useEffect } from "react";
import { db } from "../../../firebase.js";
import geohash from "ngeohash";
import "./styles.css";
import ReactMapGL, { GeolocateControl, Source, Layer } from "react-map-gl";
import { Table, Button } from "semantic-ui-react";
import "mapbox-gl/dist/mapbox-gl.css";
import {
  clusterLayer,
  clusterCountLayer,
  unclusteredPointLayer,
} from "./layers";
import { useTranslation } from "react-i18next";
import RequestButton from "../RequestButton";

const PUBLIC_TOKEN =
  "pk.eyJ1IjoieWFzaGhoIiwiYSI6ImNrOGxkcXp4ODAzZmczZm12dTV1ejI1bzQifQ.S8S6qlTHoENZvqdGgQaXJA";

async function getData() {
  let [
    volunteersPromise,
    requestersPromise,
    requestsPromise,
    backgroundPromise,
  ] = await Promise.all([
    db.collection("users").where("canHelp", "==", true).get(),
    db.collection("users").where("needsHelp", "==", true).get(),
    db.collection("requests").get(),
    db
      .collection("users")
      .where("canHelp", "==", true)
      .where("checkrVerified", "==", true)
      .get(),
  ]);

  return {
    Volunteers: {
      label: "Volunteers",
      docs: volunteersPromise,
    },
    Requesters: {
      label: "Requesters",
      docs: requestersPromise,
    },
    Requests: {
      label: "Requests",
      docs: requestsPromise,
    },
    Background: {
      label: "Volunteers-with-check",
      docs: backgroundPromise,
    },
  };
}
const geolocateStyle = {
  float: "left",
  margin: "50px",
  padding: "10px",
};

export default function AdminMap() {
  const VOLUNTEER = 0;
  const OPEN_REQUEST = 1;
  const INVALID_REQUEST = 3;
  const FAILED_REQUEST = 4;
  const COMPLETED_REQUEST = 5;
  const CANCELLED_REQUEST = 6;
  const ACCEPTED_REQUEST = 7;
  const PASSED_BACKGROUND = 8;

  const [inspectedObj, setInspectedObj] = useState({});

  const [showVolunteers, setShowVolunteers] = useState(true);
  const [showRequesters, setShowRequesters] = useState(true);
  const [showBackgroundCheck, setShowBackgroundCheck] = useState(false);

  const [volunteers, setVolunteers] = useState([]);
  const [requesters, setRequesters] = useState([]);
  const [backgroundCheck, setBackgroundCheck] = useState([]);

  const [volunteersVisible, setVolunteersVisible] = useState([]);
  const [requestersVisible, setRequestersVisible] = useState([]);
  const [backgroundVisible, setBackgroundVisible] = useState([]);
  const [toggled, setToggled] = useState(false);
  const [requesterDictionary, setRequesterDictionary] = useState({});

  const { t } = useTranslation();

  const formUserObj = (data, coords, type) => {
    return {
      type: "Feature",
      properties: {
        firstName: data.firstName,
        lastName: data.lastName,
        checkrVerified: data.checkrVerified.toString(),
        zip: data.zipCode,
        email: data.email,
        phoneNumber: data.phoneNumber,
        city: data.city,
        createdBy: data.createdBy,
        geohash: data.geohash,
        type: type,
      },
      geometry: {
        type: "Point",
        coordinates: [coords.longitude, coords.latitude],
      },
    };
  };

  const ConvertRequestTypeToName = ({ type }) => {
    switch (type) {
      case VOLUNTEER:
        return "Volunteer";
      case OPEN_REQUEST:
        return "Open Request";
      case INVALID_REQUEST:
        return "Invalid Request";
      case COMPLETED_REQUEST:
        return "Completed Request";
      case CANCELLED_REQUEST:
        return "Cancelled Request";
      case FAILED_REQUEST:
        return "Failed Request";
      case ACCEPTED_REQUEST:
        return "Accepted Request";
      case PASSED_BACKGROUND:
        return "Passed Background Check";
      default:
        return "Error: this request type is not caught";
    }
  };

  const createRequestObj = (userData, coords, status, outcome) => {
    let type;
    if (status === "open") {
      type = OPEN_REQUEST;
    } else if (status === "closed") {
      if (outcome === "completed") {
        type = COMPLETED_REQUEST;
      } else if (outcome === "invalid") {
        type = INVALID_REQUEST;
      } else if (outcome === "cancelled" || outcome === "canceled") {
        type = CANCELLED_REQUEST;
      } else if (outcome === "failed") {
        type = FAILED_REQUEST;
      } else {
        type = INVALID_REQUEST;
      }
    } else if (status === "pending_fulfillment" || status === "accepted") {
      type = ACCEPTED_REQUEST;
    } else {
      type = INVALID_REQUEST;
    }

    let obj = formUserObj(userData, coords, type);
    return obj;
  };

  useEffect(() => {
    getData().then((data2) => {
      let requesterDictionary = {};
      let volunteers = [];
      let volunteersWithBGC = [];

      data2.Volunteers.docs.forEach((user) => {
        try {
          let coords = geohash.decode(user.data().geohash);
          let obj = formUserObj(user.data(), coords, VOLUNTEER);
          volunteers.push(obj);

          requesterDictionary[user.id] = user.data();
        } catch (e) {
          console.log(`Error: ${e}`);
        }
      });
      // we don't want to display all requesters, only those who have requests in our database
      let requesters = [];

      data2.Requesters.docs.forEach((user) => {
        try {
          requesterDictionary[user.id] = user.data();
        } catch (e) {
          console.log(`Error: ${e}`);
        }
      });
      data2.Requests.docs.forEach((request) => {
        try {
          let user = request.data().requester;
          if (!(user in requesterDictionary)) {
            console.log("User does not exist anymore: ", user);
          } else {
            // leaving Uber requests out of the map (can change this if need be)
            if (request.data().toBeFulfilledBy !== "UBER") {
              let userData = requesterDictionary[user];
              let coords = geohash.decode(request.data().geohash);
              // spoof address to prevent requests from the same location overlapping
              coords.latitude += Math.random() * 0.001;
              coords.longitude += Math.random() * 0.001;
              let status = request.data().status;
              let outcome = request.data().outcome;
              let obj = createRequestObj(userData, coords, status, outcome);

              requesters.push(obj);
            }
          }
        } catch (e) {
          console.log(`Error: ${e}`);
        }
      });

      //Background check users loop

      data2.Background.docs.forEach((item) => {
        try {
          let coords = geohash.decode(item.data().geohash);
          let obj = formUserObj(item.data(), coords, PASSED_BACKGROUND);
          volunteersWithBGC.push(obj);
        } catch (e) {
          console.log(`Error: ${e}`);
        }
      });
      setVolunteersVisible(volunteers);

      // we only want open and accepted requests to be showing  by default
      setRequestersVisible(
        requesters.filter(
          (request) =>
            request.properties.type === OPEN_REQUEST ||
            request.properties.type === ACCEPTED_REQUEST
        )
      );

      setVolunteers(volunteers);
      setBackgroundCheck(volunteersWithBGC);
      setRequesters(requesters);
      setRequesterDictionary(requesterDictionary);
    });
  }, []);

  const [viewport, setViewPort] = useState({
    width: "100%",
    height: 500,
    latitude: 39.8283,
    longitude: -98.5795,
    zoom: 3,
  });

  const _onViewportChange = (viewport) => setViewPort({ ...viewport });

  const _sourceRef = React.createRef();

  const _onClick = (event) => {
    const marker = event.features.find(
      (f) => f.layer.id === "unclustered-point"
    );
    const cluster = event.features.find((f) => f.layer.id === "clusters");
    if (marker) {
      if (
        marker.properties.type === VOLUNTEER ||
        marker.properties.type === OPEN_REQUEST ||
        marker.properties.type === CANCELLED_REQUEST ||
        marker.properties.type === COMPLETED_REQUEST ||
        marker.properties.type === FAILED_REQUEST ||
        marker.properties.type === INVALID_REQUEST ||
        marker.properties.type === ACCEPTED_REQUEST ||
        marker.properties.type === PASSED_BACKGROUND
      ) {
        setInspectedObj(marker.properties);
      }
    }
    if (cluster) {
      const feature = event.features[0];
      const clusterId = feature.properties.cluster_id;

      const mapboxSource = _sourceRef.current.getSource();

      mapboxSource.getClusterExpansionZoom(clusterId, (err, zoom) => {
        if (err) {
          return;
        }

        _onViewportChange({
          ...viewport,
          longitude: feature.geometry.coordinates[0],
          latitude: feature.geometry.coordinates[1],
          zoom,
          transitionDuration: 500,
        });
      });
    }
  };

  const deselectAll = () => {
    setVolunteersVisible([]);
    setBackgroundVisible([]);
    setShowVolunteers(false);
    setShowBackgroundCheck(false);
  };

  const toggleVolunteers = () => {
    if (!showVolunteers) {
      setVolunteersVisible(volunteers);
      setShowBackgroundCheck(false);
      setBackgroundVisible([]);
    } else {
      setVolunteersVisible([]);
      setShowBackgroundCheck(true);
      setBackgroundVisible(backgroundCheck);
    }
    setShowVolunteers(!showVolunteers);
  };
  const toggleVolunteersWithBGC = () => {
    if (!showBackgroundCheck) {
      setBackgroundVisible(backgroundCheck);
      setShowVolunteers(false);
      setVolunteersVisible([]);
    } else {
      setBackgroundVisible([]);
      setVolunteersVisible(volunteers);
      setShowVolunteers(true);
    }
    setShowBackgroundCheck(!showBackgroundCheck);
  };

  //currently PassedCheck request does not appear
  const toggleRequesterType = (type) => {
    // requests of this type currently visible
    let requests = requestersVisible.filter(
      (request) => request.properties.type === type
    );
    // this type is not currently visible
    if (requests.length === 0) {
      requests = requesters.filter(
        (request) => request.properties.type === type
      );
      let newVisibleRequests = requestersVisible.concat(requests);
      setRequestersVisible(newVisibleRequests);
      // this type is currently visible
    } else {
      setRequestersVisible(
        requestersVisible.filter((request) => request.properties.type !== type)
      );
    }
  };

  return (
    <div style={{ width: "100%" }}>
      <h2>Volunteers and requests</h2>
      <div className="grid-elements-buttons">
        <div className="bck-all-none">
          <Button.Group className="bt-group">
            <Button
              className={!showVolunteers ? "active-buttons" : "inactive-button"}
              onClick={toggleVolunteers}>
              All volunteers ({volunteers.length})
            </Button>
            <Button
              className={
                !showBackgroundCheck ? "active-buttons" : "inactive-button"
              }
              onClick={toggleVolunteersWithBGC}>
              Only with BGC ({backgroundCheck.length})
            </Button>
            <Button
              className={
                showVolunteers === false && showBackgroundCheck === false
                  ? "inactive-button"
                  : "active-buttons"
              }
              onClick={deselectAll}>
              None
            </Button>
          </Button.Group>
        </div>
        <div className="map-buttons">
          <RequestButton
            name="Open"
            color="blue"
            initState={true}
            onClick={() => toggleRequesterType(OPEN_REQUEST)}
          />
          <RequestButton
            name="Pending"
            color="teal"
            initState={true}
            onClick={() => toggleRequesterType(ACCEPTED_REQUEST)}
          />
          <RequestButton
            name="Completed"
            color="green"
            initState={false}
            onClick={() => toggleRequesterType(COMPLETED_REQUEST)}
          />
          <RequestButton
            name="Cancelled"
            color="orange"
            initState={false}
            onClick={() => toggleRequesterType(CANCELLED_REQUEST)}
          />
          <RequestButton
            name="Invalid"
            color="grey"
            initState={false}
            onClick={() => toggleRequesterType(INVALID_REQUEST)}
          />
          <RequestButton
            name="Failed"
            color="red"
            initState={false}
            onClick={() => toggleRequesterType(FAILED_REQUEST)}
          />
        </div>
      </div>
      {(inspectedObj.type === VOLUNTEER ||
        inspectedObj.type === OPEN_REQUEST ||
        inspectedObj.type === CANCELLED_REQUEST ||
        inspectedObj.type === COMPLETED_REQUEST ||
        inspectedObj.type === FAILED_REQUEST ||
        inspectedObj.type === INVALID_REQUEST ||
        inspectedObj.type === PASSED_BACKGROUND ||
        inspectedObj.type === ACCEPTED_REQUEST) && (
        <h1>{t("mapInspectedUser")}</h1>
      )}
      <Table definition className="table-map">
        <Table.Body>
          {Object.keys(inspectedObj).map((key) => (
            <Table.Row>
              <Table.Cell>{key}</Table.Cell>
              <Table.Cell>
                {key !== "type" ? (
                  inspectedObj[key]
                ) : (
                  <ConvertRequestTypeToName type={inspectedObj[key]} />
                )}
              </Table.Cell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table>

      <ReactMapGL
        {...viewport}
        mapboxApiAccessToken={PUBLIC_TOKEN}
        mapStyle="mapbox://styles/mapbox/light-v8"
        onViewportChange={_onViewportChange}
        interactiveLayerIds={[clusterLayer.id, unclusteredPointLayer.id]}
        onClick={_onClick}>
        <Source
          type="geojson"
          data={{
            type: "FeatureCollection",
            features: volunteersVisible.concat(
              requestersVisible,
              backgroundVisible
            ),
          }}
          cluster={true}
          clusterMaxZoom={14}
          clusterRadius={50}
          ref={_sourceRef}>
          <Layer {...clusterLayer} />
          <Layer {...clusterCountLayer} />
          <Layer {...unclusteredPointLayer} />
        </Source>
        <GeolocateControl
          style={geolocateStyle}
          positionOptions={{ enableHighAccuracy: true }}
          trackUserLocation={true}
        />
      </ReactMapGL>
    </div>
  );
}
