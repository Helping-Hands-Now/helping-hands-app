import React from "react";
import EnterpriseConsole from "./index";
import moment from "moment";
import { FilterBy, FilterItemByScheduledPickupTime } from "./filter";
import { shallow } from "enzyme";

// Prevents a jest-specific warning about i18next not being initialized
// Context: https://github.com/i18next/react-i18next/issues/876#issuecomment-571102963
jest.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key) => key }),
}));

it("filters the pickup time by the day as unix milisecond timestamp", () => {
  let trips = [
    { id: 0, scheduledPickupTime: moment("20200626", "YYYYMMDD").valueOf() },
    { id: 1, scheduledPickupTime: moment("20200627", "YYYYMMDD").valueOf() },
    { id: 2, scheduledPickupTime: moment("20200628", "YYYYMMDD").valueOf() },
    { id: 3, scheduledPickupTime: moment("20200629", "YYYYMMDD").valueOf() },
    { id: 4, scheduledPickupTime: undefined },
    { id: 5, scheduledPickupTime: moment("20200626", "YYYYMMDD").valueOf() },
    { id: 6, scheduledPickupTime: null },
    { id: 7, scheduledPickupTime: moment("20200627", "YYYYMMDD").valueOf() },
    { id: 8, scheduledPickupTime: moment("20200628", "YYYYMMDD").valueOf() },
    { id: 9, scheduledPickupTime: moment("20200629", "YYYYMMDD").valueOf() },
  ];
  let dateFilter = FilterItemByScheduledPickupTime(
    moment("20200628", "YYYYMMDD").toDate()
  );
  let filteredTripIds = FilterBy(trips, [dateFilter]).map((trip) => trip.id);
  expect(filteredTripIds).toEqual([2, 8]);
});
