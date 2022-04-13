import React from "react";
import "semantic-ui-css/semantic.min.css";
import { Container } from "semantic-ui-react";

import { useTranslation } from "react-i18next";

export default function HowItWorks(props) {
  const { t } = useTranslation();

  return (
    <div className="contentContainer">
      <Container>
        <h1 className="headPage">{t("howItWorks")}</h1>

        <h2 className="headDesc">{t("howToRequest")}</h2>
        <p className="contentDesc">{t("requesterInstr1")}</p>
        <p className="contentDesc">{t("requesterInstr2")}</p>
        <p className="contentDesc">{t("requesterInstr3")}</p>
        <ul>
          <li>
            <p className="contentDesc">{t("requesterInstr4")}</p>
          </li>
          <li>
            <p className="contentDesc">{t("requesterInstr5")}</p>
          </li>
          <li>
            <p className="contentDesc">{t("requesterInstr6")}</p>
          </li>
        </ul>

        <h2 className="headDesc">{t("howToHelp")}</h2>
        <p className="contentDesc">{t("helperInstr1")}</p>
        <p className="contentDesc">{t("helperInstr2")}</p>
        <p className="contentDesc">{t("helperInstr3")}</p>
        <ul>
          <li>
            <p className="contentDesc">{t("helperInstr4")}</p>
          </li>
          <li>
            <p className="contentDesc">{t("helperInstr5")}</p>
          </li>
          <li>
            <p className="contentDesc">{t("helperInstr6")}</p>
          </li>
        </ul>
        <p className="contentDesc">{t("helperInstr7")}</p>
        <p className="contentDesc">{t("helperInstr8")}</p>
      </Container>
    </div>
  );
}
