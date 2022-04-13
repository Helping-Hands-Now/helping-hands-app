import moment from "moment";

export function FilterItemByScheduledPickupTime(filteredDate) {
  return {
    testValue: filteredDate,
    constantFn: () => moment(filteredDate),
    filter: (item, filterDate) => {
      if (!item.scheduledPickupTime) {
        return false;
      }
      let itemDate = moment(new Date(item.scheduledPickupTime));
      return (
        filterDate.isSame(itemDate, "month") &&
        filterDate.isSame(itemDate, "date") &&
        filterDate.isSame(itemDate, "year")
      );
    },
  };
}

export function FilterBy(list, filters) {
  let validFilters = [];
  for (const filter of filters) {
    if (filter.testValue) {
      validFilters.push({
        init: filter.constantFn && filter.constantFn(),
        callback: filter.filter,
      });
    }
  }
  if (validFilters.length) {
    list = list.filter((item) => {
      return validFilters.every((filterInfo) => {
        return filterInfo.callback(item, filterInfo.init);
      });
    });
  }
  return list;
}
