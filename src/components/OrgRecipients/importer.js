import React, { useState, useEffect } from "react";
import {
  importRecipientsOfOrganization,
  editRecipientOfOrganization,
  validateAddress,
  checkExistingOrgMember,
} from "../../firebase.js";
import { camelCase } from "camel-case";
import UIImporter from "../UI/UIImporter";
import UIEditableTable from "../UI/UIEditableTable";
import { Container, Loader, Dimmer } from "semantic-ui-react";
import UIText from "../UI/UIText";
import UIButton from "../UI/UIButton";
import { useTranslation } from "react-i18next";
import Table from "./../EnterpriseConsole/table";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import GeohashDistance from "geohash-distance";

const MAX_DISTANCE_UBER = 5.0;
const MAX_DISTANCE_LYFT = 25.0;

const PROVIDERS = Object.freeze({
  UBER: "UBER",
  LYFT: "LYFT",
  AXELHIRE: "AXELHIRE",
  OTHERS: "N/A",
});

export default function ImportRecipients({
  currentOrg,
  done,
  nextHandler,
  setRecipientData,
  onFileLoaded,
  validateDistanceGeoHash,
  courier,
  supplier,
}) {
  const [loading, setLoading] = useState(false);
  // disable ability to save recipients until we get a placeId for all of them
  const [disabled, setDisabled] = useState(true);

  // these needed to bucket users as needed
  const [showDuplicateData, setShowDuplicateData] = useState(false);
  const [duplicateData, setDuplicateData] = useState([]);
  const [showInvalid, setShowInvalid] = useState(false);
  const [showExisting, setShowExisting] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [invalidData, setInvalidData] = useState([]);
  const [existingData, setExistingData] = useState([]);
  const [changedExistingIDs, setChangedExistingIDs] = useState(new Map());
  const [newData, setNewData] = useState([]);
  const [showImporter, setShowImporter] = useState(true);
  const [saveVisible, setSaveVisible] = useState(false);
  const [loaderActive, setLoaderActive] = useState(false);
  const [nextLoading, setNextLoading] = useState(false);
  const { t } = useTranslation();

  const save = async (data) => {
    setLoading(true);
    importRecipientsOfOrganization({
      organizationId: currentOrg,
      recipients: data,
    })
      .then((r) => {
        // we've successfully imported recipients
        done();
      })
      .catch((err) => {
        console.error("error importing new recipients into org", err);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    setShowDuplicateData(duplicateData.length > 0);
    setShowInvalid(invalidData.length > 0);
    setShowExisting(existingData.length > 0);
    setShowNew(newData.length > 0);
    setSaveVisible(
      invalidData.length > 0 ||
        existingData.length > 0 ||
        newData.length > 0 ||
        duplicateData.length > 0
    );
  }, [invalidData, existingData, newData, duplicateData]);

  const columns = React.useMemo(
    () => [
      {
        Header: "First Name",
        accessor: "firstName",
      },
      {
        Header: "Last Name",
        accessor: "lastName",
      },
      {
        Header: "Street",
        accessor: "street",
      },
      {
        Header: "Apartment",
        accessor: "apartment",
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
        accessor: "zipCode",
      },
      {
        Header: "Phone Number",
        accessor: "phoneNumber",
      },
      {
        Header: "Dropoff Instructions",
        accessor: "dropoffInstructions",
      },
      {
        Header: "Number of Recipients",
        accessor: "numRecipients",
      },
    ],
    []
  );

  const formatStr = (val) => {
    if (!val) {
      return ""; // convert nulls and undefined to empty strings for the comparison
    }
    // convert to string first just in case e.g. apartment number
    return val.toString().trim();
  };
  // need to do this only once for the headers!
  // can rename as columns too
  let headers = {
    firstName: {
      regexes: [/firstName/i, /first/i],
      compare: true,
      format: formatStr,
    },
    lastName: {
      regexes: [/lastName/i, /last/i],
      compare: true,
      format: formatStr,
    },
    street: {
      regexes: [/street/i, /address/i],
      compare: true,
      format: formatStr,
    },
    city: {
      regexes: [/city/i],
      compare: true,
      format: formatStr,
    },
    state: {
      regexes: [/state/i],
      compare: true,
      format: formatStr,
    },
    zipCode: {
      aliases: ["zip"],
      regexes: [/zip/i],
      compare: true,
    },
    apartment: {
      aliases: ["apt"],
      regexes: [/apartment/i],
      compare: true,
      format: formatStr,
    },
    phoneNumber: {
      regexes: [/phone/i],
      compare: true,
      format: (val) => {
        const parsedNumber = parsePhoneNumberFromString(
          val ? val.toString() : "",
          "US"
        );
        if (!parsedNumber || !parsedNumber.isPossible()) {
          return null;
        }
        return parsedNumber.format("E.164");
      },
    },
    dropoffInstructions: {
      regexes: [/dropoff/i, /instructions/i],
      compare: true,
      format: formatStr,
    },
    numRecipients: {
      regexes: [/recipients/i],
      compare: true,
      format: (val) => {
        if (!val) {
          return 1;
        }
        return parseInt(val, 10);
      },
    },
    spouse: {
      regexes: [/spouse/i],
    },
  };

  let foundKeys = {};

  const transformHeader = (header) => {
    const markAsFound = (key) => {
      foundKeys[key] = true;
      return key;
    };
    let transformed = camelCase(header);
    if (headers[transformed]) {
      return markAsFound(transformed);
    }

    for (let key in headers) {
      // if we've already found the key, don't try any complicated things
      if (foundKeys[key]) {
        continue;
      }
      let value = headers[key];
      if (value.aliases) {
        for (let i = 0; i < value.aliases.length; ++i) {
          let alias = value.aliases[i];
          if (alias === transformed) {
            return markAsFound(key);
          }
        }
      }
      for (let i = 0; i < value.regexes.length; ++i) {
        let regex = value.regexes[i];
        if (regex.test(transformed)) {
          return markAsFound(key);
        }
      }
    }

    return transformed;
  };

  const dataFormatter = (data) => {
    return data
      .map((datum) => {
        // filter blank lines in the csv
        // if everything is null, it's a blank line, we should return null and filter it below
        // Also trim string fields that are non-null
        let hasData = false;
        for (const key in datum) {
          if (datum[key] === null) {
            continue;
          }
          hasData = true;

          if (typeof datum[key] === "string") {
            datum[key] = datum[key].trim();
          }
        }
        if (!hasData) {
          return null;
        }

        if (datum.spouse && datum.spouse !== "N/A") {
          datum.numRecipients = 2;
        }

        if (datum.numRecipients) {
          datum.numRecipients = parseInt(datum.numRecipients, 10);
        }

        return datum;
      })
      .filter(Boolean);
  };

  /**
   * Checks to see that instructions meet api requirements.
   * @param courier
   * @param {string} dropoffInstructions
   * @returns {{reason: string, isValid: boolean}}
   */
  const validateDropoffInstructions = ({ courier, dropoffInstructions }) => {
    if (dropoffInstructions?.length > 250) {
      return {
        isValid: false,
        reason: "Dropoff instruction text must be at most 250 characters.",
      };
    }

    return { isValid: true, reason: "" };
  };

  const validateAddressInfo = async (datum) => {
    let validateAddressData = {
      street: datum.street,
      city: datum.city,
      state: datum.state,
      zipCode: datum.zipCode,
      apartment: datum.apartment,
      skipApartmentCheck: !!datum.apartment, // Do not validate apartment as long as apartment is not an empty field
      skipAddressCheck: !!supplier.skipAddressValidation,
    };

    try {
      let response = await validateAddress(validateAddressData);
      const result = {
        geohash: response.data.data.geohash,
        placeId: response.data.data.placeId,
      };
      if (validateDistanceGeoHash) {
        let distance = GeohashDistance.inMiles(
          validateDistanceGeoHash,
          result.geohash
        );
        console.log("Validating against " + courier);
        if (courier === PROVIDERS.LYFT && distance >= MAX_DISTANCE_LYFT) {
          return [
            {},
            new Error(
              `${distance.toFixed(
                1
              )} > ${MAX_DISTANCE_LYFT} miles limit for Lyft`
            ),
          ];
        } else if (
          courier !== PROVIDERS.LYFT &&
          distance >= MAX_DISTANCE_UBER
        ) {
          return [
            {},
            new Error(
              `${distance.toFixed(
                1
              )} > ${MAX_DISTANCE_UBER} miles limit for Uber`
            ),
          ];
        }
      }

      return [result, null];
    } catch (error) {
      console.error(error.message);

      return [{}, error];
    }
  };

  const validatePhoneNumber = async (datum) => {
    const parsedNumber = parsePhoneNumberFromString(
      datum.phoneNumber ? datum.phoneNumber.toString() : "",
      "US"
    );

    if (!parsedNumber || !parsedNumber.isPossible()) {
      return [{}, true];
    }

    let result = await checkExistingOrgMember({
      firstName: datum.firstName,
      lastName: datum.lastName,
      phoneNumber: datum.phoneNumber,
      orgId: currentOrg,
    });
    if (!result.data) {
      return [{}, false];
    }
    // data exists...
    let changedData = false;
    for (const key in headers) {
      let value = headers[key];
      if (!value.compare) {
        continue;
      }
      let existingVal = result.data[key];
      let newVal = datum[key];
      if (value.format) {
        existingVal = value.format(existingVal);
        newVal = value.format(newVal);
      }
      changedData = existingVal !== newVal;
      if (changedData) {
        console.log("changed", "key", key, existingVal, newVal);
        break;
      }
    }
    return [
      {
        existingMember: true,
        userProfile: result.data,
        changedData,
      },
      false,
    ];
  };

  const validateAllData = async (data, setData) => {
    setLoaderActive(true);
    let invalidRecipients = [];
    let existingRecipients = [];
    let newRecipients = [];
    let changedExistingRecipients = new Map();
    let phoneAddressDict = {};
    let duplicateRecipients = [];

    data = await Promise.all(
      data.map(async (datum) => {
        let [addressInfo, phoneNumberInfo] = await Promise.all([
          validateAddressInfo(datum),
          validatePhoneNumber(datum),
        ]);
        let [placeData, addressError] = addressInfo;

        let [existingDataInfo, invalidPhoneNumber] = phoneNumberInfo;

        const {
          isValid: dropoffInstructionsValid,
          reason: dropOffInstructionsFailureReason,
        } = validateDropoffInstructions({
          courier,
          dropoffInstructions: datum.dropoffInstructions,
        });

        let phoneAddressConcat = datum["street"] + datum["phoneNumber"];
        if (!phoneAddressDict[phoneAddressConcat]) {
          phoneAddressDict[phoneAddressConcat] = [];
        }
        phoneAddressDict[phoneAddressConcat].push(datum);

        // merge all these three into the result
        datum = {
          ...datum,
          ...placeData,
          ...existingDataInfo,
        };

        if (existingDataInfo.changedData) {
          changedExistingRecipients.set(existingDataInfo.userProfile.id, true);
        }

        // addressError
        if (addressError) {
          console.log(addressError, typeof addressError);
          datum.invalidField = "address";
          if (typeof addressError === "string") {
            datum.errorMessage = addressError;
          } else if (addressError.message) {
            datum.errorMessage = addressError.message;
          } else {
            datum.errorMessage = JSON.stringify(addressError);
          }
          invalidRecipients.push(datum);
        } else if (invalidPhoneNumber) {
          datum.invalidField = "phoneNumber";
          invalidRecipients.push(datum);
        } else if (!dropoffInstructionsValid) {
          datum.invalidField = "dropoffInstructions";
          datum.errorMessage = dropOffInstructionsFailureReason;
          invalidRecipients.push(datum);
        } else if (existingDataInfo.existingMember) {
          existingRecipients.push(datum);
        } else {
          newRecipients.push(datum);
        }

        return datum;
      })
    );

    Object.keys(phoneAddressDict).forEach(function (key) {
      if (phoneAddressDict[key].length > 1) {
        let count = 0;
        phoneAddressDict[key].forEach(function (item) {
          count += 1;
          if (count == phoneAddressDict[key].length) {
            item.warningMessage =
              "Duplicate phone and address : " +
              item["street"] +
              " + " +
              item["phoneNumber"];
          }
          duplicateRecipients.push(item);
        });
      }
    });

    setDuplicateData(duplicateRecipients);
    setInvalidData(invalidRecipients);
    setExistingData(existingRecipients);
    setNewData(newRecipients);

    setChangedExistingIDs(changedExistingRecipients);
    setShowImporter(false);

    setLoaderActive(false);
    if (onFileLoaded) {
      onFileLoaded();
    }
  };

  const onEdit = async (col, datum) => {
    let addressKeys = {
      street: true,
      city: true,
      state: true,
      zipCode: true,
      apartment: true,
    };
    // didn't change address nothing to do here
    if (!addressKeys[col]) {
      return datum;
    }

    let [datumWithPlaces, error] = await validateAddressInfo(datum);
    if (error) {
      // TODO need to handle this error in new flow
      console.error(error);
    }
    return { ...datum, ...datumWithPlaces };
  };

  const onEditExisting = async (col, datum) => {
    const id = datum.userProfile.id;
    changedExistingIDs.set(id, true);
    setChangedExistingIDs(changedExistingIDs);
    return await onEdit(col, datum);
  };

  // editing new is the same, we're going to save after so not much to do here
  const onEditNew = async (col, datum) => {
    return await onEdit(col, datum);
  };

  const saveButtonText = (data) => {
    return `save ${data.length} recipients`;
  };

  const renderTable = (visible, data, setData, label, onEdit) => {
    return (
      visible && (
        <div>
          <UIText>{label}</UIText>
          <UIEditableTable
            data={data}
            setData={setData}
            columns={columns}
            disableSaveButton={true}
            onEdit={onEdit}
          />
        </div>
      )
    );
  };

  const saveExisting = async () => {
    if (!existingData.length) {
      return;
    }
    let promises = [];
    existingData.forEach((recipientData) => {
      let id = recipientData.userProfile.id;
      // nothing changed here, nothing to save
      if (!changedExistingIDs.has(id)) {
        return;
      }
      const profileData = {
        ...recipientData.userProfile,
        // overwrite anything from recipientData as the new field
        ...recipientData,
      };
      console.log("editing existing", profileData);
      promises.push(editRecipientOfOrganization(profileData));
    });
    // edit all the recipients
    await Promise.all(promises).catch((err) => {
      // TODO we need to show error if there's one saving
      console.error(err);
    });
  };

  const saveNew = async () => {
    if (!newData.length) {
      return;
    }
    const result = await importRecipientsOfOrganization({
      organizationId: currentOrg,
      recipients: newData,
    });

    // this is safe because we send a list up and go overin order
    if (result.data.userIds.length !== newData.length) {
      throw new Error("weird error saving");
    }
    // get the ids and save it because we need it for creating trips
    for (let i = 0; i < newData.length; i++) {
      const id = result.data.userIds[i];
      newData[i].id = id;
    }
    setNewData(newData);
  };

  const saveAllTheThings = async () => {
    setNextLoading(true);

    await Promise.all([saveExisting(), saveNew()]);

    if (setRecipientData) {
      setRecipientData({
        existing: existingData,
        new: newData,
      });
    }
    // shouldn't matter since we're moving on to next page
    setNextLoading(false);
    nextHandler();
  };

  return (
    <Container>
      {showImporter && (
        <Container>
          <UIText>Upload Recipient CSV File</UIText>

          <UIImporter
            columns={columns}
            save={save}
            dataFormatter={dataFormatter}
            dataProcesser={validateAllData}
            onEdit={onEdit}
            saveButtonText={saveButtonText}
            transformHeader={transformHeader}
            loading={loading}
            disabled={disabled}
            disableRenderTable={true}
          />
          <a href="/helping_hands_enterprise_console_recipients_example.csv">
            Download example CSV file
          </a>
        </Container>
      )}
      {saveVisible && (
        <h1 style={{ fontSize: "24px", textAlign: "center" }}>
          {t("reviewRecipients")}
        </h1>
      )}
      {showInvalid && (
        <Container style={{ marginBottom: "10px" }}>
          <UIText>Invalid Recipients</UIText>
          <div>
            These recipients have invalid information and cannot be scheduled.
            Please re-upload their info in an updated CSV or proceed without
            them.
          </div>
          <Table columns={columns} data={invalidData} disableSelect={true} />
        </Container>
      )}
      {showDuplicateData && (
        <Container style={{ marginBottom: "10px" }}>
          <UIText>Duplicate Recipients</UIText>
          <div>
            These recipients have duplicate addresses and phone numbers. We can
            still proceed forward even if these warnings are ignored.
          </div>
          <Table columns={columns} data={duplicateData} disableSelect={true} />
        </Container>
      )}
      {renderTable(
        showExisting,
        existingData,
        setExistingData,
        "Existing Recipients",
        onEditExisting
      )}
      {renderTable(showNew, newData, setNewData, "New Recipients", onEditNew)}
      <Dimmer active={loaderActive}>
        <Loader inverted>{t("loading")}</Loader>
      </Dimmer>
      {saveVisible && (
        // next button being here is kinda weird but the flow is complicated so we're
        // leaving it here
        <Container textAlign="center">
          <UIButton
            text="Next"
            onClick={() => saveAllTheThings()}
            primary
            loading={nextLoading}
          />
        </Container>
      )}
    </Container>
  );
}
