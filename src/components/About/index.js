import React from "react";
import "semantic-ui-css/semantic.min.css";
import styled from "styled-components";

import { useTranslation } from "react-i18next";

/*
 * Constants.
 */

const blogUrl = "https://medium.com/@helpinghandscommunity";
const jobUrl = "https://boards.greenhouse.io/helpinghands";
const partnerUrl = "mailto:partners@helpinghands.community";

/*
 * Styles.
 */

const StyledContainer = styled.div`
  max-width: 750px;
  margin-left: auto;
  margin-right: auto;
`;

const StyledPageHeader = styled.h1`
  font-family: "SourceSansProBold";
  font-size: 40px;
  line-height: 50px;
  text-align: center;
  color: #42b6e9;
  margin-bottom: 0px;
`;

const StyledSectionHeader = styled.h2`
  font-family: "SourceSansProBold";
  text-align: center;
  font-size: 30px;
  line-height: 38px;
  margin-top: 50px;
  margin-bottom: 20px;
`;

const StyledParagraph = styled.p`
  font-family: "LatoRegular";
  font-size: 18px;
  line-height: 27px;
  color: #434343;
`;

/*
 * Component.
 */

export default function About() {
  const { t } = useTranslation();

  return (
    <div className="contentContainer">
      <StyledContainer>
        <StyledPageHeader>{t("aboutUs")}</StyledPageHeader>

        <StyledSectionHeader>{t("whatIs")}</StyledSectionHeader>
        <StyledParagraph>{t("whatIsText")}</StyledParagraph>
        <StyledParagraph>{t("whatIsText2")}</StyledParagraph>
        <StyledParagraph>
          <a target="_blank" href={blogUrl} rel="noopener noreferrer">
            {t("whatIsLink")}
          </a>
        </StyledParagraph>

        <StyledSectionHeader>{t("mission")}</StyledSectionHeader>
        <StyledParagraph>{t("missionText")}</StyledParagraph>

        <StyledSectionHeader>{t("howWeHelp")}</StyledSectionHeader>
        <StyledParagraph>{t("howWeHelpText")}</StyledParagraph>
        <StyledParagraph>{t("howWeHelpText2")}</StyledParagraph>
        <StyledParagraph>
          <a target="_blank" href={partnerUrl} rel="noopener noreferrer">
            {t("howWeHelpLink")}
          </a>
        </StyledParagraph>

        <StyledSectionHeader>{t("joinOurTeam")}</StyledSectionHeader>
        <StyledParagraph>{t("joinOurTeamText")}</StyledParagraph>
        <StyledParagraph>{t("joinOurTeamText2")}</StyledParagraph>
        <StyledParagraph>
          <a target="_blank" href={jobUrl} rel="noopener noreferrer">
            {t("joinOurTeamLink")}
          </a>
        </StyledParagraph>
      </StyledContainer>
    </div>
  );
}
