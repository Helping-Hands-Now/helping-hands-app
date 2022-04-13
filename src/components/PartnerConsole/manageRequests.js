import React, { useState, useEffect } from "react";
import UIButton from "../UI/UIButton";
import { useTranslation } from "react-i18next";
import AdminRequestListData from "../AdminRequestList/data";
import { Container } from "semantic-ui-react";
import CreateRequest from "./../CreateRequest";
import SuccessModal from "../SuccessModal";

import {
  createRecipientPlusRequest,
  queryOrganizationRequests,
  closeOrganizationRequestWithOutcome,
} from "../../firebase";

export default function ManageRequests({ currentOrg, mode }) {
  const [showCreate, setShowCreate] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [requests, setRequests] = useState([]);

  const { t } = useTranslation();

  const createRequest = () => {
    setShowCreate(true);
  };

  const fetchRequests = () => {
    let data = [];
    queryOrganizationRequests({
      orgId: currentOrg,
      consoleType: "partner", // we only want the fetch request in closeOrganizationRequestWithOutcome running if the requesting console is partner
    }).then((r) => {
      return Promise.all(
        r.data.map(async (request) => {
          // TODO HH-327 better to create an index for this
          if (request.status === "closed" || request.status === "cancelled") {
            if (mode === "active") {
              return;
            }
          } else {
            if (mode !== "active") {
              return;
            }
          }
          data.push(request);
        })
      ).then(() => {
        setRequests(data);
      });
    });
  };

  const onRequestCreate = () => {
    // reload requests and new request should be top of the list
    fetchRequests();

    setShowCreate(false);
    setShowSuccess(true);
  };

  const onCloseSuccess = () => {
    setShowSuccess(false);
  };

  useEffect(() => {
    if (currentOrg) {
      fetchRequests();
    }
  }, [currentOrg, mode]);

  const createRecipientHandler = (profileData, needs) => {
    return createRecipientPlusRequest({
      ...profileData,
      needs,
      organizationId: currentOrg,
    }).catch((err) => {
      console.error(
        "there was an error creating a recipient in partner console",
        err
      );
    });
  };

  const cancelOrgRequest = (request) => {
    return closeOrganizationRequestWithOutcome({
      requestId: request.id,
      outcome: "cancelled",
      organizationId: currentOrg,
    })
      .then((result) => {
        return;
      })
      .catch((error) => {
        console.log(error);
      })
      .finally(() => {
        fetchRequests();
      });
  };

  if (!currentOrg) {
    return null;
  }
  return (
    <Container>
      <SuccessModal
        open={showSuccess}
        onClose={onCloseSuccess}
        title={t("requestCreated")}
        textArray={[t("requestPublished1"), t("requestPublished2")]}
        primaryButtonText={t("okayGotIt")}
        primaryOnClick={onCloseSuccess}
      />
      <CreateRequest
        isOpen={showCreate} // TODO HH-273 need to pass landline flag as an argument
        turnOffModal={() => setShowCreate(false)}
        refreshParent={onRequestCreate}
        alwaysOnBehalf={true} // no need to show the checkbox
        createBeneficiaryHandler={createRecipientHandler}
      />
      <UIButton primary onClick={createRequest} text={t("placeRequest")} />
      <AdminRequestListData
        options={{
          disableAdminComments: true,
          disableBehalfColumn: true,
          editableNeeds: true,
          showSocialWorkerColumn: true,
          mode: mode,
          canCancelRequests: mode === "active" ? true : false,
          cancelOrgRequest: cancelOrgRequest,
          console: "partner",
        }}
        requests={requests}
      />
    </Container>
  );
}
