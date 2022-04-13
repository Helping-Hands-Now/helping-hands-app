import firebase from "firebase/app";
import "firebase/analytics";
import "firebase/auth";
import "firebase/database";
import "firebase/firestore";
import "firebase/functions";
import * as firebaseui from "firebaseui";
import { FirebaseConfig } from "./config/env-loader.js";

// New UI config that does not have phone auth
export const newUiConfig = {
  signInFlow: "popup",
  credentialHelper: firebaseui.auth.CredentialHelper.NONE,
  // We will display Google and Facebook as auth providers.
  signInOptions: [
    {
      provider: firebase.auth.EmailAuthProvider.PROVIDER_ID,
      requireDisplayName: false,
    },
    firebase.auth.GoogleAuthProvider.PROVIDER_ID,
    firebase.auth.FacebookAuthProvider.PROVIDER_ID,
  ],
};

// Old UI Config that has phone auth - preserved for backwards compatibility with signin
export const oldUiConfig = {
  signInFlow: "popup",
  credentialHelper: firebaseui.auth.CredentialHelper.NONE,
  // We will display Google and Facebook as auth providers.
  signInOptions: [
    {
      provider: firebase.auth.EmailAuthProvider.PROVIDER_ID,
      requireDisplayName: false,
    },
    firebase.auth.GoogleAuthProvider.PROVIDER_ID,
    firebase.auth.FacebookAuthProvider.PROVIDER_ID,
    {
      provider: firebase.auth.PhoneAuthProvider.PROVIDER_ID,
      recaptchaParameters: {
        type: "image",
        size: "invisible",
        badge: "bottomleft",
      },
    },
  ],
};

export default !firebase.apps.length
  ? firebase.initializeApp(FirebaseConfig)
  : firebase.app();
if (firebase.analytics) {
  firebase.analytics();
} else {
  console.warn("firebase's analytics method was not found");
}

const functions = firebase.functions();

if (process.env.NODE_ENV !== "production") {
  functions.useEmulator("localhost", 5002);
}

export const analytics = firebase.analytics();
export const db = firebase.firestore();

export const acceptRequest = functions.httpsCallable("acceptRequest");
export const addAdmin = functions.httpsCallable("addAdmin");
export const getAdmins = functions.httpsCallable("getAdmins");
export const queryAdminRecords = functions.httpsCallable("queryAdminRecords");
export const makeUserAdmin = functions.httpsCallable("makeUserAdmin");
export const performAdminAction = functions.httpsCallable("performAdminAction");
export const closeRequestGivenOutcome = functions.httpsCallable(
  "closeRequestGivenOutcome"
);
export const createOrganization = functions.httpsCallable("createOrganization");
export const editOrganization = functions.httpsCallable("editOrganization");
export const deleteOrganization = functions.httpsCallable("deleteOrganization");
export const queryOrganizations = functions.httpsCallable("queryOrganizations");
export const queryUserOrganizations = functions.httpsCallable(
  "queryUserOrganizations"
);
export const getUserOrgMemberships = functions.httpsCallable(
  "getUserOrgMemberships"
);
export const createVolunteerOfOrganization = functions.httpsCallable(
  "createVolunteerOfOrganization"
);
export const editVolunteerOfOrganization = functions.httpsCallable(
  "editVolunteerOfOrganization"
);
export const createRecipientOfOrganization = functions.httpsCallable(
  "createRecipientOfOrganization"
);
export const importRecipientsOfOrganization = functions.httpsCallable(
  "importRecipientsOfOrganization"
);
export const editRecipientOfOrganization = functions.httpsCallable(
  "editRecipientOfOrganization"
);
export const deleteRecipientOfOrganization = functions.httpsCallable(
  "deleteRecipientOfOrganization"
);
export const queryOrganizationRecipients = functions.httpsCallable(
  "queryOrganizationRecipients"
);
export const createRequestsForOrganization = functions.httpsCallable(
  "createRequestsForOrganization"
);
export const queryOrganizationRequests = functions.httpsCallable(
  "queryOrganizationRequests"
);
export const createRecipientPlusRequest = functions.httpsCallable(
  "createRecipientPlusRequest"
);
export const closeOrganizationRequestWithOutcome = functions.httpsCallable(
  "closeOrganizationRequestWithOutcome"
);
export const checkExistingOrgMember = functions.httpsCallable(
  "checkExistingOrgMember"
);
export const markTripAsResubmitted = functions.httpsCallable(
  "markTripAsResubmitted"
);
export const cancelUberTrip = functions.httpsCallable("cancelUberTrip");
export const cancelLyftPath = functions.httpsCallable("cancelLyftPath");
export const getLyftOrderData = functions.httpsCallable("getLyftOrderData");
export const createSupplier = functions.httpsCallable("createSupplier");
export const querySuppliers = functions.httpsCallable("querySuppliers");
export const deleteSupplier = functions.httpsCallable("deleteSupplier");
export const editSupplier = functions.httpsCallable("editSupplier");
export const importSuppliers = functions.httpsCallable("importSuppliers");
export const querySupplierTimeZone = functions.httpsCallable(
  "querySupplierTimeZone"
);
export const cancelHelpOffer = functions.httpsCallable("cancelHelpOffer");
export const hasExceededCancelHelpLimit = functions.httpsCallable(
  "hasExceededCancelHelpLimit"
);
export const createProfile = functions.httpsCallable("createProfile");
export const createRequest = functions.httpsCallable("createRequest");
export const cancelRequest = functions.httpsCallable("cancelRequest");
export const queryOpenRequests = functions.httpsCallable("queryOpenRequests");
export const queryPastRequests = functions.httpsCallable("queryPastRequests");
export const queryPendingRequests = functions.httpsCallable(
  "queryPendingRequests"
);
export const queryRequestRetries = functions.httpsCallable(
  "queryRequestRetries"
);
export const queryVolunteersNear = functions.httpsCallable(
  "queryVolunteersNear"
);
export const queryNumberOfVolunteersNear = functions.httpsCallable(
  "queryNumberOfVolunteersNear"
);
export const updateProfile = functions.httpsCallable("updateProfile");
export const checkExistingOrgVolunteer = functions.httpsCallable(
  "checkExistingOrgVolunteer"
);
export const lookupNeighborhood = functions.httpsCallable("lookupNeighborhood");
export const addLocationToRequests = functions.httpsCallable(
  "addLocationToRequests"
);
export const validateAddress = functions.httpsCallable("validateAddress");
export const generateGoogleMapsRoute = functions.httpsCallable(
  "generateGoogleMapsRoute"
);

export const getOptimizedWaypointOrder = functions.httpsCallable(
  "getOptimizedWaypointOrder"
);

export const getUsers = functions.httpsCallable("getUsers");
export const getUserCreationData = functions.httpsCallable(
  "getUserCreationData"
);
export const sendThankYouText = functions.httpsCallable("sendThankYouText");
export const closeRequest = functions.httpsCallable("closeRequest");
export const cancelHelperFromRequest = functions.httpsCallable(
  "cancelHelperFromRequest"
);
export const getStripePaymentIntention = functions.httpsCallable(
  "getStripePaymentIntention"
);
export const saveStripeDonationDetails = functions.httpsCallable(
  "saveStripeDonationDetails"
);
export const sendBGC = functions.httpsCallable("sendBGC");
export const sendBGCNextStep = functions.httpsCallable("sendBGCNextStep");
export const getInspectedRequestData = functions.httpsCallable(
  "getInspectedRequestData"
);
export const cancelDeliveryEvent = functions.httpsCallable(
  "cancelDeliveryEvent"
);
export const getUberOrderData = functions.httpsCallable("getUberOrderData");
export const createCommunityDeliveryEvent = functions.httpsCallable(
  "createCommunityDeliveryEvent"
);
export const editCommunityDeliveryEvent = functions.httpsCallable(
  "editCommunityDeliveryEvent"
);
export const signUpPartnerVolunteerForCommunityDeliveryEvent = functions.httpsCallable(
  "signUpPartnerVolunteerForCommunityDeliveryEvent"
);
export const signUpForCommunityDeliveryEvent = functions.httpsCallable(
  "signUpForCommunityDeliveryEvent"
);
export const getCommunityDeliveryEventDetailsForOrg = functions.httpsCallable(
  "getCommunityDeliveryEventDetailsForOrg"
);
export const leaveCommunityDeliveryEvent = functions.httpsCallable(
  "leaveCommunityDeliveryEvent"
);
export const unassignCommunityDelivery = functions.httpsCallable(
  "unassignCommunityDelivery"
);
export const checkIntoCommunityDeliveryEvent = functions.httpsCallable(
  "checkIntoCommunityDeliveryEvent"
);
export const queryCommunityDeliveryEvents = functions.httpsCallable(
  "queryCommunityDeliveryEvents"
);
