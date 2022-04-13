import React, { useState } from "react";
import { Container, Modal, Table, Icon } from "semantic-ui-react";
import { Link } from "react-router-dom";
import ProfileForm from "../ProfileForm";
import {
  createRecipientOfOrganization,
  editRecipientOfOrganization,
  deleteRecipientOfOrganization,
} from "../../firebase.js";

import OrgAddress from "../OrgAddress";
import { parsePhoneNumberFromString } from "libphonenumber-js";

function RecipientModal({ currentOrg, recipient, done }) {
  const [loading, setLoading] = useState(false);

  const save = (profileData) => {
    let fn;
    // editing existing recipient
    if (recipient) {
      profileData.id = recipient.id;
      fn = editRecipientOfOrganization;
    } else {
      // create new recipient
      profileData.organizationId = currentOrg;
      fn = createRecipientOfOrganization;
    }
    setLoading(true);
    fn(profileData)
      .then((r) => {
        done(true);
      })
      .catch((err) => {
        // TODO we need to show errors to user
        console.error(err);
      });
  };
  // TODO add email address maybe?

  return (
    <Modal open={true} className="modal" closeIcon onClose={() => done(false)}>
      <Modal.Header>
        <p className="dashboardTitle">
          {recipient ? "Edit recipient" : "Create new recipient"}
        </p>
      </Modal.Header>
      <Container>
        <ProfileForm
          loading={loading}
          setLoading={setLoading}
          profileType={"orgRecipient"}
          submitCallback={save}
          profile={recipient}
        />
      </Container>
    </Modal>
  );
}

export default function OrgRecipients(props) {
  const recipients = props.recipients;
  const [showModal, setShowModal] = useState(false);
  const [editedRecipient, setEditedRecipient] = useState(null);

  const renderModal = () => {
    if (!showModal) {
      return null;
    }

    return (
      <RecipientModal
        showModal={showModal}
        currentOrg={props.currentOrg}
        recipient={editedRecipient}
        done={(val) => done(val)}
      />
    );
  };

  const done = (saved) => {
    // reload data if we saved/changed something
    if (saved) {
      props.reloadRecipients();
    }
    setShowModal(false);
    setEditedRecipient(null);
  };

  const renderRecipients = () => {
    if (!recipients.length) {
      return "No recipients found";
    }

    const doDelete = (recipient) => {
      deleteRecipientOfOrganization({
        id: recipient.id,
        organizationId: props.currentOrg,
      })
        .then(() => {
          // reload
          props.reloadRecipients();
        })
        .catch((err) => {
          console.error(err);
        });
    };

    const doEdit = (recipient) => {
      setEditedRecipient(recipient);
      setShowModal(true);
    };

    const renderEditLinks = (recipient) => {
      return (
        <>
          <Link onClick={() => doDelete(recipient)} to="#">
            <Icon name="delete" />
          </Link>
          <Link onClick={() => doEdit(recipient)} to="#">
            <Icon name="pencil" />
          </Link>
        </>
      );
    };

    return (
      <Table>
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell>Recipient</Table.HeaderCell>
            <Table.HeaderCell>Address</Table.HeaderCell>

            <Table.HeaderCell>Phone Number</Table.HeaderCell>
            <Table.HeaderCell>Edit</Table.HeaderCell>
          </Table.Row>
        </Table.Header>
        {recipients.map((recipient, i) => (
          <Table.Body key={i}>
            <Table.Row>
              <Table.Cell>
                {recipient.firstName + " " + recipient.lastName}
              </Table.Cell>
              <Table.Cell>
                <OrgAddress profile={recipient} />
              </Table.Cell>
              <Table.Cell>
                {parsePhoneNumberFromString(
                  recipient.phoneNumber.toString(),
                  "US"
                ).formatNational()}
              </Table.Cell>
              <Table.Cell>{renderEditLinks(recipient)}</Table.Cell>
            </Table.Row>
          </Table.Body>
        ))}
      </Table>
    );
  };

  return (
    <Container>
      {renderModal()}
      {renderRecipients()}
    </Container>
  );
}
