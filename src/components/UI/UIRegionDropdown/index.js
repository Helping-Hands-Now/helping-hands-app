import React from "react";
import UIDropdown from "../UIDropdown";
import { useTranslation } from "react-i18next";

export default function ({
  label,
  placeholder,
  hook,
  regionError,
  handleBlur,
  region,
  handleFocus,
  onChange,
  onSelectChange,
  onClick,
}) {
  const { t } = useTranslation();

  label = label || t("street");
  placeholder = placeholder || t("street");

  const us_region_options = [
    { key: "CA-North", value: "CA-North", text: "CA North" },
    { key: "CA-South", value: "CA-South", text: "CA South" },
    { key: "Pacific", value: "Pacific", text: "Pacific" },
    { key: "Mountain", value: "Mountain", text: "Mountain" },
    { key: "Midwest", value: "Midwest", text: "Midwest" },
    { key: "Texas", value: "Texas", text: "Texas" },
    { key: "Southeast", value: "Southeast", text: "Southeast" },
    { key: "Northeast", value: "Northeast", text: "Northeast" },
    { key: "Others", value: "Others", text: "Others" },
  ];
  let value;
  if (region) {
    us_region_options.forEach((option) => {
      if (option.value === region) {
        value = region;
      }
    });
  }

  return (
    <UIDropdown
      label={label}
      placeholder={placeholder}
      hook={hook}
      search
      selection
      defaultValue=""
      value={value || ""}
      options={us_region_options}
      error={regionError}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onChange={onChange}
      onSelectChange={onSelectChange}
      onClick={onClick}
    />
  );
}
