import React, { useState, useEffect } from "react";
import { db } from "../../firebase.js";
import { Loader } from "semantic-ui-react";

import AdminRequestListData from "./data";

export default function AdminRequestList({ mode }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadRequestData = () => {
    let statuses = [];

    switch (mode) {
      case "active":
        statuses = ["open", "pending_acceptance", "pending_fulfillment"];
        break;
      case "closed":
        statuses = ["closed", "cancelled"];
        break;
      default:
        throw new Error("invalid mode passed");
    }

    db.collection("requests")
      .where("status", "in", statuses)
      .where("toBeFulfilledBy", "==", "VOLUNTEER")
      .get()
      .then((r) => {
        Promise.all(
          r.docs.map(async (requestDoc) => {
            let request = requestDoc.data();
            request.id = requestDoc.id;
            let isRobo = request.createdBy !== request.requester;

            let adminMetaData = await db
              .collection("requests")
              .doc(requestDoc.id)
              .collection("admin")
              .doc("metaData")
              .get();

            await db
              .collection("users")
              .doc(request.createdBy)
              .get()
              .then((user) => {
                request.creator = user.data();
              })
              .catch((e) => {
                console.log("Unable to get creator data: ", e);
              });

            if (isRobo) {
              await db
                .collection("users")
                .doc(request.requester)
                .get()
                .then((user) => {
                  request.state = user.data().state;
                  request.requesterFullName =
                    user.data().firstName + " " + user.data().lastName;
                })
                .catch((e) => {
                  request.requesterFullName = "";
                  console.log("Unable to get requester data: ", e);
                });
            }

            if (adminMetaData) {
              request.adminData = adminMetaData.data();
            }
            return request;
          })
        )
          .then((data) => {
            setLoading(false);
            setRequests(data);
          })
          .catch(function (error) {
            console.log("Error getting documents: ", error);
          });
      });
  };

  useEffect(() => {
    loadRequestData();
    setLoading(true);
  }, [mode]);

  return (
    <div>
      {loading ? (
        <Loader active inline="centered" content="Loading Requests" />
      ) : (
        <AdminRequestListData
          requests={requests}
          options={{ mode, canChangeStatus: true }}
        />
      )}
    </div>
  );
}
