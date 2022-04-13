import React, { useState, useEffect } from "react";
import { Container, Tab, Button } from "semantic-ui-react";
import { useTranslation } from "react-i18next";
import AdminUserList from "../AdminUserList";
import AdminDashboard from "../AdminDashboard";
import AdminAnalytics from "../AdminAnalytics";
import AdminOrganizations from "../AdminOrganizations";
import AdminRequest from "../AdminRequest";
import AdminRequestList from "../AdminRequestList";
import AdminVolunteers from "../AdminVolunteers";
import "./styles.css";

import TabItem from "../UI/UITabs";
import UIInput from "../UI/UIInput";
import {
  db,
  getUsers,
  getAdmins,
  getUserCreationData,
  queryOrganizations,
} from "../../firebase.js";

async function getDashboardData() {
  let [
    needsHelpPromise,
    canHelpPromise,
    openPromise,
    pendingPromise,
  ] = await Promise.all([
    db.collection("users").where("needsHelp", "==", true).get(),
    db.collection("users").where("canHelp", "==", true).get(),
    db.collection("requests").where("status", "==", "open").get(),
    db
      .collection("requests")
      .where("status", "==", "pending_fulfillment")
      .get(),
  ]);

  return [
    {
      label: "Needs Help",
      count: needsHelpPromise.size,
    },
    {
      label: "Can Help",
      count: canHelpPromise.size,
    },
    {
      label: "Open Requests",
      count: openPromise.size,
    },
    {
      label: "Pending Requests",
      count: pendingPromise.size,
    },
  ];
}

export default function AdminConsole(props) {
  const { t } = useTranslation();
  const [activeTabIndex, setActiveTabIndex] = useState(0);
  const [userData, setUserData] = useState([]);
  const [dashboardData, setDashboardData] = useState([]);
  const [analyticsData, setAnalyticsData] = useState([]);
  const [organizationsData, setOrganizationsData] = useState([]);
  const [volunteers, setVolunteers] = useState([]);

  const [search, setSearch] = useState("");
  const [lastSearchType, setLastSearchType] = useState(false);
  const [getUserLoading, setGetUserLoading] = useState(false);
  const [getAdminsLoading, setGetAdminsLoading] = useState(false);

  const loadDashboardData = () => {
    getDashboardData().then((data) => {
      setDashboardData(data);
    });
  };
  const loadAnalyticsData = () => {
    getUserCreationData()
      .then((result) => {
        setAnalyticsData(result.data);
      })
      .catch((error) => {
        console.log(error);
      });
  };

  const loadOrganizationsData = () => {
    queryOrganizations().then((r) => {
      let orgs = r.data;
      orgs.forEach((org) => {
        if (org.admins.length) {
          org.admins.sort((a, b) => {
            let nameA = (a.firstName + " " + a.lastName).toLowerCase();
            let nameB = (b.firstName + " " + b.lastName).toLowerCase();
            if (nameA < nameB) {
              return -1;
            }
            if (nameA > nameB) {
              return 1;
            }
            return 0;
          });
        }
      });
      orgs.sort((a, b) => {
        let nameA = a.organizationName.toLowerCase();
        let nameB = b.organizationName.toLowerCase();
        if (nameA < nameB) {
          return -1;
        }
        if (nameA > nameB) {
          return 1;
        }
        return 0;
      });
      setOrganizationsData(orgs);
    });
  };

  const searchForUsers = (currSearchType) => {
    setLastSearchType(currSearchType);
    queryUsers(currSearchType);
  };

  const queryUsers = (currSearchType) => {
    let type = currSearchType ? currSearchType : lastSearchType;

    type === "admins" ? setGetAdminsLoading(true) : setGetUserLoading(true);

    let targetFunction =
      type === "admins" ? getAdmins() : getUsers({ search: search });

    targetFunction
      .then(async (r) => {
        var data = Object.values(r.data);

        let modifiedData = await Promise.all(
          data.map(async (user) => {
            let snapshot = await db
              .collection("requests")
              .where("helper", "==", user.uid)
              .where("status", "==", "closed")
              .get();
            user.numberOfCompletedRequests = snapshot.size;
            return user;
          })
        );

        setUserData(modifiedData);
      })
      .catch((error) => {
        console.error("Error getting users: ", error);
      })
      .finally(() => {
        type === "admins"
          ? setGetAdminsLoading(false)
          : setGetUserLoading(false);
      });
  };

  // right now we query all this at once
  // we can be smarter in the future and change this to only load the data for each tab when first clicked
  useEffect(() => {
    loadAnalyticsData();
    loadDashboardData();
    loadOrganizationsData();
  }, []);

  const panes = [
    {
      menuItem: (
        <TabItem
          key={0}
          onClick={() => setActiveTabIndex(0)}
          title={t("users")}
          currentIndex={activeTabIndex}
          index={0}
        />
      ),
      render: () => (
        <div>
          <UIInput
            hook={(e) => setSearch(e.target.value)}
            placeholder={`Search firstname, lastname, or phone`}
          />
          <Button
            onClick={() => searchForUsers("users")}
            loading={getUserLoading}>
            Search
          </Button>
          <Button
            onClick={() => searchForUsers("admins")}
            loading={getAdminsLoading}>
            List All Admins
          </Button>
          <br />
          <br />
          <AdminUserList data={userData} reloadUsers={queryUsers} />
        </div>
      ),
    },
    {
      menuItem: (
        <TabItem
          key={1}
          onClick={() => setActiveTabIndex(1)}
          title={t("activeRequests")}
          currentIndex={activeTabIndex}
          index={1}
        />
      ),
      render: () => <AdminRequestList mode="active" />,
    },
    {
      menuItem: (
        <TabItem
          key={2}
          onClick={() => setActiveTabIndex(2)}
          title={"Data"}
          currentIndex={activeTabIndex}
          index={2}
        />
      ),
      render: () => (
        <>
          <AdminDashboard data={dashboardData} />
          <AdminAnalytics data={analyticsData} />
        </>
      ),
    },
    {
      menuItem: (
        <TabItem
          key={3}
          onClick={() => setActiveTabIndex(3)}
          title="Organizations"
          currentIndex={activeTabIndex}
          index={3}
        />
      ),
      render: () => (
        <AdminOrganizations
          loadOrganizationsData={loadOrganizationsData}
          organizations={organizationsData}
        />
      ),
    },
    {
      menuItem: (
        <TabItem
          key={4}
          onClick={() => setActiveTabIndex(4)}
          title="Debug Request"
          currentIndex={activeTabIndex}
          index={4}
        />
      ),
      render: () => (
        <AdminRequest
          loadOrganizationsData={loadOrganizationsData}
          organizations={organizationsData}
        />
      ),
    },
    {
      menuItem: (
        <TabItem
          key={5}
          onClick={() => setActiveTabIndex(5)}
          title="Partner volunteers"
          currentIndex={activeTabIndex}
          index={5}
        />
      ),
      render: () => <AdminVolunteers volunteers={volunteers} />,
    },
  ];
  return (
    <Container>
      <h1 className="header">{t("adminConsole")}</h1>
      <Tab
        menu={{ pointing: false, text: true }}
        activeIndex={activeTabIndex}
        panes={panes}
      />
    </Container>
  );
}
