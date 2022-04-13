import React, { useState, useEffect } from "react";
import { Container, Grid, Form, GridRow, Dropdown } from "semantic-ui-react";
import OrgAddress from "../OrgAddress";
import { useTable } from "react-table";
import UIReactTable from "../UI/UIReactTable";
import {
  createRequestsForOrganization,
  querySupplierTimeZone,
} from "../../firebase.js";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import UIButton from "../UI/UIButton";
import moment from "moment-timezone";
import RMoment from "react-moment";
import { convertCompilerOptionsFromJson } from "typescript";
import geohash from "ngeohash";

export default function SendToDispatch(props) {
  const courier = props.courier;
  const localTimeZone = moment.tz.guess();
  const schedulingInterval = 15;
  const minBatchSize = 5;
  const maxBatchSize = 80;
  const [loading, setLoading] = useState(false);
  const [timeZone, setTimeZone] = useState(localTimeZone);

  const getNextFifteenMinInterval = () => {
    var date = moment(new Date());
    const remainder = 15 - (date.minute() % 15);
    return moment(date).add(remainder, "minutes").toDate();
  };

  const getTimezoneAbbreviation = (timeZone) => {
    return moment.tz(timeZone).zoneAbbr();
  };

  const [selectedDate, setSelectedDate] = useState(getNextFifteenMinInterval);
  const [endTime, setEndTime] = useState(null);
  const [pickupsPer, setPickupsPer] = useState(10);
  const [pickupBuckets, setPickupBuckets] = useState([]);
  const [data, setData] = useState([]);
  const [timeZoneAbbr, setTimeZoneAbrr] = useState(
    getTimezoneAbbreviation(timeZone)
  );
  const [TimeZoneOptions, setTimeZoneOptions] = useState([]);

  const filterTimeZones = (timeZones) => {
    return timeZones.filter((timeZone) => {
      if (timeZone.key === "Local Time" || timeZone.key === "Supplier Time") {
        return timeZone;
      }
      if (
        moment.tz(timeZone.value).format("Z") !==
        moment.tz(localTimeZone).format("Z")
      ) {
        return timeZone;
      }
    });
  };

  useEffect(() => {
    const recipientsMap = props.recipientsMap;

    let displayData = [];
    props.suppliers.forEach((supplierInfo) => {
      let supplier = supplierInfo.supplier;

      let recipients = recipientsMap[supplier.id];

      if (!recipients) {
        return;
      }

      recipients.forEach((recipient) => {
        if (recipient.lastName === null) {
          recipient.lastName = "";
        }
        displayData.push({
          supplierName: supplier.name,
          recipientName: recipient.firstName + " " + recipient.lastName,
          numRecipients: parseInt(recipient.numRecipients, 10) || 1,
          deliveryAddressInfo: recipient,
        });
      });
    });
    setData(displayData);
  }, [props.suppliers, props.recipientsMap]);

  useEffect(() => {
    let supplier = props.suppliers[0].supplier;
    let supplierTimeZone = supplier.timeZone || null;

    var options = [
      {
        key: "Local Time",
        text: `Local Time (${getTimezoneAbbreviation(localTimeZone)})`,
        value: localTimeZone,
      },
      {
        key: "Supplier Time",
        text: `Supplier Time (${getTimezoneAbbreviation(supplierTimeZone)})`,
        value: supplierTimeZone,
      },
      {
        key: "Central Time",
        text: "Central Time",
        value: "America/Chicago",
      },
      {
        key: "Eastern Time",
        text: "Eastern Time",
        value: "America/New_York",
      },
      {
        key: "Pacific Time",
        text: "Pacific Time",
        value: "America/Los_Angeles",
      },
      {
        key: "Mountain Time",
        text: "Mountain Time",
        value: "America/Denver",
      },
      {
        key: "Arizona Time",
        text: "Arizona Time",
        value: "America/Phoenix",
      },
      {
        key: "Alaskan Time",
        text: "Alaskan Time",
        value: "America/Anchorage",
      },
      {
        key: "Hawaiian Time",
        text: "Hawaiian Time",
        value: "Pacific/Honolulu",
      },
    ];

    if (supplierTimeZone === null) {
      var latlng = geohash.decode(supplier.geohash);

      var result = querySupplierTimeZone({
        latitude: latlng.latitude,
        longitude: latlng.longitude,
        supplierId: supplier.id,
      }).then((result) => {
        supplierTimeZone = result.data;

        //update supplier timezone object with new value
        options[1] = {
          key: "Supplier Time",
          text: `Supplier Time(${getTimezoneAbbreviation(supplierTimeZone)})`,
          value: supplierTimeZone,
        };

        options = filterTimeZones(options);
        setTimeZoneOptions(options);
      });
    } else {
      options = filterTimeZones(options);
      setTimeZoneOptions(options);
    }
  }, [props.suppliers]);

  useEffect(() => {
    // only support the flow when there's one supplier
    if (props.suppliers.length !== 1) {
      return;
    }

    if (!pickupsPer) {
      return;
    }

    const supplier = props.suppliers[0];
    const recipients = props.recipientsMap[supplier.supplier.id];
    if (!recipients) {
      return;
    }
    const totalRecipients = recipients.length;

    const numPickupsPer = Math.floor(totalRecipients / pickupsPer);

    let startTime = selectedDate;
    let buckets = [];
    for (let i = 0; i < numPickupsPer; i++) {
      buckets.push({
        number: pickupsPer,
        startTime: startTime,
      });
      startTime = moment(startTime).add(15, "minutes").valueOf();
    }
    let remain = totalRecipients % pickupsPer;
    if (remain) {
      buckets.push({
        number: remain,
        startTime,
      });
    }
    setPickupBuckets(buckets);
  }, [pickupsPer, props.suppliers, selectedDate, props.recipientsMap]);

  const renderRecipientInfo = (row) => {
    let numRecipients = row.original.numRecipients;
    let numRecipientsInfo;
    if (numRecipients > 1) {
      numRecipientsInfo = `${numRecipients} recipients at this location`;
    }
    return (
      <>
        <Container fluid>
          <div>{row.original.recipientName}</div>
          <div>{numRecipientsInfo}</div>
        </Container>
      </>
    );
  };

  const columns = React.useMemo(
    () => [
      {
        Header: "Pickup",
        accessor: "supplierName",
      },
      {
        Header: "Recipient",
        Cell: ({ row }) => renderRecipientInfo(row),
      },
      {
        Header: "Address",
        Cell: ({ row }) => (
          <OrgAddress profile={row.original.deliveryAddressInfo} />
        ),
      },
    ],
    []
  );

  const renderPickupBuckets = () => {
    return (
      <Container>
        {pickupBuckets.map((bucket, i) => (
          <div key={i}>
            <RMoment
              format={`MMMM D, h:mm A [${timeZoneAbbr}]`}
              date={bucket.startTime}
            />{" "}
            : {bucket.number} deliveries
          </div>
        ))}
      </Container>
    );
  };

  const {
    getTableProps,
    getTableBodyProps,
    headerGroups,
    rows,
    prepareRow,
  } = useTable({
    autoResetSelectedRows: false,
    columns,
    data,
  });

  const dispatchOrders = (fulfillerType) => {
    var recipients = [];
    var supplierMap = {};

    var diffInMinutes =
      moment().tz(localTimeZone).utcOffset() -
      moment().tz(timeZone).utcOffset();
    var convertedDate = moment(selectedDate).add(diffInMinutes, "m").toDate();
    let convertedEndTime = null;
    if (endTime) {
      convertedEndTime = moment(endTime).add(diffInMinutes, "m").toDate();
    }

    let supplier = null;
    for (let supplierId in props.recipientsMap) {
      var recipientsForSupplier = props.recipientsMap[supplierId];
      recipientsForSupplier.forEach((recipientData) => {
        recipients.push(recipientData.id);
        supplierMap[recipientData.id] = supplierId;
      });
      // we only allow one. TODO clean this up since the flow is simplified now
      supplier = supplierId;
    }

    let requestData = {
      orgId: props.currentOrg,
      recipientIds: recipients,
      fulfiller: fulfillerType,
      supplierMap: supplierMap,
      selectedDate: convertedDate.getTime(),
      endTime: convertedEndTime?.getTime(),
      pickupsPer,
      supplierId: supplier,
    };

    setLoading(true);
    // Create requests in our database
    createRequestsForOrganization(requestData)
      .then(() => {
        console.log("Created requests.");
      })
      .catch((err) => {
        console.log("Error");
      })
      .finally(() => {
        setLoading(false);
        props.switchToTrips();
      });
  };

  const handleDatePickerChange = (date) => {
    if (date && date.getTime() !== selectedDate.getTime()) {
      setSelectedDate(date);
    }
  };

  const handlePickupChange = (e, { name, value }) => {
    setPickupsPer(parseInt(value, 10) || 0);
  };

  const handleTimeZoneDropdown = (newTimeZone) => {
    var diffInMinutes =
      moment().tz(newTimeZone).utcOffset() - moment().tz(timeZone).utcOffset();

    var newDate = moment(selectedDate).add(diffInMinutes, "m").toDate();

    setTimeZone(newTimeZone);
    setTimeZoneAbrr(getTimezoneAbbreviation(newTimeZone));

    setSelectedDate(newDate);
  };

  return (
    <>
      <Grid columns={2}>
        <Grid.Row>
          <Grid.Column textAlign="left">
            {!props.disableBack && (
              <UIButton
                secondary
                onClick={props.previousPageHandler}
                text={"back"}
              />
            )}
          </Grid.Column>
          <Grid.Column>Ready to schedule?</Grid.Column>
        </Grid.Row>
      </Grid>
      <UIReactTable
        getTableProps={getTableProps}
        getTableBodyProps={getTableBodyProps}
        headerGroups={headerGroups}
        rows={rows}
        prepareRow={prepareRow}
      />
      <Container textAlign="center">
        <Grid columns={2} verticalAlign="middle" doubling>
          <GridRow verticalAlign="middle">
            <Grid.Column>
              <h5>Start Time:</h5>
            </Grid.Column>
            <Grid.Column textAlign="left">
              <DatePicker
                label={"Start Time"}
                selected={selectedDate}
                onChange={(date) => handleDatePickerChange(date)}
                showTimeSelect
                dateFormat={`MMMM d, h:mm aa '${timeZoneAbbr}'`}
                timeIntervals={15}
                minDate={new Date()}
                maxDate={moment(new Date()).add(7, "days").valueOf()}
                timeFormat={`h:mm aa '${timeZoneAbbr}'`}
              />
              {TimeZoneOptions && TimeZoneOptions.length > 0 && (
                <Dropdown
                  style={{ marginLeft: "5px" }}
                  compact
                  selection
                  options={TimeZoneOptions}
                  defaultValue={TimeZoneOptions[0].value}
                  onChange={(e, d) => handleTimeZoneDropdown(d.value)}
                />
              )}
            </Grid.Column>
          </GridRow>
          <GridRow verticalAlign="middle">
            <Grid.Column>
              <h5>(Optional) End Time:</h5>
            </Grid.Column>
            <Grid.Column textAlign="left">
              <DatePicker
                label={"End Time"}
                selected={endTime}
                onChange={setEndTime}
                showTimeSelect
                dateFormat={`MMMM d, h:mm aa '${timeZoneAbbr}'`}
                timeIntervals={15}
                minDate={selectedDate}
                maxDate={moment(new Date()).add(7, "days").valueOf()}
                timeFormat={`h:mm aa '${timeZoneAbbr}'`}
              />
            </Grid.Column>
          </GridRow>
          <GridRow verticalAlign="middle">
            <Grid.Column>
              <h5>
                Deliveries per {schedulingInterval} minutes: {pickupsPer}
              </h5>
            </Grid.Column>
            <Grid.Column textAlign="left">
              <Form.Input
                min={minBatchSize}
                max={maxBatchSize}
                name="pickups"
                onChange={handlePickupChange}
                step={1}
                type="range"
                value={pickupsPer}
              />
            </Grid.Column>
          </GridRow>
          <GridRow>
            <Grid.Column>{renderPickupBuckets()}</Grid.Column>
          </GridRow>
        </Grid>
        <UIButton
          center
          primary
          onClick={() => dispatchOrders(courier)}
          text={`Schedule Trips`}
          loading={loading}
        />
      </Container>
    </>
  );
}
