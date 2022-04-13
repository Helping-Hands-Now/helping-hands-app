import React, { useState, useEffect } from "react";
import { Grid } from "semantic-ui-react";
import UIButton from "../UI/UIButton";
import UIInput from "../UI/UIInput";
import UIText from "../UI/UIText";
import UIDropdown from "../UI/UIDropdown";
import DatePicker from "react-datepicker";
import moment from "moment";
import "./communityEvents.css";
import { createCommunityDeliveryEvent } from "../../firebase.js";
import { AsYouType } from "libphonenumber-js";
import RichTextEditor from "../RichTextEditor";
import { EditorState, convertToRaw } from "draft-js";
import "draft-js/dist/Draft.css";
import { useTranslation } from "react-i18next";

export default function CommunityEvents(props) {
  const { t } = useTranslation();

  const getTimezoneAbbreviation = () => {
    var timeZone = moment.tz.guess();
    var time = new Date();
    var timeZoneOffset = time.getTimezoneOffset();

    return moment.tz.zone(timeZone).abbr(timeZoneOffset);
  };

  const [loading, setLoading] = useState(false);
  const [eventName, setEventName] = useState("");
  const [editorState, setEditorState] = useState(() =>
    EditorState.createEmpty()
  );
  const [supplierID, setSupplierID] = useState("");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [maxVolunteers, setMaxVolunteers] = useState(5);
  const [recipientsPerVolunteer, setRecipientsPerVolunteer] = useState(5);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [phoneNumberExtension, setPhoneNumberExtension] = useState("");
  const timezone = getTimezoneAbbreviation();

  const [eventNameError, setEventNameError] = useState("");
  const [supplierIDError, setSupplierIDError] = useState("");

  const closeModal = () => {
    setEventName("");
    setEditorState(EditorState.createEmpty());
    setSupplierID("");
    setSelectedDate(new Date());
    setMaxVolunteers(5);
    setRecipientsPerVolunteer(5);
  };

  const createCommunityDeliveryEventOnClick = () => {
    var now = new Date();
    var payload = {
      eventName: eventName,
      organizationID: props.currentOrg,
      orgDescription: JSON.stringify(
        convertToRaw(editorState.getCurrentContent())
      ),
      supplierID: supplierID,
      eventTime: selectedDate.getTime(),
      phoneNumber: phoneNumber,
      phoneNumberExtension: phoneNumberExtension,
      maxVolunteers: maxVolunteers,
      recipientsPerVolunteer: recipientsPerVolunteer,
      timeCreated: now.getTime(),
      timeUpdated: now.getTime(),
    };
    setLoading(true);
    createCommunityDeliveryEvent(payload)
      .then((result) => {
        setLoading(false);
        closeModal();
        props.setShowEnterpriseConsole(true);
      })
      .catch(function (error) {
        setLoading(false);
      });
  };

  const handleDatePickerChange = (date) => {
    if (date && date.getTime() !== selectedDate.getTime()) {
      setSelectedDate(date);
    }
  };

  let options = props.suppliers.map((supplier) => {
    return {
      key: supplier.id,
      value: supplier.id,
      text: supplier.name,
    };
  });

  let volunteerOptions = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => {
    return {
      key: num,
      value: num,
      text: `${num} Volunteer${num > 1 ? "s" : ""}`,
    };
  });

  let recipientPerVolunteerOptions = Array.from(
    { length: 10 },
    (_, i) => i + 1
  ).map((num) => {
    return {
      key: num,
      value: num,
      text: `${num} Recipient${num > 1 ? "s" : ""}`,
    };
  });

  return (
    <div className="communityRequestsContainer">
      <Grid columns="equal" stackable>
        <Grid.Column>
          <div className="communityListDescription">
            <h1 className="communityRequestDescriptionHeader">
              Community Delivery
            </h1>
            <p className="requestDescription">
              Helping Hands Community teams up with trusted organizations so
              that we can scale our efforts and make a greater impact. When you
              create a Community Delivery event you’ll be asking volunteers to
              complete deliveries of pre-packaged food to those who need it
              most.
            </p>
            <p className="requestDescription">
              The goal is to recruit enough volunteers to fulfill all the needed
              runs. If there is a shortage of volunteers a ride share service
              will deliver the remaining packages.
            </p>
            <p className="requestDescription">
              <a
                class="howDoesItWorkLink"
                href="https://www.notion.so/How-Community-Delivery-works-54bc9cbf5ff94e5b8f04fa927d89ab67"
                target="_blank">
                {t("requestDescCommHowDoesItWork")}
              </a>
            </p>
          </div>
        </Grid.Column>
        <Grid.Column width={10}>
          <h1 className="header">Create a Community Delivery Event</h1>
          <br />
          <UIInput
            label={"Event Name"}
            placeholder={"Ex. Deliver groceries with Acme Food Bank"}
            value={eventName}
            hook={(e) => setEventName(e.target.value)}
            error={eventNameError}
          />
          <br />
          <UIText className="pickupInstructionsHeader">
            Pick-up instructions
          </UIText>
          <RichTextEditor
            setEditorState={setEditorState}
            editorState={editorState}
          />
          <br />
          <br />
          <UIDropdown
            label={"Pick-up location"}
            placeholder={"None"}
            hook={(e, d) => setSupplierID(d.value)}
            selection
            defaultValue={""}
            value={supplierID || ""}
            options={options}
            error={supplierIDError}
          />
          <br />
          <UIText className="pickupInstructionsHeader">Check-in</UIText>
          <DatePicker
            label={"Start Time"}
            selected={selectedDate}
            onChange={(date) => handleDatePickerChange(date)}
            showTimeSelect
            dateFormat={`MMMM d, h:mm aa '${timezone}'`}
            className={"datepicker"}
            timeIntervals={15}
            timeFormat={`h:mm aa '${timezone}'`}
          />
          <br />
          <br />
          <br />
          <div>
            <Grid columns="equal" stackable>
              <Grid.Column width={6}>
                <UIInput
                  placeholder={phoneNumber}
                  label={"Primary phone number contact"}
                  hook={(e) =>
                    setPhoneNumber(new AsYouType("US").input(e.target.value))
                  }
                  value={phoneNumber}
                />
              </Grid.Column>
              <Grid.Column width={3}>
                <UIInput
                  placeholder={phoneNumberExtension}
                  label={"Extension"}
                  hook={(e) => setPhoneNumberExtension(e.target.value)}
                  value={phoneNumberExtension}
                />
              </Grid.Column>
            </Grid>
          </div>
          <div>
            <Grid columns="equal" stackable>
              <Grid.Column width={5}>
                <UIDropdown
                  label={"Volunteers requested"}
                  hook={(e, d) => setMaxVolunteers(d.value)}
                  selection
                  value={maxVolunteers}
                  options={volunteerOptions}
                />
              </Grid.Column>
            </Grid>
          </div>
          <br />
          <div>
            <Grid columns="equal" stackable>
              <Grid.Column width={5}>
                <UIDropdown
                  label={"Recipients per volunteer"}
                  hook={(e, d) => setRecipientsPerVolunteer(d.value)}
                  selection
                  value={recipientsPerVolunteer}
                  options={recipientPerVolunteerOptions}
                />
              </Grid.Column>
            </Grid>
          </div>
          <br />
          <div className="createPageBtnOptions">
            <UIButton
              primary
              loading={loading}
              onClick={createCommunityDeliveryEventOnClick}
              text={"Create Event"}
            />
            <div className="btnSpacer" />
            <UIButton
              destructive
              onClick={() => props.setShowEnterpriseConsole(true)}
              text={"Cancel"}
            />
          </div>
        </Grid.Column>
      </Grid>
    </div>
  );
}
