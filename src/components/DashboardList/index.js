import React, { useState, useEffect } from "react";
import "moment-timezone";
import "semantic-ui-css/semantic.min.css";
import { Card } from "semantic-ui-react";
import { useTranslation } from "react-i18next";

export default function DashboardList(props) {
  const [requests, setRequests] = useState({ ...props.requests });

  useEffect(() => {
    setRequests(props.requests);
  }, [props.requests]);

  const { t } = useTranslation();

  return (
    <div className="dashboardList">
      {Object.keys(requests).map((key, index) => (
        <Card fluid className="requestEntry" key={index}>
          <Card.Content>
            <Card.Header>
              {requests[key].helperData.helperFirstName}{" "}
              {requests[key].helperData.helperLastName}
            </Card.Header>
            <Card.Description>
              {t("gotItems", {
                helperFirstName: requests[key].helperData.helperFirstName,
                firstName: requests[key].requesterFirstName,
                items: requests[key].needs,
              })}
            </Card.Description>
          </Card.Content>
        </Card>
      ))}
    </div>
  );
}
