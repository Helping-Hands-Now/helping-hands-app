import React, { useState, useEffect } from "react";
import {
  Container,
  Menu,
  Grid,
  Divider,
  Button,
  Popup,
} from "semantic-ui-react";
import UIInput from "../UI/UIInput";
import { useTranslation } from "react-i18next";
import { UITabNavLink } from "../UI/UITabNavLink";
import Suppliers from "./suppliers";
import Trips from "./trips";
import {
  BrowserRouter as Router,
  Switch,
  Route,
  Redirect,
  useParams,
  useHistory,
  useRouteMatch,
} from "react-router-dom";
import ScheduleDeliveries from "./scheduleDeliveries";
import CommunityEvents from "./communityEvents";
import CreateCommunityEvents from "./createCommunityEvent";
import { db, querySuppliers, queryOrganizationRequests } from "../../firebase";
import moment from "moment";
import OrgDropdown from "../OrgDropdown";

const queryTrips = (
  organizationId,
  mode,
  setLastActiveTripRefresh,
  daysToLoad
) => {
  return queryOrganizationRequests({
    orgId: organizationId,
    mode: mode,
    daysToLoad: daysToLoad,
  })
    .then((result) => {
      if (setLastActiveTripRefresh) {
        setLastActiveTripRefresh(moment());
      }
      return result.data;
    })
    .catch((_error) => {
      return [];
    });
};

const streamActiveTrips = (organizationId, didGetNewTrips, setIsStreaming) => {
  let now = moment().unix() * 1000;
  // This is modeled after the queryOrganizationRequests cloud function at functions/organizations/
  return db
    .collection("requests")
    .where("organizationId", "==", organizationId)
    .where("scheduledPickupTime", ">=", now)
    .orderBy("scheduledPickupTime", "desc")
    .onSnapshot(
      function (snapshot) {
        didGetNewTrips(true);
        let requests = snapshot.docs.map((docSnapshot) => docSnapshot.data());
        setIsStreaming(true);
        console.log("streamActiveTrips new requests:", requests);
      },
      function (error) {
        setIsStreaming(false);
        console.log("streamActiveTrips Error:", error);
      }
    );
};

const ENTERPRISE_CONSOLE_URL_BASE_NAME = "enterprise_console";
const NULL_ORG_URL_REPRESENTATION = "no_org";
const ORG_ID_LOCAL_STORAGE_KEY = "org_id_local_storage_key";

function useOrgIdParamWithNullRepresentationOrLocalStorage() {
  const { orgId } = useParams();
  let nullOrOrgId = orgId === NULL_ORG_URL_REPRESENTATION ? null : orgId;
  return nullOrOrgId ?? localStorage.getItem(ORG_ID_LOCAL_STORAGE_KEY) ?? null;
}

export default function EnterpriseConsole(_props) {
  return (
    <Container fluid>
      <Router basename={`/${ENTERPRISE_CONSOLE_URL_BASE_NAME}`}>
        <Switch>
          <Redirect
            exact
            path="/"
            to={`/${NULL_ORG_URL_REPRESENTATION}/schedule`}
          />
          <Route path="/:orgId">
            <EnterpriseConsoleContent />
          </Route>
        </Switch>
      </Router>
    </Container>
  );
}

function EnterpriseConsoleContent() {
  const history = useHistory();
  const { url } = useRouteMatch();
  const param = useOrgIdParamWithNullRepresentationOrLocalStorage();
  const [currentOrgId, setCurrentOrgId] = useState(param);
  const { t } = useTranslation();
  const [suppliers, setSuppliers] = useState([]);
  const [recipients, setRecipients] = useState([]);
  const [activeTrips, setActiveTrips] = useState([]);
  const [pastTrips, setPastTrips] = useState([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [lastLoadFailed, setLastLoadFailed] = useState(false);
  const [newActiveTrips, setNewActiveTrips] = useState(false);
  const [fullRefreshRequested, setFullRefreshRequested] = useState(false);
  const [lastActiveTripRefresh, setLastActiveTripRefresh] = useState(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [daysToLoad, setDaysToLoad] = useState(7);

  const [showEnterpriseConsole, setShowEnterpriseConsole] = useState(true);

  useEffect(() => {
    localStorage.setItem(ORG_ID_LOCAL_STORAGE_KEY, currentOrgId);
    let path = window.location.pathname.split("/");
    let basenameIndex = path.indexOf(ENTERPRISE_CONSOLE_URL_BASE_NAME);
    let currentPathAfterOrg = path.slice(basenameIndex + 2); // basename/orgId/rest/of/path -> rest/of/path
    let newPathAfterOrg =
      currentPathAfterOrg.length > 0 ? currentPathAfterOrg : ["schedule"];
    let newPath = [currentOrgId ?? NULL_ORG_URL_REPRESENTATION].concat(
      newPathAfterOrg
    );
    history.push(`/${newPath.join("/")}`);
  }, [currentOrgId]);

  useEffect(() => {
    if (currentOrgId) {
      fullRefresh();
    } else {
      resetData();
    }
  }, [currentOrgId]);

  useEffect(() => {
    if (currentOrgId && fullRefreshRequested) {
      fullRefresh();
    }
  }, [fullRefreshRequested]);

  useEffect(() => {
    setNewActiveTrips(false);
    if (currentOrgId) {
      return streamActiveTrips(currentOrgId, setNewActiveTrips, setIsStreaming);
    }
  }, [currentOrgId]);

  useEffect(() => {
    if (newActiveTrips) {
      loadActiveTrips().then(() => {
        setNewActiveTrips(false);
      });
    }
  }, [newActiveTrips]);

  const fullRefresh = () => {
    setIsLoadingData(true);
    setFullRefreshRequested(false);
    Promise.all([loadSuppliers(), loadActiveTrips(), loadPastTrips()]).then(
      () => {
        setIsLoadingData(false);
        setLastLoadFailed(false);
      },
      (_error) => {
        setLastLoadFailed(true);
        setIsLoadingData(false);
      }
    );
  };

  const resetData = () => {
    setIsLoadingData(false);
    setLastLoadFailed(false);
    setSuppliers([]);
    setRecipients([]);
    setActiveTrips([]);
    setPastTrips([]);
  };

  const loadSuppliers = async () => {
    const r = await querySuppliers({ organizationId: currentOrgId });
    setSuppliers(r?.data ?? []);
  };

  const loadActiveTrips = async () => {
    const r = await queryTrips(
      currentOrgId,
      "active",
      setLastActiveTripRefresh
    );
    setActiveTrips(r ?? []);
  };

  const loadPastTrips = async () => {
    const r = await queryTrips(currentOrgId, "past", null, daysToLoad);
    setPastTrips(r ?? []);
  };

  const routes = [
    {
      path: "/schedule",
      title: t("scheduleDeliveries"),
      render: (
        <>
          <ScheduleDeliveries
            currentOrg={currentOrgId}
            suppliers={suppliers}
            recipients={recipients}
            switchToTrips={() => {
              history.push(`${url}/active_trips`);
            }}
          />
        </>
      ),
    },
    {
      path: "/suppliers",
      title: t("suppliers"),
      render: (
        <Suppliers
          currentOrg={currentOrgId}
          suppliers={suppliers}
          reloadSuppliers={loadSuppliers}
          trips={[...activeTrips, ...pastTrips]}
        />
      ),
    },
    {
      path: "/active_trips",
      title: t("Active Trips"),
      render: (
        <Trips
          currentOrg={currentOrgId}
          trips={activeTrips}
          suppliers={suppliers}
          reloadTrips={() => loadActiveTrips()}
          mode="active"
        />
      ),
    },
    {
      path: "/past_trips",
      title: t("Past Trips"),
      render: (
        <Trips
          currentOrg={currentOrgId}
          trips={pastTrips}
          reloadTrips={() => loadPastTrips()}
          setDaysToLoad={(days) => setDaysToLoad(days)}
          daysToLoad={daysToLoad}
          mode="past"
        />
      ),
    },
    {
      path: "/community_events",
      title: t("Community Events"),
      render: (
        <CommunityEvents
          currentOrg={currentOrgId}
          suppliers={suppliers}
          setShowEnterpriseConsole={setShowEnterpriseConsole}
        />
      ),
    },
  ];

  return showEnterpriseConsole ? (
    <Container>
      <h1 className="header">{t("enterpriseConsole")}</h1>
      <OrgDropdown
        setCurrentOrgId={setCurrentOrgId}
        currentOrgId={currentOrgId}
      />
      <Grid columns={5}>
        <Menu
          width={14}
          items={routes.map((route, index) => (
            <UITabNavLink
              key={index}
              to={url + route.path}
              title={route.title}
            />
          ))}
          pointing={false}
          text={true}
        />
        <Grid.Column verticalAlign="middle" floated="right">
          {isLoadingData && (
            <Popup
              content="Loading trips. Hold tight!"
              trigger={
                <Button
                  size="mini"
                  loading
                  fluid
                  primary
                  label="Loading"
                  onClick={() => setFullRefreshRequested(true)}
                />
              }
            />
          )}
          {!isLoadingData && lastLoadFailed && (
            <Popup
              content="Failed to load trips. Tap to retry."
              trigger={
                <Button
                  size="mini"
                  negative
                  fluid
                  icon="refresh"
                  label={lastActiveTripRefresh?.format("HH:mm:ss") ?? "Error"}
                  onClick={() => setFullRefreshRequested(true)}
                />
              }
            />
          )}
          {!isLoadingData && !lastLoadFailed && !isStreaming && (
            <Popup
              content={`Trips loaded. Tap to refresh. ${
                !!lastActiveTripRefresh ? "Last update" : ""
              } ${lastActiveTripRefresh?.format("MMMM Do YYYY, h:mm:ss a")}`}
              trigger={
                <Button
                  size="mini"
                  fluid
                  positive
                  icon="check"
                  onClick={() => setFullRefreshRequested(true)}
                  label={lastActiveTripRefresh?.format("HH:mm:ss") ?? "Loading"}
                />
              }
            />
          )}
          {!isLoadingData && !lastLoadFailed && isStreaming && (
            <Popup
              content={`Streaming active trips. ${
                !!lastActiveTripRefresh ? "Last update" : ""
              } ${lastActiveTripRefresh?.format("MMMM Do YYYY, h:mm:ss a")}`}
              trigger={
                <Button
                  size="mini"
                  fluid
                  positive
                  icon="refresh"
                  onClick={() => setFullRefreshRequested(true)}
                  label={{
                    basic: true,
                    pointing: "left",
                    content: (
                      <div style={{ whiteSpace: "nowrap" }}>
                        {
                          <p>
                            {lastActiveTripRefresh
                              ? "Last Refresh: " +
                                lastActiveTripRefresh.format("hh:mm:ss a")
                              : "Loading"}
                          </p>
                        }
                      </div>
                    ),
                  }}
                />
              }
            />
          )}
        </Grid.Column>
      </Grid>
      <Divider hidden />
      <Switch>
        {routes.map((route) => {
          return (
            <Route path={url + route.path} key={route.path}>
              {route.render}
            </Route>
          );
        })}
        <Redirect to={`${url}/schedule`} />
      </Switch>
    </Container>
  ) : (
    <Container fluid>
      <CreateCommunityEvents
        currentOrg={currentOrgId}
        suppliers={suppliers}
        setShowEnterpriseConsole={setShowEnterpriseConsole}
      />
    </Container>
  );
}
