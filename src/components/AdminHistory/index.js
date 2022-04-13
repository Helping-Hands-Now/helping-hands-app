import React, { useState, useEffect } from "react";
import { Modal, Container } from "semantic-ui-react";
import { queryAdminRecords } from "../../firebase.js";
import { Table, Icon } from "semantic-ui-react";

export default function AdminHistory(props) {
  const [records, setRecords] = useState([]);

  useEffect(() => {
    if (props.uid) {
      queryAdminRecords({ uid: props.uid })
        .then((result) => {
          setRecords(result.data);
        })
        .catch((error) => {
          console.log(error);
        });
    }
    // if uid or adminRecord changes, reload the data
  }, [props.uid, props.adminRecord]);

  const renderFlag = (record) => {
    if (record.isFlagged || record.action === "flag") {
      return <Icon name="flag"></Icon>;
    }
    if (record.action === "unflag") {
      return (
        <>
          <Icon name="undo" />
          <Icon name="flag" />
        </>
      );
    }
    return null;
  };

  const renderBan = (record) => {
    if (record.isBanned || record.action === "ban") {
      return <Icon name="ban"></Icon>;
    }
    if (record.action === "unban") {
      return (
        <>
          <Icon name="undo" />
          <Icon name="ban" />
        </>
      );
    }
    return null;
  };

  const renderAdmin = (record) => {
    if (record.action === "makeAdmin") {
      return <Icon name="adn"></Icon>;
    }
    if (record.action === "removeAdmin") {
      return (
        <>
          <Icon name="undo" />
          <Icon name="adn" />
        </>
      );
    }
    return null;
  };

  const renderProfileChanges = (record) => {
    if (
      record.action === "editProfile" &&
      record.profileChanges !== undefined
    ) {
      return JSON.stringify(record.profileChanges);
    }
    return null;
  };

  const renderActor = (record) => {
    if (record.actorInfo) {
      return record.actorInfo.firstName + " " + record.actorInfo.lastName;
    }
    return "who??";
  };

  const renderTime = (record) => {
    const time = record.actionTs || record.flagTs || record.banTs;
    if (time) {
      return new Date(time).toLocaleDateString();
    }
    return "no idea when";
  };

  const renderAdminRecords = () => {
    if (records.length !== 0) {
      return (
        // TODO eventually need pagination here...
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>Actor</Table.HeaderCell>
              <Table.HeaderCell>Flag</Table.HeaderCell>
              <Table.HeaderCell>Ban</Table.HeaderCell>
              <Table.HeaderCell>Admin</Table.HeaderCell>
              <Table.HeaderCell>Profile Changes</Table.HeaderCell>
              <Table.HeaderCell>Time</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          {records.map((record, i) => (
            <Table.Body key={i}>
              <Table.Row>
                <Table.Cell>{renderActor(record)}</Table.Cell>
                <Table.Cell>{renderFlag(record)}</Table.Cell>
                <Table.Cell>{renderBan(record)}</Table.Cell>
                <Table.Cell>{renderAdmin(record)}</Table.Cell>
                <Table.Cell>{renderProfileChanges(record)}</Table.Cell>
                <Table.Cell>{renderTime(record)}</Table.Cell>
              </Table.Row>
            </Table.Body>
          ))}
        </Table>
      );
    }
    return <div>There are no admin records</div>;
  };

  return (
    <Modal
      open={props.isOpen}
      className="modal"
      closeIcon
      onClose={props.turnOffModal}>
      <Modal.Header>
        <p className="dashboardTitle">Admin History</p>
      </Modal.Header>
      <Container>{renderAdminRecords()}</Container>
    </Modal>
  );
}
