# Lyft

This document is a bird's eye view of Lyft integration.
This integration may serve as a stub for future logistic integrations.

To make the integration, it's important
to keep in mind the separations of concerns criteria.
This principle will help us debug problems both in the software
and the operation side.

We have four concerns:

1. Prepare Shipment Requests.
2. Batch Requests
3. Lyft API
4. Front End Changes

## 1. Prepare Shipment Requests

This concern to read requests from the database, and prepare them
for the Lyft API.

This flow may run every few minutes.

Below an example of Firebase Scheduled Functions.

```javascript
exports.scheduledFunction = functions.pubsub
  .schedule("every 5 minutes")
  .onRun((context) => {
    console.log("This will be run every 5 minutes!");
    return null;
  });
```

See the `Schedule` section in the Uber documentation.

### Read Requests from Firestore

This logic refers to reading the requests that need to be
fulfilled in the next minutes.

Sample query inspired by our Uber integration.

```javascript
const ten_minutes_from_now = moment().add(10, "minutes").valueOf();
const MAX_REQUESTS = 50;
db.collection("requests")
  .where("toBeFulfilledBy", "==", "LYFT")
  .where("status", "in", ["open", "asap_fulfillment"])
  .where("scheduledPickupTime", "<=", startTime)
  .limit(MAX_REQUESTS)
  .get();
```

This query will return an array of requests:

```javascript
[{
  ...fields
  zipCode: '99019',
  status: 'open',
  requesterFirstName: 'Helping',
  geohash: 'c2kxpp4tuutpw63zuqmq5n000000000000000000000000000000',
  requester: 'G5FV66BZcsBvnRljILwb',
  aboutUser: '',
  organizationId: 'FaagixS793RRkO9hOaN7',
  languages: [ 'en-US' ],
  createdBy: 'Hq56xwQ2XfR645ZVVpAFOQyNCZo2',
  outcome: 'cancelled',
  needs: 'test',
  toBeFulfilledBy: 'LYFT'
  },
  {
    ...
  }
]
```

Only a few of these keys are valuable to us,
therefore we would need to destruct each object to get
only the variables we need.

We may need to perform another query, like querying
for the `user` to get this address.

See the `Load Request Data` section in the Uber document.

### Get Lat/Lng

We can use Google Places API here, to get
latitude and longitude for both the source and destination address.

With a `human` address, we can get a Place Id from Google Places and also
the lat/lng.

We may also update the user Place Id into the `users` collection
to avoid this step in the future.

In the current requests, we are storing a `geohash`, which naturally may be translated into lat/lng coordinates. We would
need to determine if this `geohash` relates to a Google Place Id.

See the `Validate Address` section in the Uber document.

### Object Schema Validation

We may use a package like [joi](https://www.npmjs.com/package/joi)
to verify the schema of the objects in the array.

For each object in the array we should expect the following fields:

```javascript
{
  requestId: 'mmlkwon934j=='
  srcLat:, 37.777,
  srcLng: 122.4194,
  dstLat: 37.778,
  dstLng: 122.419773,
  scheduledTime: 1604605292,
  status: 'toBeBatched'
}
```

If an object does not meet the schema validation,
it won't be moved forward to the pipeline.

The current Uber integration does not perform schema validation.

### Write Lyft Requests to Firestore

In a collection named `lyft_orders`
we should now persist each of the validated objects.

This collection will serve as the ground for the Batching and Lyft API following stages.

## 2. Batch Algorithm

Unlike the Uber eats API, Lyft allows creating
a `Delivery Path` that encompasses multiple stops.

A `Delivery Path` starts with a pick-up location, and
it has at least 2 more stops. These stops can be either
`pickup` or `dropoff`

If the route has only one pickup and one drop off,
then it's a regular `Delivery Order` like the one we used
with Uber. The planning of this approach is simple, but
it doesn't pinch pennies.

We could use a K-Means clustering algorithm 2 to depict
areas in the map where a delivery person should go. The capacity
of a normal rider is about 5 packages.

We have 2 different situations.

### Community Delivery

In this situation, we have one supplier, which we call the source vertex, and many destinations.

The supplier is a pickup point, and the requesters are dropoff points.

![community Delivery](https://user-images.githubusercontent.com/1905839/98296212-5dd6a880-1f91-11eb-9d2b-8e3e566112bd.png)

### Enterprise Console

This is where things get complex. The squares depict
pickup locations,
the round shapes indicate dropoff locations.

![EC](https://user-images.githubusercontent.com/1905839/98297124-b490b200-1f92-11eb-95a0-f0023fea3592.png)

### Sequence Order within the Cluster

Once the areas are depicted, we would need to
define the multi-stop routes. Again, this is not
an easy problem because there are many permutations/ways
to plan the route.

## 3. Lyft API

Once we have the routes ready, we can
create the Delivery Paths.

For each Delivery Path, **optionally**, we would need to get a quote or Generate a Price first. Doing this will optionally allow us to include an `offer_token` on the Delivery Path creation.

For simplicity, we may skip the quoting functionality in the first
development stages. We would need to discuss with the Lyft team about
best practices to create an Order. Besides, a quote may serve
us, in the future, to compare different logistic providers.
Currently, we're getting a quote in the Uber API by creating a `Delivery Estimate`,
then passing its id on creating the delivery.

### Authentication

Lyft API is authenticated through an OAuth2 Access/Bearer token.
To get the Bearer token, we must first acquire a `refresh-token`
on the Lyft [website](https://lyft.com/developers/apps).

The Bearer token expires every 60 minutes, so we must refresh this token accordingly. Similar logic is implemented with Uber API.

Naturally, every HTTP requests to this API should include an **Authorization
HTTP Header**:

```
Authorization: Bearer <ACCESS_TOKEN>
```

For more information refer to the Lyft Authentication [docs](https://developer.lyft.com/docs/authentication). Specifically see the refreshing the access token [section](https://developer.lyft.com/docs/authentication#section-step-5-refreshing-the-access-token).

### HTTP Request Library

At the moment, Uber integration is using the `request` package
for making HTTP requests, which is deprecated.

We would need to pick another library. See a comparison
(here)][https://www.npmjs.com/package/got#comparison].
`got` and `axios` seem like popular choices.

### Request Rides methods

Lyft API offers different alternatives on how to Create
an Order or Delivery Path.

- Single stop - rate card per area, simplest and recommended we start there

- Multi-stop - pricing not ; can provide free form or route. They said up to 10 per order (technically 15 possible but not recommended). Do not have package dimension limits, but do have weight. Assume sedans for all rides

- Batching with up front pricing - we provide a list of orders, they batch and tell us within 30 minutes which ones they can do at set price (based on supply)

- Batching with no pricing constraint - will deliver all from a list provided but at variable price

### Metering

Meter starts after the driver arrives at the pickup site and hits "I'm parked" to go get package
If using upfront price, time and miles start at that point
Different from Uber, which is after driver leaves pick up site

### Cancellations

On canceling or rejecting, we should
pass cancellation codes to the Lyft API.

Example codes:

- Driver cancel option to get resubmitted up to 3 times, if prior to pick up and 15 min. Driver cancel will not be re-dispatched if it's after pick up

- No supply

- Admin (HHC) cancel

### Order Statuses

A Lyft Order has a natural **lifecycle**. At any time, an order must be in one of the following 7 stages or statuses:

1. pending
   - accepted
   - canceled
   - failed
2. accepted
   - pending
   - arrived_pickup
   - failed
3. arrived_pickup
   - picked_up
   - failed
4. picked_up
   - dropped_of
   - failed
5. dropped_off
6. canceled
7. failed

Note that some status has **transitions** or nested states which probably
appear in the `status` field.
For example, instead of seeing
this for the `accepted_pending` state:

```javascript
{
  status: "accepted_pending";
}
```

Perhaps we see something as below, which can be a bit misleading:

```javascript
{
  status: "pending";
}
```

However different fields will appear in the order status
depending on the specific state the order finds in. For instance,
the 'driver' field will appear if the order is in these states
`{accepted, arrived_pickup, picked_up }`:

```javascript
{
  "driver": { // status in (accepted, arrived_pickup, picked_up)
    "first_name": "Jane",
    "phone_number": "+16505556789"
  }
}
```

The order status can be acquired in two ways depicted in the next section.

### Polling vs Hooks

We would need to determine whether to use polling or
Webhook to update the delivery status.

Lyft API can be configured to call one of our Firebase
functions for events updates in a given order.

The event data received in the Webhook is _exactly_ the same
as a call to `/v1/delivery/orders/$id`.

## 4. Front End Changes

We need to figure out which front end pages
in Enterprise Console are currently tied
to the Uber API.

Then, we would need to define which variables
concerning Lyft order we would want to show in the Front end.

## Notes

Helpful links:

- [Uber](https://drive.google.com/drive/folders/1m2XSnBMleXw-l6VMZtw0qPjYBH-sy90g) eats API.
- [Lyft](https://helping-hands-community.atlassian.net/browse/HH-853) Delivery API Reference can be found in the JIRA posted link. Please note there are 2 documentation files for the Lyft API.
