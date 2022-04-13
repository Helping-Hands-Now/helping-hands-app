import React, { useState, useEffect } from "react";
import { Container, Tab } from "semantic-ui-react";
import { useTranslation } from "react-i18next";
import TabItem from "../UI/UITabs";
import OrgRecipients from "../OrgRecipients";
import { queryOrganizationRecipients } from "../../firebase";
import OrgDropdown from "../OrgDropdown";
import ManageRequests from "./manageRequests";

export default function PartnerConsole(props) {
  const { t } = useTranslation();
  const [activeTabIndex, setActiveTabIndex] = useState(0);
  const [currentOrg, setCurrentOrg] = useState(null);
  const [recipients, setRecipients] = useState([]);

  const loadRecipients = () => {
    queryOrganizationRecipients({
      organizationId: currentOrg,
    }).then((r) => {
      setRecipients(r.data);
    });
  };

  useEffect(() => {
    if (currentOrg) {
      loadRecipients();
    }
  }, [currentOrg]);

  const panes = [
    {
      menuItem: (
        <TabItem
          key={0}
          onClick={() => setActiveTabIndex(0)}
          title={t("manageActiveRequests")}
          currentIndex={activeTabIndex}
          index={0}
        />
      ),
      render: () => <ManageRequests currentOrg={currentOrg} mode="active" />,
    },
    {
      menuItem: (
        <TabItem
          key={1}
          onClick={() => setActiveTabIndex(1)}
          title={t("manageClosedRequests")}
          currentIndex={activeTabIndex}
          index={1}
        />
      ),
      render: () => <ManageRequests currentOrg={currentOrg} mode="closed" />,
    },
    {
      menuItem: (
        <TabItem
          key={2}
          onClick={() => setActiveTabIndex(2)}
          title={t("previousRequesters")}
          currentIndex={activeTabIndex}
          index={2}
        />
      ),
      render: () => (
        <OrgRecipients
          currentOrg={currentOrg}
          recipients={recipients}
          reloadRecipients={loadRecipients}
        />
      ),
    },
  ];
  // tabs
  return (
    <Container>
      <h1>{t("partnerConsole")}</h1>
      <OrgDropdown
        setCurrentOrgId={setCurrentOrg}
        currentOrgId={currentOrg}
        fulfiller={"VOLUNTEER"}
      />
      <Tab
        menu={{
          pointing: false,
          text: true,
        }}
        activeIndex={activeTabIndex}
        panes={panes}
      />
    </Container>
  );
}
