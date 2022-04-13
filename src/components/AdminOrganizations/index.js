import React, { useState, useEffect, useRef } from "react";
import {
  Container,
  Modal,
  Table,
  Grid,
  Icon,
  Dropdown,
} from "semantic-ui-react";

import styled from "styled-components";
import UIButton from "../UI/UIButton";
import UIInput from "../UI/UIInput";
import UIText from "../UI/UIText";
import {
  createOrganization,
  editOrganization,
  deleteOrganization,
} from "../../firebase.js";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

const Styles = styled.div`
  margin: 15px;
`;

function OrgModal({ onClose, reload, org }) {
  const [orgName, setOrgName] = useState(org?.organizationName || "");
  const [admins, setAdmins] = useState([]);
  const [defaultValue] = useState(() => {
    if (!org?.admins) {
      return [];
    }
    let admins = [];
    org.admins.forEach((admin) => admins.push(admin.id));
    return admins;
  });
  const { t } = useTranslation();
  const options = useRef([]);

  useEffect(() => {
    if (!org?.admins) {
      return;
    }
    // initial value of data
    let admins = [];
    org.admins.forEach((admin) => admins.push(admin.id));
    setAdmins(admins);

    let opts = [];
    org.admins.forEach((admin) => {
      let name = admin.firstName + " " + admin.lastName;
      let option = {
        key: admin.id,
        text: name,
        value: admin.id,
      };
      opts.push(option);
    });
    options.current = opts;
  }, []);

  const renderAdmins = (org) => {
    const onChange = (evt, newVals) => {
      setAdmins(newVals.value);
    };

    const onAddItem = (evt, data) => {
      options.current.push({
        key: data.value,
        text: data.value,
        value: data.value,
      });
    };

    return (
      <>
        <UIText>{t("enterIdentifiers")}</UIText>
        <Dropdown
          allowAdditions
          multiple
          selection
          search
          defaultValue={defaultValue}
          fluid
          options={options.current}
          onChange={onChange}
          onAddItem={onAddItem}
          placeholder={t("enterIdentifiers")}
          clearable
          noResultsMessage=""
        />
      </>
    );
  };

  const save = () => {
    let fn;
    let data = {
      orgName,
      admins,
    };
    if (org) {
      fn = editOrganization;
      data.organizationId = org.id;
    } else {
      fn = createOrganization;
    }
    fn(data)
      .then((org) => {
        // reload organizations
        reload();
        onClose();
      })
      .catch((err) => {
        console.error(err);
      });
  };

  return (
    <Modal open={true} className="modal" closeIcon onClose={onClose}>
      <Modal.Header>
        <p className="dashboardTitle">
          {org ? t("editOrg") : t("createNewOrg")}
        </p>
      </Modal.Header>
      <Container>
        <Styles>
          <Grid columns={2}>
            <Grid.Row>
              <Grid.Column>
                <UIInput
                  placeholder={t("orgName")}
                  label={t("orgName")}
                  value={orgName}
                  hook={(e) => setOrgName(e.target.value)}
                />
              </Grid.Column>
              <Grid.Column>{renderAdmins(org)}</Grid.Column>
            </Grid.Row>
            <Grid.Row>
              <UIButton
                text={org ? t("editOrg") : t("createOrg")}
                onClick={() => save()}
                primary
              />
            </Grid.Row>
          </Grid>
        </Styles>
      </Container>
    </Modal>
  );
}

export default function AdminOrganizations({
  organizations,
  loadOrganizationsData,
}) {
  const [showModal, setShowModal] = useState(false);
  const [editedOrg, setEditedOrg] = useState(null);
  const { t } = useTranslation();

  const doDelete = (org) => {
    deleteOrganization({ organizationId: org.id }).then(() => {
      loadOrganizationsData();
    });
  };

  const doEdit = (org) => {
    setEditedOrg(org);
    setShowModal(true);
  };

  const renderEditLinks = (org) => {
    return (
      <>
        <Link
          onClick={() =>
            window.confirm(
              `Are you sure you want to delete ${org.organizationName}?`
            ) && doDelete(org)
          }
          to="#">
          <Icon name="delete" />
        </Link>
        <Link onClick={() => doEdit(org)} to="#">
          <Icon name="pencil" />
        </Link>
      </>
    );
  };

  const onClose = () => {
    setShowModal(false);
    setEditedOrg(null);
  };

  const renderModal = () => {
    if (!showModal) {
      return null;
    }
    return (
      <OrgModal
        onClose={onClose}
        reload={loadOrganizationsData}
        org={editedOrg}
      />
    );
  };

  const renderOrgs = () => {
    if (organizations.length === 0) {
      return <div>There are no orgs</div>;
    }
    return (
      <Table>
        <Table.Header>
          <Table.Row>
            <Table.HeaderCell>{t("organization")}</Table.HeaderCell>
            <Table.HeaderCell>{t("admins")}</Table.HeaderCell>
            <Table.HeaderCell>{t("edit")}</Table.HeaderCell>
          </Table.Row>
        </Table.Header>
        {organizations.map((org, i) => (
          <Table.Body key={i}>
            <Table.Row>
              <Table.Cell>{org.organizationName}</Table.Cell>
              <Table.Cell>
                {org.admins
                  .map((admin) => admin.firstName + " " + admin.lastName)
                  .join(", ")}
              </Table.Cell>
              <Table.Cell>{renderEditLinks(org)}</Table.Cell>
            </Table.Row>
          </Table.Body>
        ))}
      </Table>
    );
  };

  return (
    <Container>
      {renderModal()}
      <Styles>
        <h2>{t("organizations")}</h2>
        <UIButton
          secondary
          onClick={() => setShowModal(true)}
          text={t("createNewOrg")}
        />
        {renderOrgs()}
      </Styles>
    </Container>
  );
}
