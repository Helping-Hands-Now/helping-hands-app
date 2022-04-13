// using OrgDropdown component as pattern for this component
// this currently only shows events for a specific org, but could be expanded in the future to display additional results

/*eslint no-unused-vars: ["error", { "argsIgnorePattern": "^_", "varsIgnorePattern": "^_"  }]*/
import React, { useState, useEffect } from "react";
import moment from "moment";
import { useTranslation } from "react-i18next";
import { getCommunityDeliveryEventDetailsForOrg } from "../../firebase";
import UIDropdown from "../UI/UIDropdown";
import { Loader, Label, Grid, Button, Icon, Form } from "semantic-ui-react";

function EventDropDownRow({ rightElement, ...rest }) {
  return (
    <Form>
      <Grid>
        <Grid.Column width={!!rightElement ? 14 : 16}>
          <UIDropdown {...rest} />
        </Grid.Column>
        {!!rightElement && (
          <Grid.Column width={2} verticalAlign="middle">
            {rightElement}
          </Grid.Column>
        )}
      </Grid>
    </Form>
  );
}

export default function EventDropdown({
  currentOrgId,
  setCurrentEventId,
  currentEventId,
}) {
  const { t } = useTranslation();
  const [events, setEvents] = useState([]);
  const [eventsLoaded, setEventsLoaded] = useState(false);
  const [eventsLoadError, setEventsLoadError] = useState(false);
  const [lastRefreshRequestTime, setLastRefreshRequestTime] = useState(
    new Date()
  );

  useEffect(() => {
    getCommunityDeliveryEventDetailsForOrg({
      orgId: currentOrgId,
    }).then(
      (r) => {
        // only display future events
        var events = [];
        r.data.forEach((event) => {
          if (event.eventTime._seconds * 1000 > new Date().getTime()) {
            events.push(event);
          }
        });
        // sort objects in events array by event time, so the dropdown list is ordered by date
        events.sort(function (a, b) {
          return a.eventTime._seconds - b.eventTime._seconds;
        });

        setEvents(events);
        setEventsLoaded(true);
        setEventsLoadError(false);
        if (
          currentEventId &&
          !events.map((event) => event.id).includes(currentEventId)
        ) {
          setCurrentEventId(null);
        }
        if (events.length === 1) {
          setCurrentEventId(events[0].id);
        }
      },
      (_error) => {
        setEventsLoadError(true);
      }
    );
  }, [lastRefreshRequestTime]);
  let options = events.map((event) => {
    return {
      key: event.id,
      value: event.id,
      text:
        moment(event.eventTime._seconds * 1000).format("ddd l, h:mm a") +
        ": " +
        event.eventName +
        " @ " +
        event.supplier.name,
    };
  });
  if (eventsLoadError) {
    let refreshButton = (
      <Button icon onClick={() => setLastRefreshRequestTime(new Date())}>
        <Icon name="refresh" />
      </Button>
    );
    return (
      <EventDropDownRow
        label={t("Select an event")}
        hook={(e, d) => setCurrentEventId(d.value)}
        error
        disabled
        placeholder={t("Event loading failed.")}
        rightElement={refreshButton}
      />
    );
  } else if (!eventsLoaded) {
    return (
      <EventDropDownRow
        label={t("Select an event")}
        disabled
        placeholder={t("Loading...")}
        rightElement={<Loader active inline size="small" />}
      />
    );
  } else if (!events.length) {
    return (
      <EventDropDownRow
        error
        placeholder={t("You don't have any upcoming events.")}
        disabled
        rightElement={<Icon name="warning circle" color="red" />}
      />
    );
  } else if (!currentEventId) {
    return (
      <EventDropDownRow
        label={t("Select an event")}
        hook={(e, d) => setCurrentEventId(d.value)}
        selection
        options={options}
        value={currentEventId}
        placeholder={t("Please select an event.")}
        rightElement={
          <Label basic color="red" pointing="left">
            {t("Please select")}
          </Label>
        }
      />
    );
  } else {
    return (
      <EventDropDownRow
        label={t("Select an event")}
        hook={(e, d) => setCurrentEventId(d.value)}
        selection
        options={options}
        defaultValue={currentEventId}
        value={currentEventId}
        placeholder={t("Please select an event.")}
      />
    );
  }
}
