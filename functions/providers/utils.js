const PROJECT_ID = Object.freeze({
  PROD: "helping-hands-community",
  DEV: "helping-hands-development",
});

const METHODS = Object.freeze({
  DELETE: "DELETE",
  GET: "GET",
  PATCH: "PATCH",
  POST: "POST",
  PUT: "PUT",
});

const PROVIDERS = Object.freeze({
  UBER: "UBER",
  LYFT: "LYFT",
  AXELHIRE: "AXELHIRE",
  OTHERS: "N/A",
});

const REQUEST_STATUS = Object.freeze({
  OPEN: "open",
  ASAP: "asap_fulfillment",
  PENDING: "pending_fulfillment",
  PENDING_ACCEPTANCE: "pending_acceptance",
  CLOSED: "closed",
  CANCELLED: "cancelled",
  ERROR: "error",
});

module.exports = {
  PROJECT_ID,
  METHODS,
  PROVIDERS,
  REQUEST_STATUS,
};
