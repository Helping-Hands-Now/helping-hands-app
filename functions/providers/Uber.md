# Uber

This document explains the current Uber integration
implemented in `uber.js`

## Schedule

The function `createUberRequests` and `checkUberOrderStatuses`
are being called every 5 minutes in the main file
`functions/index.js`

Note that `checkUberOrderStatuses` is receiving as argument a
`context` object which is not being used.

```js
// create uber requests if we need one (asap by default)
exports.createUberRequests = functions.pubsub
  .schedule("every 5 minutes")
  .onRun((context) => {
    var { createUberRequests } = require("./providers/uber");
    return createUberRequests(db);
  });

// check status of any active rides
exports.checkUberOrderStatuses = functions.pubsub
  .schedule("every 5 minutes")
  .onRun((context) => {
    var { checkUberOrderStatuses } = require("./providers/uber");
    return checkUberOrderStatuses(db, context);
  });
```

## Meaningful functions

Below are some meaningful functions that
are involved in the Uber integration flow.

### Validate Address

This function is located at `address/index.js`.

It receives an address with the following fields:

- **street**
- **city**
- **state**
- **zip**
- apartment

With the parameters above, it calls
Google Maps API to build the following object:

```javascript
{
  formatted_address: res.formatted_address,
  lat: res.lat,
  lng, res.lng,
  geohash: geohash.encode(lat, lng),
  placeId: res.placeId // Google Place Id
}
```

The following addendum gives an idea of
how geohash library works:

```javascript
console.log(geohash.encode(37.8324, 112.5584));
// prints ww8p1r4t8
var latlon = geohash.decode("ww8p1r4t8");
console.log(latlon.latitude);
console.log(latlon.longitude);
```

### Find Deliverable Store

Endpoint: `v1/eats/deliveries/estimates`

`findDeliverableStore` is a simple function that calls Uber API,
to exchange a Google Place Id for a Uber Store Id.

We send in a Supplier Google Place Id, and we take
the first element of the returned array of Uber stores.

### Create Requests Implementation

This function process an array of HH requests.
For each request, calls `createDeliveryEstimate` first,
then calls `createDelivery`.

After the call to createDelivery, if everything went well, we have successfully created the pair
(deliveryOrder, Request). In other words, the order
is ready for the request.

Then we do the following persistent operations:

- In `users` collection we **update** Google Place Id and Geohash for the recipient user.

- In `uber_estimates` collection we **create** a new document
  containing the delivery info from `reateDeliveryEstimate`.

- In `uber_orders` collection we **create** a new document
  containing the `orderInfo` from `createDelivery`.

- In `requests` collection we **update** the following fields of the present request:

```javascript
{
  uberStatus: "ACTIVE",
  status: "pending_full"
}
```

- A Similar thing should happen in `retries` collection,
  but it seems this function is deprecated since there
  is no such collection currently.

### Create Delivery Estimate

Endpoint: `v1/eats/deliveries/estimates`

`createDeliveryEstimate` is sending the following `POST`
request body:

```javascript
{
  pickup: {store_id: supplier.uberStoreId},
  dropoff_address: {
    place: {
      id: recipient.placeId,
      provider: 'google_places'
    },
  },
  pickup_times: []//ASAP or future
}
```

Then, Uber API is returning the following response:

```javascript
{
  estimateId: res.estimate_id,
  deliveryInfo: {
    estimateId: res.estimate_id,
    requestId: request.id // HH
    deliveryFee: res.estimates[0].delivery_fee,
    // total: 400, currency_code: USD, line_items: [{fee_code:FLAT_FEE, value: 400}]
  },
  updateRecipientInfo
  // ComesFrom validateAddress, geohash and Google PlaceId
}
```

### Create Delivery

This section contains a simplification of
the `createDelivery` function.

Endpoint: `v1/eats/deliveries/orders`

`createDelivery` function is sending the following `POST` body:

```javascript
{
  external_order_id: HHId,//HH id includes the number of retries.
  order_value: 1500, //$15
  currency_code: "USD",
  order_items: [
    {
      name: "food bank item",
      description: "food bank item",
      external_order_id: HHId, // same as above,
      quantity: 1, // or number of recipients,
      price: 1500,
      currency_code: "USD",
    },
  ],
  pickup: {
    store_id: uberStoreId,
    external_store_id: supplier.id // HH Supplier id,
    instructions:
      supplier.pickUpInstructions || "Look for...",
  },
  dropoff: {
    address: {
      apt_floor_suite: recipient.apartment,
      place: {
        id: recipient.placeId,
        provider: "google_places",
      },
    },
    contact: {
      first_name: recipient.firstName,
      last_name: recipient.lastName,
      email: "",
      phone: recipient.phoneNumber,
    },
    type: 'LEAVE_AT_DOOR',
    instructions: recipient.dropoffInstructions || "Call ...",
  }
  pickup_at: 0,// Either ASAP or some time in the future,
  estimate_id: estimateId, // Previous Uber API Call
  courier_tip: 0,
  external_user_id, request.recipient.id // HH
}
```

`createDelivery` is constructing the following object built upon Uber API POST Response:

```javascript
{
  orderId: res.order_id,
  orderInfo: {
    estimateId: estimateId, // Previous Uber Request
    requestId: request.id, // HH Request Id
    orderId: res.order_id, // Uber Orderid,
    fullFee: res.fullFee,
    orderStatus: res.order_status || "ACTIVE",
    uberRetries: retries,
    pickupTime: 0// Either ASAP or some time in the future
  }
}
```

### Load Request Data

A query in the `requests` collection is an argument to the function `loadRequestData` in `requests/index.js`. The query may look like this:

```javascript
db.collection("requests")
  .where("toBeFulfilledBy", "==", "UBER")
  .where("status", "in", ["open", "asap_fulfillment"])
  .where("scheduledPickupTime", "<=", startTime);
```

A typical request document has the following fields:

```javascript
{
  "aboutUser": "This is a person in need... Organization Wider Circle 233",
  "closingVerifiedTextTimeSent": null,
  "createdBy": "67OHhTJ503aQICBWuQFee2BsW203",
  "geohash": "9q8yyzv29hy7wr2rbpjtwqbpbpbpbpbpbpbpbpbpbpbpbpbpbpbp",
  "helper": null,
  "languages": [],
  "needs": "food bank item for organization Wider Circle 233",
  "notificationTimes": {},
  "organizationId": "PTiASye7MV6bh2tMPjo0",
  "outcome": "cancelled",
  "reminderTextTimeSent": null,
  "requester": "s9QibS2eNOX1GXNMy1eW",
  "requesterFirstName": "Jon ",
  "scheduledPickupTime": 1604709786186,
  "status": "open",
  "supplier": "dDZmDqeI2YtdlBQMfE45",
  "timeAccepted": null,
  "timeClosed": {},
  "timeCreated": {},
  "timeUpdated": 1602886571369,
  "toBeFulfilledBy": "UBER",
  "uberStatus": "TO_BE_SCHEDULED",
  "zipCode": 94114
}
```

We passed a Promise of lists of requests documents to `loadRequestData`.

This method queries the nested recipients/requester (`users`) and the nested suppliers (`suppliers`). Hence, for each request we now have three new fields:

- **recipient**: Points to the full collection of the user in the **requester** field.

- **supplier**: Points to the full collection of the supplier original field. In this case the supplier document Id is entirely
  replaced by the supplier object collection.

- **id**: Point to the Firestore request document id.

One of the elements of the newly formed `requests`
array will look like this:

```javascript
{
  "aboutUser": "This is a person in need... Organization Wider Circle 233",
  "closingVerifiedTextTimeSent": null,
  "createdBy": "67OHhTJ503aQICBWuQFee2BsW203",
  "geohash": "9q8yyzv29hy7wr2rbpjtwqbpbpbpbpbpbpbpbpbpbpbpbpbpbpbp",
  "helper": null,
  "id": "0BEpwiujNe8mmENAvQai", // Added field
  "languages": [],
  "needs": "food bank item for organization Wider Circle 233",
  "notificationTimes": {},
  "organizationId": "PTiASye7MV6bh2tMPjo0",
  "outcome": "cancelled",
  "recipient": { // Added recipient
    "aboutUser": "",
    "createdBy": "67OHhTJ503aQICBWuQFee2BsW203",
    "geohash": "9q8yyztrgwwv19ejshbd29pbpbpbpbpbpbpbpbpbpbpbpbpbpbpb",
    "id": "s9QibS2eNOX1GXNMy1eW",
    "languages": [],
    "timeCreated": {},
    "timeUpdated": {},
    "zipCode": 94114
  },
  "reminderTextTimeSent": null,
  "requester": "s9QibS2eNOX1GXNMy1eW",
  "requesterFirstName": "Jon ",
  "scheduledPickupTime": 1604709786186,
  "status": "open",
  "supplier": { // Replaced field
    "geohash": "9v6kk7613uhcd9bg9p026uxbpbpbpbpbpbpbpbpbpbpbpbpbpbpb",
    "id": "dDZmDqeI2YtdlBQMfE45",
    "organizationId": "PTiASye7MV6bh2tMPjo0",
    "zipCode": "78733"
  },
  "timeAccepted": null,
  "timeClosed": {},
  "timeCreated": {},
  "timeUpdated": 1602886571369,
  "toBeFulfilledBy": "UBER",
  "uberStatus": "TO_BE_SCHEDULED",
  "zipCode": 94114
}
```

Caveat: The above two JSON objects were obtained from Duck development
enviroment. Production objects should contain other fields
like `uberRetries`.

## Firestore Uber

Below a description of the state or collections we use for the Uber API **directly**.

###### `uber_estimates` collection

This collection holds the following elements:

- deliveryFee. This is a nested item, that contains a `currency_code` (USD), `line_items` and `total`. `line_tems` is an array that the first element contains a `fee_code` and `value` fields. There seems to be `DISTANCE_FEE` and `FLAT_FEE` `fee_code` variants currently in production Firestore.

- estimateId

- requestId

###### `uber_orders` collection

This collection holds the following elements:

- estimateId

- fullFee: Similar to the `deliveryFee` field of `uber_estimates`

- orderId

- orderStatus

- pickUpTime

- requestId

###### `uber_tokens` collection

This collection holds the following elements:

- expiresIn

- timeCreated

- token
