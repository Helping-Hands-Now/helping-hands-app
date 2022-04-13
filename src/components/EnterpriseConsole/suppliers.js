import React, { useState, useEffect } from "react";
import {
  createSupplier,
  deleteSupplier,
  editSupplier,
  importSuppliers,
  validateAddress,
  querySupplierTimeZone,
} from "../../firebase";
import hash from "object-hash";
import geohash from "ngeohash";

import {
  Container,
  Message,
  Modal,
  Grid,
  Table,
  Icon,
  Confirm,
} from "semantic-ui-react";
import UIButton from "../UI/UIButton";
import UIInput from "../UI/UIInput";
import UIText from "../UI/UIText";
import UIStateDropdown from "../UI/UIStateDropdown";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import OrgAddress from "../OrgAddress";
import OrgTripInfo from "../OrgTripInfo";

import UIImporter from "../UI/UIImporter";
import { AsYouType } from "libphonenumber-js";
import UITextArea from "../UI/UITextArea";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import useGlobalState from "../../hooks/useGlobalState";

import { FilterItemByScheduledPickupTime, FilterBy } from "./filter";

function SupplierModal({ currentOrg, supplier, done }) {
  const hashFields = () => {
    return hash([
      supplierName,
      street,
      city,
      state,
      zipCode,
      apartment,
      primaryEmail,
      primaryPhoneNumber,
      secondaryEmail,
      secondaryPhoneNumber,
      pickupInstructions,
      uberStoreId,
    ]);
  };
  const globalState = useGlobalState();

  const [supplierName, setSupplierName] = useState(supplier?.name || "");
  const [street, setStreet] = useState(supplier?.street || "");
  const [city, setCity] = useState(supplier?.city || "");
  const [state, setState] = useState(supplier?.state || "");
  const [zipCode, setZipCode] = useState(supplier?.zipCode || "");
  const [apartment, setApartment] = useState(supplier?.apartment || "");

  const [primaryEmail, setPrimaryEmail] = useState(
    supplier?.primaryEmail || ""
  );
  const [secondaryEmail, setSecondaryEmail] = useState(
    supplier?.secondaryEmail || ""
  );
  const [primaryPhoneNumber, setPrimaryPhoneNumber] = useState(
    supplier?.primaryPhoneNumber || ""
  );
  const [secondaryPhoneNumber, setSecondaryPhoneNumber] = useState(
    supplier?.secondaryPhoneNumber || ""
  );
  const [loading, setLoading] = useState(false);
  const [pickupInstructions, setPickupInstructions] = useState(
    supplier?.pickupInstructions || ""
  );
  const [uberStoreId, setUberStoreId] = useState(supplier?.uberStoreId || "");
  const [originalHash, setOriginalHash] = useState(() => {
    return hashFields();
  });

  const [errorMsg, setErrorMsg] = useState(null);

  useEffect(() => {
    if (supplier) {
      setOriginalHash(hashFields());
    }
  }, [supplier]);

  const { t } = useTranslation();

  const save = async () => {
    setErrorMsg(null);
    setLoading(true);

    var validateAddressData = {
      street: street,
      city: city,
      state: state,
      zipCode: zipCode,
      apartment: apartment,
    };
    let data = {
      name: supplierName,
      street: street,
      city: city,
      state: state,
      zipCode: zipCode,
      apartment: apartment,
      primaryEmail: primaryEmail,
      primaryPhoneNumber: primaryPhoneNumber,
      secondaryEmail: secondaryEmail,
      secondaryPhoneNumber: secondaryPhoneNumber,
      pickupInstructions: pickupInstructions,
    };

    if (globalState.user.isAdmin) {
      data.uberStoreId = uberStoreId;
    }

    try {
      var response = await validateAddress(validateAddressData);
      setErrorMsg(null);
      data = {
        ...data,
        geohash: response.data.data.geohash,
        placeId: response.data.data.placeId,
      };
    } catch (error) {
      setLoading(false);
      console.log("Error validating address:", error);
      setErrorMsg("Invalid address provided");
      return;
    }
    // TODO validate phone number with libphonenumber and display error if invalid

    // if creating, add orgId
    let fn;
    if (!supplier) {
      data.organizationId = currentOrg;
      fn = createSupplier;
    } else {
      data.supplierId = supplier.id;
      fn = editSupplier;
    }
    fn(data)
      .then((r) => {
        // close modal we're done

        if (fn === editSupplier) {
          updateTimeZone(data.supplierId, data.geohash);
        } else {
          done(true);
        }
      })
      .catch((err) => {
        setLoading(false);
        setErrorMsg(err.message || err);
        console.error(err);
      });
  };

  const updateTimeZone = async (id, hash) => {
    var latlng = geohash.decode(hash);

    var result = await querySupplierTimeZone({
      latitude: latlng.latitude,
      longitude: latlng.longitude,
      supplierId: id,
    });

    done(true);
  };

  return (
    <Modal open={true} className="modal" closeIcon onClose={() => done(false)}>
      <Modal.Header>
        <p className="dashboardTitle">
          {supplier ? "Edit supplier" : "Create new supplier"}
        </p>
      </Modal.Header>
      <div style={{ margin: "24px" }}>
        <Container>
          {errorMsg !== null && <Message error>{errorMsg}</Message>}
          <UIInput
            placeholder="supplier name"
            label="supplier name"
            hook={(e) => setSupplierName(e.target.value)}
            value={supplierName}
          />
          <UIInput
            placeholder={street}
            label={t("street")}
            hook={(e) => setStreet(e.target.value)}
            value={street}
          />
          <Grid columns={2}>
            <Grid.Column>
              <UIInput
                placeholder={city}
                label={t("city")}
                hook={(e) => setCity(e.target.value)}
                value={city}
              />
              <UIStateDropdown
                label={t("state")}
                placeholder={t("state")}
                hook={(e, d) => setState(d.value)}
                search
                selection
                state={state}
              />
              <UIInput
                placeholder={"Primary Email"}
                label={"Primary Email"}
                hook={(e) => setPrimaryEmail(e.target.value)}
                value={primaryEmail}
              />
              <UIInput
                placeholder={"Primary Phone Number"}
                label={"Primary Phone Number"}
                hook={(e) =>
                  setPrimaryPhoneNumber(
                    new AsYouType("US").input(e.target.value)
                  )
                }
                value={primaryPhoneNumber}
              />
              {globalState.user.isAdmin && (
                <UIInput
                  placeholder={t("uberStoreId")}
                  label={t("uberStoreId")}
                  hook={(e) => setUberStoreId(e.target.value)}
                  value={uberStoreId}
                />
              )}
            </Grid.Column>
            <Grid.Column>
              <UIInput
                placeholder={zipCode}
                label={t("zip")}
                hook={(e) => setZipCode(e.target.value)}
                value={zipCode}
              />
              <UIInput
                placeholder={apartment}
                label={t("apartment")}
                hook={(e) => setApartment(e.target.value)}
                value={apartment}
              />
              <UIInput
                placeholder={"Secondary Email"}
                label={"Secondary Email"}
                hook={(e) => setSecondaryEmail(e.target.value)}
                value={secondaryEmail}
              />
              <UIInput
                placeholder={"Secondary Phone Number"}
                label={"Secondary Phone Number"}
                hook={(e) =>
                  setSecondaryPhoneNumber(
                    new AsYouType("US").input(e.target.value)
                  )
                }
                value={secondaryPhoneNumber}
              />
            </Grid.Column>
          </Grid>
          <UITextArea
            placeholder={"Pickup instructions"}
            label="Pickup instructions"
            hook={(e) => setPickupInstructions(e.target.value)}
            value={pickupInstructions}
          />
          <UIButton
            text={supplier ? "Edit supplier" : "Create supplier"}
            onClick={() => save()}
            primary
            loading={loading}
            disabled={hashFields() === originalHash}
          />
        </Container>
      </div>
    </Modal>
  );
}

function ImportSuppliers({ currentOrg, done }) {
  const [loading, setLoading] = useState(false);
  const save = async (data) => {
    setLoading(true);
    importSuppliers({
      organizationId: currentOrg,
      suppliers: data,
    })
      .then(() => {
        done();
      })
      .catch((err) => {
        console.error("error importing new suppliers into org", err);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  const columns = React.useMemo(() => [
    {
      Header: "Supplier Name",
      accessor: "name",
    },
    {
      Header: "Street",
      accessor: "street",
    },
    {
      Header: "City",
      accessor: "city",
    },
    {
      Header: "State",
      accessor: "state",
    },
    {
      Header: "Zip",
      accessor: "zip",
    },
    {
      Header: "Apartment",
      accessor: "apartment",
    },
    {
      Header: "Primary Email",
      accessor: "primaryEmail",
    },
    {
      Header: "Primary Phone",
      accessor: "primaryPhoneNumber",
    },
    {
      Header: "Secondary Email",
      accessor: "secondaryEmail",
    },
    {
      Header: "Secondary Phone",
      accessor: "secondaryPhoneNumber",
    },
    {
      Header: "Pickup Instructions",
      accessor: "pickupInstructions",
    },
  ]);

  const dataFormatter = (data) => {
    return data.map((datum) => {
      datum.zipCode = datum.zip;
      return datum;
    });
  };

  const saveButtonText = (data) => {
    return `save ${data.length} suppliers`;
  };

  return (
    <UIImporter
      columns={columns}
      save={save}
      dataFormatter={dataFormatter}
      saveButtonText={saveButtonText}
      loading={loading}
      disabled={false}
      label="Select CSV with supplier information"
    />
  );
}

export default function Suppliers(props) {
  const suppliers = props.suppliers;
  const [showModal, setShowModal] = useState(false);
  const [createDisabled, setCreateDisabled] = useState(true);
  const [importDisabled, setImportDisabled] = useState(true);
  const [editedSupplier, setEditedSupplier] = useState(null);
  const [importing, setImporting] = useState(false);
  const [filteredDate, setFilteredDate] = useState(null);
  const [filteredTrips, setFilteredTrips] = useState([]);
  const [open, setOpen] = useState(false);
  const [currentSupplier, setCurrentSupplier] = useState(false);

  const createClicked = () => {
    setEditedSupplier(null);
    setImporting(false);
    setShowModal(true);
  };

  const importClicked = () => {
    setEditedSupplier(null);
    setImporting(true);
    setShowModal(false);
  };

  const doneImporting = () => {
    setImporting(false);
    props.reloadSuppliers();
  };

  useEffect(() => {
    if (props.currentOrg) {
      // can only click this button if we have an org
      setCreateDisabled(false);
      setImportDisabled(false);
    }
  }, [props.currentOrg]);

  useEffect(() => {
    setFilteredTrips(
      FilterBy(props.trips, [FilterItemByScheduledPickupTime(filteredDate)])
    );
  }, [filteredDate, props.trips]);

  const done = (saved) => {
    setShowModal(false);
    setEditedSupplier(null);
    // only reload if we saved something
    if (saved) {
      props.reloadSuppliers();
    }
  };

  const renderModal = () => {
    if (!showModal) {
      return null;
    }
    return (
      <SupplierModal
        showModal={showModal}
        currentOrg={props.currentOrg}
        supplier={editedSupplier}
        done={(val) => done(val)}
      />
    );
  };

  const renderImporting = () => {
    if (!importing) {
      return null;
    }
    return (
      <ImportSuppliers done={doneImporting} currentOrg={props.currentOrg} />
    );
  };

  const renderSuppliers = () => {
    if (importing) {
      return null;
    }
    if (!suppliers.length) {
      return "No suppliers found";
    }

    const doDelete = (supplier) => {
      setCurrentSupplier(supplier);
      setOpen(!open);
    };

    const doEdit = (supplier) => {
      setEditedSupplier(supplier);
      setShowModal(true);
    };
    const closeModal = () => {
      setOpen(false);
    };

    const cancelAllTrips = () => {
      deleteSupplier({
        supplierId: currentSupplier.id,
      })
        .then(() => {
          props.reloadSuppliers();
        })
        .catch((err) => {
          console.error(err);
        });
      setOpen(!open);
    };

    const tripsModal = (supplier) => {
      return (
        <Confirm
          open={open}
          content="Delete this supplier? This cannot be undone."
          cancelButton="No, do not delete"
          confirmButton="Yes, delete supplier"
          onCancel={() => closeModal()}
          onConfirm={() => cancelAllTrips(supplier)}
        />
      );
    };

    const renderEditLinks = (supplier) => {
      return (
        <Grid>
          <Grid.Column floated="left" width={2}>
            <Link onClick={() => doDelete(supplier)} to="#">
              <Icon name="delete" />
            </Link>
          </Grid.Column>
          <Grid.Column floated="right" width={8}>
            <Link onClick={() => doEdit(supplier)} to="#">
              <Icon name="pencil" />
            </Link>
          </Grid.Column>
        </Grid>
      );
    };

    const renderDeliveries = (supplier) => {
      // because of the filtering, we are doing this logic on the client
      let tripBucketsCount = {};
      let tripBucketsTime = {};
      let totalTrips = 0;

      filteredTrips.forEach((trip) => {
        if (!trip.supplier || !trip.uberStatus) {
          return;
        }
        if (trip.supplier.id !== supplier.id) {
          return;
        }

        let count = tripBucketsCount[trip.uberStatus] || 0;
        tripBucketsCount[trip.uberStatus] = count + 1;
        let time = tripBucketsTime[trip.uberStatus] || 0;
        if (
          trip.timeCreated &&
          trip.timeCreated._seconds &&
          trip.timeCreated._seconds > time
        ) {
          tripBucketsTime[trip.uberStatus] = trip.timeCreated._seconds;
        }
        totalTrips++;
      });

      let tripsInfo = [];
      for (const key in tripBucketsCount) {
        tripsInfo.push({
          status: key,
          count: tripBucketsCount[key],
          mostRecentTime: {
            // put it in the format the server was previously sending down
            _seconds: tripBucketsTime[key],
          },
        });
      }

      let info = {
        totalTrips,
        tripsInfo,
      };

      return <OrgTripInfo profile={info} />;
    };

    return (
      <>
        <div>{open && tripsModal()}</div>
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>Supplier</Table.HeaderCell>
              <Table.HeaderCell>Address</Table.HeaderCell>
              <Table.HeaderCell>Deliveries supplied</Table.HeaderCell>
              <Table.HeaderCell>Edit</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          {suppliers.map((supplier, i) => (
            <Table.Body key={i}>
              <Table.Row>
                <Table.Cell>{supplier.name}</Table.Cell>
                <Table.Cell>
                  <OrgAddress profile={supplier} />
                </Table.Cell>
                <Table.Cell>{renderDeliveries(supplier)}</Table.Cell>
                <Table.Cell>{renderEditLinks(supplier)}</Table.Cell>
              </Table.Row>
            </Table.Body>
          ))}
        </Table>
      </>
    );
  };

  const renderFilter = () => {
    return (
      <Container fluid>
        <UIText>Filter by scheduled pickup date</UIText>
        <DatePicker
          isClearable={true}
          selected={filteredDate}
          onChange={setFilteredDate}
          maxDate={new Date()}
        />
      </Container>
    );
  };

  return (
    <Container>
      {renderModal()}
      {renderFilter()}
      <Grid columns={2}>
        <Grid.Row>
          <Grid.Column>
            <UIButton
              secondary
              onClick={createClicked}
              text={"Create new Supplier"}
              disabled={createDisabled}
            />
          </Grid.Column>
          <Grid.Column>
            <UIButton
              secondary
              onClick={importClicked}
              text={"Import suppliers"}
              disabled={importDisabled}
            />
          </Grid.Column>
        </Grid.Row>
      </Grid>
      {renderImporting()}
      {renderSuppliers()}
    </Container>
  );
}
