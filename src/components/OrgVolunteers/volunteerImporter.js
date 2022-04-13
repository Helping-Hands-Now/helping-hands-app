import React, { useState, useEffect } from "react";
import { camelCase } from "camel-case";
import UIImporter from "../UI/UIImporter";
import UIEditableTable from "../UI/UIEditableTable";
import { Container, Loader, Dimmer, Message } from "semantic-ui-react";
import UIText from "../UI/UIText";
import UIButton from "../UI/UIButton";
import { useTranslation } from "react-i18next";
import Table from "./../EnterpriseConsole/table";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import GeohashDistance from "geohash-distance";
import {
  createVolunteerOfOrganization,
  editVolunteerOfOrganization,
  checkExistingOrgVolunteer,
  signUpPartnerVolunteerForCommunityDeliveryEvent,
  queryCommunityDeliveryEvents,
} from "../../firebase.js";
import EventDropdown from "../EventDropdown";

import firebase from "../../firebase";
import OrgDropdown from "./../OrgDropdown";

export default function ImportVolunteers({
  done,
  nextHandler,
  setRecipientData,
  onFileLoaded,
}) {
  const [loading, setLoading] = useState(false);
  // disable ability to save volunteers until we get a placeId for all of them
  const [disabled, setDisabled] = useState(true);

  // these needed to bucket users as needed
  const [showInvalid, setShowInvalid] = useState(false);
  const [showExisting, setShowExisting] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [invalidData, setInvalidData] = useState([]);
  const [existingData, setExistingData] = useState([]);
  const [newData, setNewData] = useState([]);
  const [showImporter, setShowImporter] = useState(true);
  const [saveVisible, setSaveVisible] = useState(false);
  const [loaderActive, setLoaderActive] = useState(false);
  const [nextLoading, setNextLoading] = useState(false);
  const [currentOrgId, setCurrentOrgId] = useState(null);
  const [currentEventId, setCurrentEventId] = useState(null);
  const [confirmationStep, setConfirmationStep] = useState(null);

  const { t } = useTranslation();

  const save = async (data) => {
    setLoading(true);
    // TODO: save volunteers
    // importVolunteersOfOrganization({
    //   organizationId: currentOrgId,
    //   volunteers: data,
    // })
    //   .then((r) => {
    //     // we've successfully imported volunteers
    //     done();
    //   })
    //   .catch((err) => {
    //     console.error("error importing new volunteers into org", err);
    //   })
    //   .finally(() => {
    //     setLoading(false);
    //   });
  };

  useEffect(() => {
    setShowInvalid(invalidData.length > 0);
    setShowExisting(existingData.length > 0);
    setShowNew(newData.length > 0);
    setSaveVisible(
      invalidData.length > 0 || existingData.length > 0 || newData.length > 0
    );
  }, [invalidData, existingData, newData]);

  const COLUMNS = [
    {
      Header: "First Name",
      accessor: "firstName",
    },
    {
      Header: "Last Name",
      accessor: "lastName",
    },
    {
      Header: "Email",
      accessor: "email",
    },
    {
      Header: "Phone",
      accessor: "phoneNumber",
    },
  ];

  const columns = React.useMemo(() => COLUMNS, []);

  const columnsWithResults = React.useMemo(
    () => [
      ...COLUMNS,
      {
        Header: "Status",
        accessor: "status",
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
    email: {
      regexes: [/email/i],
      compare: true,
      format: formatStr,
    },
    phoneNumber: {
      regexes: [/phone/i, /phoneNumber/i],
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

        if (datum.numVolunteers) {
          datum.numVolunteers = parseInt(datum.numVolunteers, 10);
        }

        return datum;
      })
      .filter(Boolean);
  };

  const validateEmail = async (datum) => {
    const parsedEmail = datum.email ? datum.email.toString() : "";
    if (!parsedEmail || !/^[^\s@]+@[^\s@]+$/.test(parsedEmail)) {
      return [{}, true];
    }

    let result = await checkExistingOrgVolunteer({
      email: datum.email,
      orgId: currentOrgId,
    });
    if (!result.data) {
      return [{}, false];
    }
    // data exists...
    const existingVal = result.data.email;
    const newVal = datum.email;
    let changedData = false;
    if (existingVal !== newVal) {
      return [{}, false];
    } else {
      changedData = true;
    }
    // for (const key in headers) {
    //   let value = headers[key];
    //   if (!value.compare) {
    //     continue;
    //   }
    //   let existingVal = result.data[key];
    //   let newVal = datum[key];
    //   if (value.format) {
    //     existingVal = value.format(existingVal);
    //     newVal = value.format(newVal);
    //   }
    //   changedData = existingVal !== newVal;
    //   if (changedData) {
    //     console.log("changed", "key", key, existingVal, newVal);
    //     break;
    //   }
    // }
    return [
      {
        existingMember: true,
        userProfile: result.data,
        changedData,
      },
      null,
    ];
  };

  const validatePhoneNumber = async (datum) => {
    const parsedNumber = parsePhoneNumberFromString(
      datum.phoneNumber ? datum.phoneNumber.toString() : "",
      "US"
    );
    if (!parsedNumber || !parsedNumber.isPossible()) {
      return [{}, true];
    }
    return [{}, false];
  };

  const validateAllData = async (data, setData) => {
    setLoaderActive(true);
    let invalidVolunteers = [];
    let existingVolunteers = [];
    let newVolunteers = [];
    let changedExistingVolunteers = new Map();

    data = await Promise.all(
      data.map(async (datum) => {
        let [emailInfo, phoneNumberInfo] = await Promise.all([
          validateEmail(datum),
          validatePhoneNumber(datum),
        ]);
        let [email, invalidEmail] = emailInfo;
        let [existingDataInfo, invalidPhoneNumber] = phoneNumberInfo;

        // merge all these three into the result
        datum = {
          ...datum,
          ...email,
          ...existingDataInfo,
        };

        if (existingDataInfo.changedData) {
          changedExistingVolunteers.set(existingDataInfo.userProfile.id, true);
        }

        if (invalidPhoneNumber) {
          datum.invalidField = "phoneNumber";
          invalidVolunteers.push(datum);
        } else if (invalidEmail) {
          datum.invalidField = "email";
          invalidVolunteers.push(datum);
        } else if (email.existingMember) {
          existingVolunteers.push(datum);
        } else {
          newVolunteers.push(datum);
        }

        return datum;
      })
    );

    setInvalidData(invalidVolunteers);
    setExistingData(existingVolunteers);
    setNewData(newVolunteers);

    setShowImporter(false);

    setLoaderActive(false);
    if (onFileLoaded) {
      onFileLoaded();
    }
  };

  const onEdit = async (col, datum) => {
    return { ...datum };
  };

  const onEditExisting = async (col, datum) => {
    const id = datum.userProfile.id;
    return await onEdit(col, datum);
  };

  // editing new is the same, we're going to save after so not much to do here
  const onEditNew = async (col, datum) => {
    return await onEdit(col, datum);
  };

  const saveButtonText = (data) => {
    return `save ${data.length} volunteers`;
  };

  const renderTable = (
    visible,
    data,
    setData,
    label,
    onEdit,
    cols = columns
  ) => {
    return (
      visible && (
        <div>
          <UIText>{label}</UIText>
          <UIEditableTable
            data={data}
            setData={setData}
            columns={cols}
            disableSaveButton={true}
            onEdit={onEdit}
            disableEdit={true}
          />
        </div>
      )
    );
  };

  // marks existing users as volunteers of org and sign them
  // up for the CD event
  const saveExisting = async () => {
    if (!existingData.length) {
      return;
    }
    return await Promise.all(
      existingData.map(async (data) => {
        let userId = data.userProfile.id;
        const profileData = {
          ...data.userProfile,
          // overwrite anything from recipientData as the new field
          ...data,
          organizationId: currentOrgId,
        };

        let r = await editVolunteerOfOrganization(profileData);

        let signUpData = {
          eventId: currentEventId,
          userId,
          isNewUser: false,
        };

        // Sign up a user for an event
        await signUpPartnerVolunteerForCommunityDeliveryEvent(signUpData)
          .then((result) => {
            data.status = "Success";
          })
          .catch((err) => {
            console.error(
              "[saveExisting] Error signing up user for event:",
              err
            );
            data.status = "Failed";
          });
      })
    );
  };

  const saveNew = async () => {
    if (!newData.length) {
      return;
    }

    return await Promise.all(
      newData.map(async (row) => {
        row.organizationId = currentOrgId;
        const r = await createVolunteerOfOrganization(row);
        const userId = r.data;
        row.id = userId;

        let signUpData = {
          eventId: currentEventId,
          userId,
          isNewUser: true,
        };

        if (typeof userId === "undefined" || userId === null) {
          console.log(
            "[volunteerImporter] Error: userId is null for row:",
            row
          );
          row.status = "Failed";
        } else {
          // Sign up a user for an event
          await signUpPartnerVolunteerForCommunityDeliveryEvent(signUpData)
            .then((result) => {
              row.status = "Success";
            })
            .catch((err) => {
              console.error("[saveNew] Error signing up user for event:", err);
              row.status = "Failed";
            });
        }
      })
    );
  };

  const saveAllTheThings = async () => {
    setLoaderActive(true);

    let results = await Promise.all([saveExisting(), saveNew()]);

    if (setRecipientData) {
      setRecipientData({
        existing: existingData,
        new: newData,
      });
    }
    setLoaderActive(false);
    setConfirmationStep(true);
    setSaveVisible(false);
  };

  return (
    <Container>
      <Message warning>
        <Message.Header>This is a pilot product.</Message.Header>
        <p>
          Any partner uploads will only apply to scheduled Community Delivery
          events.
        </p>
      </Message>

      {showImporter && (
        <Container>
          <OrgDropdown
            setCurrentOrgId={setCurrentOrgId}
            currentOrgId={currentOrgId}
          />

          <UIText>Upload Volunteer CSV File</UIText>

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
          <a href="/helping_hands_enterprise_console_volunteer_example.csv">
            Download example CSV file
          </a>
          <UIText>
            File format CSV
            <br />
            <br />
            Column headers required in the bulk file:
            <li>First Name</li>
            <li>Last Name</li>
            <li>Email</li>
            <li>Phone</li>
          </UIText>
        </Container>
      )}
      {saveVisible && (
        <h1 style={{ fontSize: "24px", textAlign: "center" }}>
          {t("Review Volunteers")}
        </h1>
      )}
      {confirmationStep && (
        <h1 style={{ fontSize: "24px", textAlign: "center" }}>
          {t("Upload Complete!")}
        </h1>
      )}
      {showInvalid && (
        <Container style={{ marginBottom: "10px" }}>
          <UIText>Invalid Volunteers</UIText>
          <div>
            These volunteers have invalid information. Please re-upload their
            info in an updated CSV or proceed without them.
          </div>
          <Table columns={columns} data={invalidData} disableSelect={true} />
        </Container>
      )}
      {renderTable(
        showExisting && !confirmationStep,
        existingData,
        setExistingData,
        "Existing Volunteers",
        onEditExisting
      )}
      {renderTable(
        showNew && !confirmationStep,
        newData,
        setNewData,
        "New Volunteers",
        onEditNew
      )}

      <Dimmer active={loaderActive}>
        <Loader inverted>{t("loading")}</Loader>
      </Dimmer>
      {saveVisible && (
        <>
          {/* next button being here is kinda weird but the flow is complicated so we're
        leaving it here */}
          <EventDropdown
            currentOrgId={currentOrgId}
            setCurrentEventId={setCurrentEventId}
            currentEventId={currentEventId}
          />
          <Container textAlign="center">
            <UIButton
              text="Next"
              onClick={() => saveAllTheThings()}
              primary
              loading={nextLoading}
            />
          </Container>
        </>
      )}
      {confirmationStep &&
        renderTable(
          true,
          [...newData, ...existingData],
          () => {},
          "User Upload Status",
          () => {},
          columnsWithResults
        )}
    </Container>
  );
}
