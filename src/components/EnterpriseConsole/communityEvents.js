import React, { useState, useEffect } from "react";
import { Tab, Container, Modal, Grid } from "semantic-ui-react";
import UIButton from "../UI/UIButton";
import UIInput from "../UI/UIInput";
import UIText from "../UI/UIText";
import UITextArea from "../UI/UITextArea";
import UIDropdown from "../UI/UIDropdown";
import DatePicker from "react-datepicker";
import TabItem from "../UI/UITabs";
import EventList from "../EventList";
import { db } from "../../firebase.js";
import moment from "moment";
import "./communityEvents.css";
import { editCommunityDeliveryEvent } from "../../firebase.js";
import { AsYouType } from "libphonenumber-js";
import RichTextEditor from "../RichTextEditor";
import { EditorState, convertToRaw, convertFromRaw } from "draft-js";
import "draft-js/dist/Draft.css";

export default function CommunityEvents(props) {
  const getTimezoneAbbreviation = () => {
    var timeZone = moment.tz.guess();
    var time = new Date();
    var timeZoneOffset = time.getTimezoneOffset();

    return moment.tz.zone(timeZone).abbr(timeZoneOffset);
  };

  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeTabIndex, setActiveTabIndex] = useState(0);
  const [communityDeliveryEvents, setCommunityDeliveryEvents] = useState([]);
  const [
    pastCommunityDeliveryEvents,
    setPastCommunityDeliveryEvents,
  ] = useState([]);
  const [inspectedCommunityEvent, setInspectedCommunityEvent] = useState("");

  const [eventName, setEventName] = useState("");
  const [editorState, setEditorState] = useState(
    () => -EditorState.createEmpty()
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
    setInspectedCommunityEvent("");

    setIsEventModalOpen(false);
  };

  const editEvent = (index) => {
    var communityEvent = communityDeliveryEvents[index];
    setEventName(communityEvent.eventName);
    try {
      setEditorState(
        EditorState.createWithContent(
          convertFromRaw(JSON.parse(communityEvent.orgDescription))
        )
      );
    } catch (e) {}
    setSupplierID(communityEvent.supplierID);
    setSelectedDate(new Date(communityEvent.eventTime.seconds * 1000));
    setMaxVolunteers(communityEvent.maxVolunteers);
    setRecipientsPerVolunteer(communityEvent.recipientsPerVolunteer);
    setInspectedCommunityEvent(communityEvent.id);
    setPhoneNumber(communityEvent.phoneNumber);
    setPhoneNumberExtension(communityEvent.phoneNumberExtension);

    setIsEventModalOpen(true);
  };

  const editCommunityDeliveryEventOnClick = () => {
    var now = new Date();
    var payload = {
      eventName: eventName,
      communityEvent: inspectedCommunityEvent,
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
    editCommunityDeliveryEvent(payload)
      .then((result) => {
        setLoading(false);
        closeModal();
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

  const updateCurrentEvents = (promises) => {
    var now = new Date();
    var arr1 = [];
    var arr2 = [];
    var c = 0;
    promises.forEach(([eventObj, supplier, volunteers]) => {
      var supplierObj;
      var volunteersObj = {};
      Promise.resolve(supplier)
        .then((result) => {
          supplierObj = result.data();
          return Promise.all(volunteers);
        })
        .then((results) => {
          var promises = [];
          results.forEach((result) => {
            volunteersObj[result.id] = result.data();
            promises.push(db.collection("users").doc(result.id).get());
          });
          return Promise.all(promises);
        })
        .then((results) => {
          results.forEach((result) => {
            volunteersObj[result.id].personalInfo = result.data();
          });
        })
        .then(() => {
          var promises = [];
          eventObj.volunteers.forEach((volunteer) => {
            volunteersObj[volunteer].assignedRequests.forEach((request) => {
              promises.push(db.collection("requests").doc(request).get());
            });
            volunteersObj[volunteer].assignedRequests = {};
          });
          return Promise.all(promises);
        })
        .then((results) => {
          var promises = [];
          results.forEach((result) => {
            var requestObj = result.data();
            promises.push([
              result.id,
              requestObj,
              db.collection("users").doc(requestObj.requester).get(),
            ]);
          });
          return Promise.all(promises.map(Promise.all.bind(Promise)));
        })
        .then((results) => {
          results.forEach(([requestID, requestObj, requester]) => {
            if (!requestObj.helper) {
              // Request is assigned to a volunteer but it does not have a matching helper.
              // This request was probably cancelled, ig nore it
              return;
            }
            volunteersObj[requestObj.helper].assignedRequests[
              requestID
            ] = requestObj;
            volunteersObj[requestObj.helper].assignedRequests[
              requestID
            ].requesterInfo = requester.data();
          });
        })
        .then(() => {
          eventObj.supplierInfo = supplierObj;
          eventObj.volunteerInfo = volunteersObj;
          if (eventObj.eventTimeEnd.seconds * 1000 > now.getTime()) {
            arr1.push(eventObj);
          } else if (eventObj.eventTimeEnd.seconds * 1000 < now.getTime()) {
            arr2.push(eventObj);
          }
          c++;
          if (c === promises.length) {
            arr1 = arr1.sort(function (a, b) {
              return a.eventTime.seconds - b.eventTime.seconds;
            });
            setCommunityDeliveryEvents(arr1);

            arr2 = arr2.sort(function (a, b) {
              return b.eventTime.seconds - a.eventTime.seconds;
            });
            setPastCommunityDeliveryEvents(arr2);
          }
        });
    });
  };

  useEffect(() => {
    db.collection("community_events")
      .where("organizationID", "==", props.currentOrg)
      .onSnapshot(function (querySnapshot) {
        var promises = [];
        querySnapshot.forEach(function (event) {
          var obj = event.data();
          obj.id = event.id;
          var volunteerPromises = [];
          obj.volunteers.forEach((volunteer) => {
            volunteerPromises.push(
              db
                .collection("community_events")
                .doc(event.id)
                .collection("volunteers")
                .doc(volunteer)
                .get()
            );
          });
          // event, supplier, volunteers
          promises.push([
            obj,
            db.collection("suppliers").doc(event.data().supplierID).get(),
            volunteerPromises,
          ]);
        });
        return updateCurrentEvents(promises);
      });
  }, [props.currentOrg]);

  let options = props.suppliers.map((supplier) => {
    return {
      key: supplier.id,
      value: supplier.id,
      text: supplier.name,
    };
  });

  const panes = [
    {
      menuItem: (
        <TabItem
          onClick={() => setActiveTabIndex(0)}
          title={"Current/Future Events"}
          currentIndex={activeTabIndex}
          index={0}
          key={"0"}
        />
      ),
      render: () => (
        <div>
          <div className="CreateNewCommunityEventBtnContainer">
            <UIButton
              secondary
              onClick={() => props.setShowEnterpriseConsole(false)}
              text={"Create new Event"}
            />
          </div>
          <EventList
            editable
            admin
            editCallback={editEvent}
            events={communityDeliveryEvents}
          />
        </div>
      ),
    },
    {
      menuItem: (
        <TabItem
          onClick={() => setActiveTabIndex(1)}
          title={"Past Events"}
          currentIndex={activeTabIndex}
          index={1}
          key={"1"}
        />
      ),
      render: () => (
        <div>
          <EventList admin past events={pastCommunityDeliveryEvents} />
        </div>
      ),
    },
  ];

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
    <Container>
      <Modal
        open={isEventModalOpen}
        className="modal"
        closeIcon
        onClose={closeModal}>
        <Modal.Header>
          <h1>Edit a new community Delivery Event</h1>
        </Modal.Header>
        <Container className="modalContainer">
          <UIInput
            label={"Event Name"}
            placeholder={"Ex. Deliver groceries with Acme Food Bank"}
            value={eventName}
            hook={(e) => setEventName(e.target.value)}
            error={eventNameError}
          />
          <UIText className="pickupInstructionsHeader">
            Pick-up instructions
          </UIText>
          <RichTextEditor
            setEditorState={setEditorState}
            editorState={editorState}
          />
          <br />
          <UIDropdown
            label={"Select a supplier"}
            placeholder={"None"}
            hook={(e, d) => setSupplierID(d.value)}
            selection
            defaultValue={""}
            value={supplierID || ""}
            options={options}
            error={supplierIDError}
          />
          <UIText className="pickupInstructionsHeader">Check-in time</UIText>
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
              <Grid.Column width={5}>
                <UIDropdown
                  label={"Number of volunteers needed"}
                  hook={(e, d) => setMaxVolunteers(d.value)}
                  selection
                  value={maxVolunteers}
                  options={volunteerOptions}
                />
              </Grid.Column>
            </Grid>
          </div>
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
                  label={"Ext."}
                  hook={(e) => setPhoneNumberExtension(e.target.value)}
                  value={phoneNumberExtension}
                />
              </Grid.Column>
            </Grid>
          </div>
          <br />
          <UIButton
            secondary
            loading={loading}
            onClick={editCommunityDeliveryEventOnClick}
            text={"Update"}
          />
        </Container>
      </Modal>
      <Tab
        menu={{ pointing: false, text: true }}
        panes={panes}
        activeIndex={activeTabIndex}
      />
    </Container>
  );
}
