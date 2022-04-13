var functions = require("firebase-functions"); // Need to initialize this no matter what

// Note: if we update these, we should also
// update them in the frontend validation too
const amountMin = 1; // $1
const amountMax = 1000000 - 0.01; // $1M - $0.01
// we store these separately above for easier
// logging messages vs. actual comparisons
const amountInCentsMin = amountMin * 100;
const amountInCentsMax = amountMax * 100;

async function saveStripeDonationDetails(db, data, context) {
  return db
    .collection("donations")
    .add({
      paymentId: data.paymentId,
      createdAt: new Date().getTime(),
      email: data.email,
      cardHolderName: data.cardHolderName,
      amount: data.amount,
      apartment: data.apartment,
      street: data.street,
      city: data.city,
      state: data.state,
      zip: data.zip,
    })
    .catch(function (error) {
      console.error(
        "Error writing document for payment amount " +
          amount +
          " and email " +
          email +
          ": ",
        error
      );
    });
}

async function getStripePaymentIntention(data, context) {
  const amount = data.amount;
  const email = data.email;

  // first check if amount is numeric
  if (isNaN(amount) || !amount) {
    throw new Error(
      "Invalid amount provided [" + amount + "] for user with email " + email
    );
  }

  // NOTE: we should disallow any further than 2 decimals, so
  // it should be equivalent to do Math.floor/ceil/round/trunc
  // but we could add extra protection to be safe
  const amountInCents = Math.round(parseFloat(amount) * 100);

  // now check if the amount is out of the valid bounds
  // of [1, 1M)
  if (amountInCents < amountInCentsMin || amountInCents > amountInCentsMax) {
    throw new Error(
      "Invalid amount provided [" +
        amount +
        "] for user with email " +
        email +
        ". Must be within bounds [" +
        amountMin +
        ", " +
        amountMax +
        "]"
    );
  }

  const stripeSecretKey = functions.config().stripe.secretkey;
  const stripe = require("stripe")(stripeSecretKey);

  return stripe.paymentIntents
    .create({
      amount: amountInCents,
      currency: "usd",
      description: "Payment to Now Helping Hands (EIN: 85-0825195)",
      receipt_email: email,
      metadata: { integration_check: "accept_a_payment" },
    })
    .catch(function (error) {
      console.error(
        "Error creating payment intention for payment amount " +
          amount +
          " and email " +
          email +
          ": ",
        error
      );
    });
}

module.exports = {
  saveStripeDonationDetails,
  getStripePaymentIntention,
};
