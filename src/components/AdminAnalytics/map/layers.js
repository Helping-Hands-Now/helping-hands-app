export const clusterLayer = {
  id: "clusters",
  type: "circle",
  filter: ["has", "point_count"],
  paint: {
    "circle-color": [
      "step",
      ["get", "point_count"],
      "#51bbd6",
      100,
      "#f1f075",
      750,
      "#f28cb1",
    ],
    "circle-radius": ["step", ["get", "point_count"], 20, 100, 30, 750, 40],
  },
};

export const clusterCountLayer = {
  id: "cluster-count",
  type: "symbol",
  filter: ["has", "point_count"],
  layout: {
    "text-field": "{point_count_abbreviated}",
    "text-font": ["DIN Offc Pro Medium", "Arial Unicode MS Bold"],
    "text-size": 12,
  },
};

export const unclusteredPointLayer = {
  id: "unclustered-point",
  type: "circle",
  filter: ["!", ["has", "point_count"]],
  paint: {
    "circle-color": {
      property: "type",
      stops: [
        [0, "rgba(255, 255, 255, 0)"], // volunteer
        [1, "#2185D0"], // open request
        [2, "#d53e4f"], // was already here - not sure what it's for
        [3, "#757575"], // invalid request
        [4, "#DB2829"], // failed request
        [5, "#21BB45"], // completed request
        [6, "#F2701D"], // cancelled request
        [7, "#00B5AD"], // accepted request
        [8, "#A333C9"], // with BGC
      ],
    },
    "circle-radius": 4,
    "circle-stroke-width": {
      property: "type",
      stops: [
        [0, 4], // volunteer
        [1, 1], // open request
        [2, 1], // was already here - not sure what it's for
        [3, 1], // invalid request
        [4, 1], // failed request
        [5, 1], // completed request
        [6, 1], // cancelled request
        [7, 1], // accepted request
        [8, 1], // with BGC
      ],
    },
    "circle-stroke-color": {
      property: "type",
      stops: [
        [0, "#A333C9"], // volunteer
        [1, "#fff"], // open request
        [2, "#fff"], // was already here - not sure what it's for
        [3, "#fff"], // invalid request
        [4, "#fff"], // failed request
        [5, "#fff"], // completed request
        [6, "#fff"], // cancelled request
        [7, "#fff"], // accepted request
        [8, "#fff"], // with BGC
      ],
    },
  },
};
