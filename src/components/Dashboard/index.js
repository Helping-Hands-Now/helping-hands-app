import React, { useState, useEffect } from "react";
import { Tab, Grid, Container, Loader } from "semantic-ui-react";
import "semantic-ui-css/semantic.min.css";
import useGlobalState from "../../hooks/useGlobalState";
import {
  queryOpenRequests,
  queryPastRequests,
  queryNumberOfVolunteersNear,
} from "../../firebase.js";

import DashboardProfileSnippet from "../DashboardProfileSnippet";
import RequestCard from "../RequestCard";
import CreateRequest from "../CreateRequest";
import { useTranslation } from "react-i18next";
import GA from "../../utils/GoogleAnalytics";
import UIButton from "../UI/UIButton";
import "./styles.css";

import TabItem from "../UI/UITabs";
import Share from "../Share";

export default function Dashboard() {
  const { t } = useTranslation();

  const [openRequests, setOpenRequests] = useState(null);
  const [pastRequests, setPastRequests] = useState(null);
  const [activeTabIndex, setActiveTabIndex] = useState(0);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [volunteersInArea, setVolunteersInArea] = useState(1);

  const panes = [
    {
      menuItem: (
        <TabItem
          onClick={() => setActiveTabIndex(0)}
          title={t("activeRequests")}
          currentIndex={activeTabIndex}
          index={0}
        />
      ),
      render: () => (
        <div>
          {Object.keys(openRequests).length === 0 && (
            <div className="noRequestsContainer" align="center">
              <h2 className="noRequestsYet">{t("noRequestsYet")}</h2>
              <UIButton
                text={t("addNewRequest")}
                primary
                onClick={() => openRequestModal()}
              />
            </div>
          )}

          {Object.keys(openRequests).map((key) => (
            <RequestCard
              key={key}
              request={openRequests[key]}
              refreshParent={refreshData}
            />
          ))}
        </div>
      ),
    },
    {
      menuItem: (
        <TabItem
          onClick={() => setActiveTabIndex(1)}
          title={t("completedRequests")}
          currentIndex={activeTabIndex}
          index={1}
        />
      ),
      render: () => (
        <div>
          {Object.keys(pastRequests).length === 0 && (
            <div className="noRequestsContainer" align="center">
              <h2 className="noRequestsYet">{t("noCompletedRequests")}</h2>
              {/*<UIButton text={t('addNewRequest')} primary onClick={() => openRequestModal()} />*/}
            </div>
          )}

          {Object.keys(pastRequests).map((key) => (
            <RequestCard
              key={key}
              request={pastRequests[key]}
              refreshParent={refreshData}
            />
          ))}
        </div>
      ),
    },
  ];

  const openRequestModal = () => {
    setShowCreateModal(true);

    GA.sendEvent({
      category: "interaction",
      action: "button_press",
      label: "initiate_request",
    });
  };

  const queryUserOpenRequests = () => {
    queryOpenRequests()
      .then((result) => {
        var results = result.data.results;
        setOpenRequests(results);
      })
      .catch((error) => {
        console.log(error);
      });
  };

  const queryUserPastRequests = () => {
    queryPastRequests()
      .then((result) => {
        var results = result.data.results;
        setPastRequests(results);
      })
      .catch((error) => {
        console.log(error);
      });
  };

  const queryNumberOfVolunteersInArea = () => {
    queryNumberOfVolunteersNear()
      .then((result) => {
        var results = result.data;
        setVolunteersInArea(results);
      })
      .catch((error) => {
        console.log(error);
      });
  };

  const refreshData = () => {
    queryUserOpenRequests();
    queryUserPastRequests();
    queryNumberOfVolunteersInArea();
  };

  useEffect(() => {
    refreshData();
  }, []);

  return (
    <div>
      <DashboardProfileSnippet />

      {openRequests === null || pastRequests === null ? (
        <div className="dashboardContent">
          <Loader active inline="centered" />
        </div>
      ) : (
        <Container>
          {volunteersInArea === 0 && (
            <div className="noVolunteersContainer">
              <h1 className="noVolunteersDisplay">{t("noVolunteersYet1")}</h1>
              <h1 className="noVolunteersDisplay">{t("noVolunteersYet2")}</h1>
              <Share requester />
            </div>
          )}
          <div className="dashboardContent">
            <Grid>
              <Grid.Column width={8}>
                <h1 className="dashboardTitle">{t("currentRequests")}</h1>
              </Grid.Column>
              <Grid.Column align="right" width={8}>
                <CreateRequest
                  openRequest={null}
                  isOpen={showCreateModal}
                  refreshParent={refreshData}
                  turnOffModal={() => setShowCreateModal(false)}
                />
                <UIButton
                  primary
                  text={t("createRequest")}
                  onClick={() => openRequestModal()}
                />
              </Grid.Column>
            </Grid>
            <Tab
              menu={{ pointing: false, text: true }}
              panes={panes}
              activeIndex={activeTabIndex}
            />
          </div>
        </Container>
      )}
    </div>
  );
}
