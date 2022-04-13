import { Dropdown } from "semantic-ui-react";
import React from "react";
import getLangMap from "./../../lang";
import { useTranslation } from "react-i18next";
import styled from "styled-components";

const StyledDropdown = styled(Dropdown)({
  borderRadius: "4px!important",
  border: "2px solid #A3A8BF!important",
  fontFamily: "AvenirRegular",
  "&:hover": {
    borderColor: "#575E7A!important",
  },
});

export default function LanguageDropDown(props) {
  const [t] = useTranslation();

  let languageOptions = [];
  const defaultValue = props.languages;
  const langMap = getLangMap(t);
  for (const key in langMap) {
    if (key !== "zh") {
      const value = langMap[key];
      languageOptions.push({
        key: key,
        value: key,
        text: value,
      });
    }
  }
  return (
    <div>
      <StyledDropdown
        label={t("selectLanguages")}
        button
        value={defaultValue}
        options={languageOptions}
        search
        multiple
        selection
        placeholder={t("selectLanguagesShort")}
        onChange={(e, d) => props.setLanguages(d.value)}
      />
    </div>
  );
}
