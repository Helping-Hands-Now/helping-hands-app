import React, { useState, useEffect } from "react";
import { Container, Grid, Message } from "semantic-ui-react";
import OrgAddress from "../OrgAddress";
import UIButton from "../UI/UIButton";
import UIDropdown from "../UI/UIDropdown";
import UIText from "../UI/UIText";
import Table from "./table";
import SendToDispatch from "./sendToDispatch";

import ImportRecipients from "../OrgRecipients/importer";

function Import({
  currentOrg,
  nextHandler,
  setSelectedRecipients,
  supplierInfo,
  courier,
}) {
  const setRecipientData = (recipientData) => {
    let recipients = [];
    recipientData.existing.forEach((existing) => {
      // make sure we have ids as top level for SendToDispatch
      existing.id = existing.userProfile.id;
      recipients.push(existing);
    });
    recipients = recipients.concat(recipientData.new);
    setSelectedRecipients(recipients);
  };

  let validateDistance = null;
  if (supplierInfo.length) {
    validateDistance = supplierInfo[0].supplier.geohash;
  }

  return (
    <ImportRecipients
      currentOrg={currentOrg}
      nextHandler={nextHandler}
      setRecipientData={setRecipientData}
      validateDistanceGeoHash={validateDistance}
      courier={courier}
      supplier={supplierInfo[0].supplier}
    />
  );
}

function SelectPickupLocation({
  suppliers,
  setSupplierInfo,
  nextPageHandler,
  selectedRecipients,
}) {
  const [disabled, setDisabled] = useState(true);
  const [selectedSuppliers, setSelectedSuppliers] = useState([]);
  const [visibleSuppliers, setVisibleSuppliers] = useState([]);

  useEffect(() => {
    setVisibleSuppliers(
      suppliers.filter((supplier) => {
        return supplier.uberStoreId !== undefined;
      })
    );
  }, [suppliers]);

  const columns = React.useMemo(() => [
    {
      Header: "Pick up Location",
      accessor: "name",
    },
    {
      Header: "Address",
      Cell: ({ row }) => <OrgAddress profile={row.original} />,
    },
  ]);

  // TODO simplify the API since we only allow one to be selected
  const onSelect = (selectedFlatRows) => {
    if (selectedFlatRows.length !== selectedSuppliers.length) {
      // only one allowed in this flow for now
      setDisabled(selectedFlatRows.length !== 1);
      setSelectedSuppliers(() => {
        return selectedFlatRows.map((row) => row.original);
      });
    }
  };

  const nextPage = () => {
    let totalCount = 0;
    // TODO clean this up
    // and see what's happening all the way down since pickuplocation comes first....
    selectedRecipients.forEach((recipient) => {
      totalCount += parseInt(recipient.numRecipients, 10) || 1;
    });
    setSupplierInfo(() => {
      return selectedSuppliers.map((supplier) => {
        return {
          supplier: supplier,
          // currently unused but could be used later
          numDeliveries: totalCount,
        };
      });
    });
    nextPageHandler();
  };

  return (
    <>
      <Grid columns={2}>
        <Grid.Row>
          <Grid.Column textAlign="left">
            <UIText>Select Pickup location</UIText>
          </Grid.Column>
        </Grid.Row>
      </Grid>
      <Table columns={columns} data={visibleSuppliers} onSelect={onSelect} />
      <Container textAlign="center">
        <UIButton
          secondary
          onClick={nextPage}
          text={"Next"}
          disabled={disabled}
        />
      </Container>
    </>
  );
}

export default function ScheduleDeliveries(props) {
  const [importDisabled, setImportDisabled] = useState(true);
  const [importing, setImporting] = useState(false);
  const [recipientsPage, setRecipientsPage] = useState(false);
  const [suppliersPage, setSuppliersPage] = useState(false);
  const [dispatchPage, setDispatchPage] = useState(false);
  const [selectedRecipients, setSelectedRecipients] = useState([]);
  const [supplierInfo, setSupplierInfo] = useState([]);
  const [recipientsMap, setRecipientsMap] = useState({});
  const [courier, setCourier] = useState("UBER");

  useEffect(() => {
    if (props.currentOrg) {
      setImportDisabled(false);
      // don't show suppliers page until we have an org
      setSuppliersPage(true);
    }
  }, [props.currentOrg]);

  useEffect(() => {
    if (!supplierInfo.length) {
      return;
    }
    const rm = {};
    supplierInfo.forEach((supplier) => {
      rm[supplier.supplier.id] = selectedRecipients;
    });
    setRecipientsMap(rm);
  }, [supplierInfo, selectedRecipients]);

  const nextPage = () => {
    if (recipientsPage) {
      setSuppliersPage(false);
      setRecipientsPage(false);
      setDispatchPage(true);
    }
    if (suppliersPage) {
      setSuppliersPage(false);
      setRecipientsPage(true);
      setDispatchPage(false);
    }
  };
  const message = (name) => {
    return (
      <Message info>
        <Message.Header>
          The only courier available for this location is Lyft
        </Message.Header>
        <p>
          The pickup location of <b>{name} </b>does not have an UBER Store ID.
          This is necessary to use this location for Uber delivery. Contact
          Helping Hands to add one for this location.
        </p>
      </Message>
    );
  };
  const doesNotHaveUberStoreId =
    supplierInfo[0] && !supplierInfo[0].supplier.uberStoreId;
  const supplierName = supplierInfo[0] && supplierInfo[0].supplier.name;
  const courier_options = [
    {
      key: "Uber",
      value: "UBER",
      text: "Uber",
      disabled: doesNotHaveUberStoreId,
    },
    { key: "Lyft", value: "LYFT", text: "Lyft" },
  ];

  return (
    <Container>
      {doesNotHaveUberStoreId && message(supplierName)}

      {recipientsPage && !importing && (
        <UIDropdown
          label={"Courier Service"}
          hook={(e, d) => setCourier(d.value)}
          selection
          placeholder={"Courier"}
          options={courier_options}
          disabled={importing}
        />
      )}
      {recipientsPage && !importing && (
        <Container textAlign="center">
          <UIButton
            secondary
            onClick={() => setImporting(true)}
            text={"Next"}
            disabled={importDisabled}
          />
        </Container>
      )}
      {recipientsPage && importing && (
        <Import
          currentOrg={props.currentOrg}
          setImporting={setImporting}
          nextHandler={nextPage}
          setSelectedRecipients={setSelectedRecipients}
          supplierInfo={supplierInfo}
          courier={courier}
        />
      )}
      {suppliersPage && (
        <SelectPickupLocation
          currentOrg={props.currentOrg}
          suppliers={props.suppliers}
          setSupplierInfo={setSupplierInfo}
          nextPageHandler={nextPage}
          selectedRecipients={selectedRecipients}
        />
      )}
      {dispatchPage && (
        <SendToDispatch
          currentOrg={props.currentOrg}
          suppliers={supplierInfo}
          disableBack={true}
          recipientsMap={recipientsMap}
          switchToTrips={props.switchToTrips}
          courier={courier}
        />
      )}
    </Container>
  );
}
