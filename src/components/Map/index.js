import React, { useState } from "react";
import MapGL, { GeolocateControl } from "react-map-gl";
import "mapbox-gl/dist/mapbox-gl.css";

const TOKEN =
  "pk.eyJ1IjoicGF0aWwxMjUiLCJhIjoiY2s3bDlsdGRsMDU1eTNtcW9xYmN2dm80biJ9.PXGsgn9C66CrXsxvxqT6oA";

const geolocateStyle = {
  float: "left",
  margin: "50px",
  padding: "10px",
};

export default function Map() {
  const [viewport, setViewPort] = useState({
    width: "100%",
    height: 900,
    latitude: 0,
    longitude: 0,
    zoom: 2,
  });

  const _onViewportChange = (viewport) => setViewPort({ ...viewport });

  const _onPanEnd = () => {
    console.log("pan end");
  };

  return (
    <div style={{ margin: "0 auto" }}>
      <MapGL
        {...viewport}
        mapboxApiAccessToken={TOKEN}
        mapStyle="mapbox://styles/mapbox/light-v8"
        onViewportChange={_onViewportChange}
        onPanEnd={_onPanEnd}>
        <GeolocateControl
          style={geolocateStyle}
          positionOptions={{ enableHighAccuracy: true }}
          trackUserLocation={true}
        />
      </MapGL>
    </div>
  );
}
