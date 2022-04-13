import React, { useState } from "react";
import styled from "styled-components";
import matchSorter from "match-sorter";
import { performAdminAction } from "../../firebase.js";
import {
  useTable,
  useFilters,
  useGlobalFilter,
  useRowSelect,
} from "react-table";
import { useTranslation } from "react-i18next";
import { Button, Icon, Grid } from "semantic-ui-react";
import "./styles.css";
import { Link } from "react-router-dom";
import UIInput from "../UI/UIInput";
import AdminHistory from "../AdminHistory";
import UIReactTable, { SelectableHook } from "../UI/UIReactTable";
import useGlobalState from "../../hooks/useGlobalState";

const Styles = styled.div``;

function DefaultColumnFilter({
  column: { filterValue, preFilteredRows, setFilter },
}) {
  const count = preFilteredRows.length;

  return (
    <input
      value={filterValue || ""}
      onChange={(e) => {
        setFilter(e.target.value || undefined);
      }}
      placeholder={`Search ${count} users`}
    />
  );
}

function fuzzyTextFilterFn(rows, id, filterValue) {
  return matchSorter(rows, filterValue, { keys: [(row) => row.values[id]] });
}

fuzzyTextFilterFn.autoRemove = (val) => !val;

function AdminUserTable({ columns, reloadUsers, data }) {
  const globalState = useGlobalState();
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState("");

  const { t } = useTranslation();

  const filterTypes = React.useMemo(
    () => ({
      fuzzyText: fuzzyTextFilterFn,
      text: (rows, id, filterValue) => {
        return rows.filter((row) => {
          const rowValue = row.values[id];
          return rowValue !== undefined
            ? String(rowValue)
                .toLowerCase()
                .startsWith(String(filterValue).toLowerCase())
            : true;
        });
      },
    }),
    []
  );

  const editableColumns = {
    // EXAMPLE ON ADDING EDITABLE COLUMNS:
    // street: true,
  };

  const renderCell = () => ({
    Filter: DefaultColumnFilter,
    Cell: ({ data, cell: { value }, row: { index }, column: { id } }) => {
      const [newVal, setValue] = useState(value || "");
      const onChange = (e) => {
        setValue(e.target.value);
      };

      // update when done editing
      const onBlur = () => {
        let datum = data[index];
        if (!datum) {
          console.log("no data cannot edit");
          return;
        }
        // no change. exiting.
        if (datum[id] === newVal) {
          return;
        }
        let userRow = {
          [id]: newVal,
        };
        let actionData = {
          action: "editProfile",
          uids: [datum["uid"]],
          profileChanges: {
            old: {
              [id]: datum[id],
            },
            new: userRow,
          },
          userRow: userRow,
        };

        performAdminAction(actionData)
          .then(() => {
            // reload users
            reloadUsers();
          })
          .catch((error) => {
            console.log(error);
            setReasonError(error.message);
          });
      };

      if (editableColumns[id]) {
        return <input value={newVal} onChange={onChange} onBlur={onBlur} />;
      } else {
        return value;
      }
    },
  });

  const defaultColumn = React.useMemo(renderCell, [renderCell, data]);

  const {
    getTableProps,
    getTableBodyProps,
    headerGroups,
    rows,
    prepareRow,
    selectedFlatRows,
  } = useTable(
    {
      autoResetSelectedRows: false,
      columns,
      data,
      defaultColumn,
      filterTypes,
    },
    useFilters,
    useGlobalFilter,
    useRowSelect,
    SelectableHook(columns)
  );

  const adminAction = (action) => {
    let data = {
      action: action,
      uids: [],
    };

    // get the ids of the selected rows
    selectedFlatRows.forEach((row) => {
      data.uids.push(row.original.uid);
    });

    // tell server to do its thing. then reload the data
    performAdminAction(data)
      .then(() => {
        reloadUsers();
      })
      .catch((error) => {
        console.log(error);
        setReasonError(error.message);
      });
  };

  const flag = (isFlagged) => {
    setReasonError("");

    if (!reason && isFlagged) {
      setReasonError("Please fill reason before flagging");
      return;
    }

    adminAction(isFlagged ? "flag" : "unflag");
  };

  const ban = (isBanned) => {
    setReasonError("");

    if (!reason && isBanned) {
      console.log("reason error");
      setReasonError("Please fill reason before banning");
      return;
    }

    adminAction(isBanned ? "ban" : "unban");
  };

  const makeAdmin = (isAdmin) => {
    setReasonError("");

    adminAction(isAdmin ? "makeAdmin" : "removeAdmin");
  };

  const makeSuperAdmin = (isSuperAdmin) => {
    setReasonError("");

    adminAction(isSuperAdmin ? "makeSuperAdmin" : "removeSuperAdmin");
  };

  const showAdminButton =
    globalState.user.isAuthed && globalState.user.isSuperAdmin;

  return (
    <div>
      <div className={"adminUserList"}>
        <UIReactTable
          getTableProps={getTableProps}
          getTableBodyProps={getTableBodyProps}
          headerGroups={headerGroups}
          rows={rows}
          prepareRow={prepareRow}
        />
      </div>

      <Grid columns={2}>
        <Grid.Row>
          <Grid.Column>
            <UIInput
              hook={(e) => setReason(e.target.value)}
              label={t("banFlagReason")}
              placeholder={"This user is not delivering"}
              value={reason || ""}
              error={reasonError}
            />
          </Grid.Column>
          <Grid.Column>
            <div className="actionButtons">
              <Button onClick={() => ban(true)} text={"Ban"} secondary>
                {"Ban"}
              </Button>
              <Button onClick={() => ban(false)} text={"Unban"} primary>
                {"Unban"}
              </Button>

              <Button onClick={() => flag(true)} text={"Flag"} secondary>
                {"Flag"}
              </Button>
              <Button onClick={() => flag(false)} text={"Unflag"} primary>
                {"Unflag"}
              </Button>
              {showAdminButton && (
                <Button
                  onClick={() => makeAdmin(true)}
                  text={"Make Admin"}
                  primary>
                  {"Make Admin"}
                </Button>
              )}
              {showAdminButton && (
                <Button
                  onClick={() => makeAdmin(false)}
                  text={"Remove Admin"}
                  primary>
                  {"Remove Admin"}
                </Button>
              )}
              {showAdminButton && (
                <Button
                  onClick={() => makeSuperAdmin(true)}
                  text={"Make Super Admin"}
                  primary>
                  {"Make Super Admin"}
                </Button>
              )}
            </div>
          </Grid.Column>
        </Grid.Row>
      </Grid>
    </div>
  );
}

export default function AdminUserList(props) {
  const { t } = useTranslation();

  const [showAdminHistory, setShowAdminHistory] = useState(false);
  const [currentRowUID, setCurrentRowUID] = useState(null);
  const [currentRowAdminRecord, setCurrentRowAdminRecord] = useState(null);

  const historyCurrentRowClicked = (row) => {
    setCurrentRowUID(row.original.uid);
    setCurrentRowAdminRecord(row.original.adminRecord);
    setShowAdminHistory(true);
  };

  const columns = React.useMemo(
    () => [
      {
        Header: "User ID",
        columns: [
          {
            Header: "ID",
            accessor: "uid",
            filter: "fuzzyText",
          },
        ],
      },
      {
        Header: "Name",
        columns: [
          {
            Header: "Name",
            accessor: (row) => `${row.firstName} ${row.lastName}`,
            filter: "fuzzyText",
          },
        ],
      },
      {
        Header: "Contact",
        columns: [
          { Header: "Email", accessor: "email", filter: "fuzzyText" },
          { Header: "Phone", accessor: "phoneNumber", filter: "fuzzyText" },
        ],
      },
      {
        Header: "Address",
        columns: [
          { Header: "Street", accessor: "street", filter: "fuzzyText" },
          {
            Header: "City & State",
            accessor: (row) => `${row.city}, ${row.state}`,
            filter: "fuzzyText",
          },
          { Header: "Zip", accessor: "zipCode", filter: "fuzzyText" },
        ],
      },
      {
        Header: "Status",

        columns: [
          {
            Header: "# Of Completed Requests",
            accessor: "numberOfCompletedRequests",
          },
          {
            Header: "Admin",
            accessor: "isAdmin",
            Cell: ({ row }) =>
              row.values.isAdmin ? <Icon name="adn"></Icon> : null,
          },
          {
            Header: "SuperAdmin",
            accessor: "isSuperAdmin",
            Cell: ({ row }) =>
              row.values.isSuperAdmin ? <Icon name="adn"></Icon> : null,
          },
          {
            Header: "Banned",
            accessor: "isBanned",
            Cell: ({ row }) =>
              row.values.isBanned ? <Icon name="ban"></Icon> : null,
          },
          {
            Header: "Flagged",
            accessor: "isFlagged",
            Cell: ({ row }) =>
              row.values.isFlagged ? <Icon name="flag"></Icon> : null,
          },
          {
            Header: "Admin history",
            Cell: ({ row }) => (
              <Link onClick={() => historyCurrentRowClicked(row)} to="#">
                history
              </Link>
            ),
          },
        ],
      },
    ],
    []
  );

  return (
    <Styles>
      <h2>{t("users")}</h2>
      <AdminHistory
        isOpen={showAdminHistory}
        turnOffModal={() => setShowAdminHistory(false)}
        uid={currentRowUID}
        adminRecord={currentRowAdminRecord}
      />
      <AdminUserTable
        columns={columns}
        data={props.data}
        reloadUsers={props.reloadUsers}
      />
    </Styles>
  );
}
