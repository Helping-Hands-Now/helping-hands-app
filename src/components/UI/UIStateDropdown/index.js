import React from "react";
import UIDropdown from "../UIDropdown";
import { useTranslation } from "react-i18next";
import { REGION_MAP } from "../../AdminRequestList/location-helper";

export default function ({
  label,
  placeholder,
  hook,
  stateError,
  handleBlur,
  state,
  region,
  handleFocus,
}) {
  const { t } = useTranslation();

  label = label || t("street");
  placeholder = placeholder || t("street");

  const us_state_options = [
    { key: "AL", value: "AL", text: "AL (Alabama)" },
    { key: "AK", value: "AK", text: "AK (Alaska)" },
    { key: "AS", value: "AS", text: "AS (American Samoa)" },
    { key: "AZ", value: "AZ", text: "AZ (Arizona)" },
    { key: "AR", value: "AR", text: "AR (Arkansas)" },
    { key: "CA", value: "CA", text: "CA (California)" },
    { key: "CO", value: "CO", text: "CO (Colorado)" },
    { key: "CT", value: "CT", text: "CT (Connecticut)" },
    { key: "DE", value: "DE", text: "DE (Delaware)" },
    { key: "DC", value: "DC", text: "DC (District Of Columbia)" },
    { key: "FM", value: "FM", text: "FM (Federated States Of Micronesia)" },
    { key: "FL", value: "FL", text: "FL (Florida)" },
    { key: "GA", value: "GA", text: "GA (Georgia)" },
    { key: "GU", value: "GU", text: "GU (Guam)" },
    { key: "HI", value: "HI", text: "HI (Hawaii)" },
    { key: "ID", value: "ID", text: "ID (Idaho)" },
    { key: "IL", value: "IL", text: "IL (Illinois)" },
    { key: "IN", value: "IN", text: "IN (Indiana)" },
    { key: "IA", value: "IA", text: "IA (Iowa)" },
    { key: "KS", value: "KS", text: "KS (Kansas)" },
    { key: "KY", value: "KY", text: "KY (Kentucky)" },
    { key: "LA", value: "LA", text: "LA (Louisiana)" },
    { key: "ME", value: "ME", text: "ME (Maine)" },
    { key: "MH", value: "MH", text: "MH (Marshall Islands)" },
    { key: "MD", value: "MD", text: "MD (Maryland)" },
    { key: "MA", value: "MA", text: "MA (Massachusetts)" },
    { key: "MI", value: "MI", text: "MI (Michigan)" },
    { key: "MN", value: "MN", text: "MN (Minnesota)" },
    { key: "MS", value: "MS", text: "MS (Mississippi)" },
    { key: "MO", value: "MO", text: "MO (Missouri)" },
    { key: "MT", value: "MT", text: "MT (Montana)" },
    { key: "NE", value: "NE", text: "NE (Nebraska)" },
    { key: "NV", value: "NV", text: "NV (Nevada)" },
    { key: "NH", value: "NH", text: "NH (New Hampshire)" },
    { key: "NJ", value: "NJ", text: "NJ (New Jersey)" },
    { key: "NM", value: "NM", text: "NM (New Mexico)" },
    { key: "NY", value: "NY", text: "NY (New York)" },
    { key: "NC", value: "NC", text: "NC (North Carolina)" },
    { key: "ND", value: "ND", text: "ND (North Dakota)" },
    { key: "MP", value: "MP", text: "MP (Northern Mariana Islands)" },
    { key: "OH", value: "OH", text: "OH (Ohio)" },
    { key: "OK", value: "OK", text: "OK (Oklahoma)" },
    { key: "OR", value: "OR", text: "OR (Oregon)" },
    { key: "PW", value: "PW", text: "PW (Palau)" },
    { key: "PA", value: "PA", text: "PA (Pennsylvania)" },
    { key: "PR", value: "PR", text: "PR (Puerto Rico)" },
    { key: "RI", value: "RI", text: "RI (Rhode Island)" },
    { key: "SC", value: "SC", text: "SC (South Carolina)" },
    { key: "SD", value: "SD", text: "SD (South Dakota)" },
    { key: "TN", value: "TN", text: "TN (Tennessee)" },
    { key: "TX", value: "TX", text: "TX (Texas)" },
    { key: "UT", value: "UT", text: "UT (Utah)" },
    { key: "VT", value: "VT", text: "VT (Vermont)" },
    { key: "VI", value: "VI", text: "VI (Virgin Islands)" },
    { key: "VA", value: "VA", text: "VA (Virginia)" },
    { key: "WA", value: "WA", text: "WA (Washington)" },
    { key: "WV", value: "WV", text: "WV (West Virginia)" },
    { key: "WI", value: "WI", text: "WI (Wisconsin)" },
    { key: "WY", value: "WY", text: "WY (Wyoming)" },
  ];
  let defaultValue;
  if (state) {
    us_state_options.forEach((option) => {
      if (option.value === state) {
        defaultValue = state;
      }
    });
  }

  const getStates = (region) => {
    if (region.slice(0, 2) === "CA") {
      return {
        "CA-North": [
          {
            key: "CA-North",
            value: "CA-North",
            text: "CA (Northern California)",
          },
        ],
        "CA-South": [
          {
            key: "CA-South",
            value: "CA-South",
            text: "CA (Southern California)",
          },
        ],
      }[region];
    }

    let us_state_options_map = us_state_options.reduce((map, state) => {
      map[state.key] = { key: state.key, value: state.value, text: state.text };
      return map;
    }, {});

    let region_state_options = [];
    let state_keys = REGION_MAP[region];
    for (let i in state_keys) {
      region_state_options.push(us_state_options_map[state_keys[i]]);
    }

    return region_state_options;
  };

  return (
    <UIDropdown
      label={label}
      placeholder={placeholder}
      hook={hook}
      search
      selection
      defaultValue={defaultValue}
      value={defaultValue}
      options={region ? getStates(region) : us_state_options}
      error={stateError}
      onFocus={handleFocus}
      onBlur={handleBlur}
    />
  );
}
