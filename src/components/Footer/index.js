import React from "react";
import { Button, Container, Icon } from "semantic-ui-react";
import "semantic-ui-css/semantic.min.css";
import { useTranslation } from "react-i18next";
import "./styles.css";

import HHC_HELP_CENTER_LINK from "../../utils/constants";

export default function Footer() {
  const { t } = useTranslation();

  return (
    <div className="footerWrapper">
      <Container>
        <div className="footerTop">
          <a href="/contact" className="footerLink">
            {t("contactUs")}
          </a>
          <br />
          <a href={HHC_HELP_CENTER_LINK} className="footerLink">
            {t("faq")}
          </a>
          <br />
          <a href="/community" className="footerLink">
            {t("communityGuidelines")}
          </a>
          <br />
          <a href="/privacy" className="footerLink">
            {t("privacyPolicyHeader")}
          </a>
          <br />
          <a
            href="https://medium.com/@helpinghandscommunity"
            target="_blank"
            rel="noopener noreferrer"
            className="footerLink">
            {t("blog")}
          </a>
          <br />
          <a
            href="https://grnh.se/e7b442cc3us"
            target="_blank"
            rel="noopener noreferrer"
            className="footerLink">
            {t("jobs")}
          </a>
          <br />
          <a href="/terms" target="_blank" className="footerLink">
            {t("termsOfService")}
          </a>
        </div>
        <div className="footerDivider"></div>
        <div className="footerBottom">
          <p className="footerText">
            <Button
              href="https://www.facebook.com/findhelpinghandscommunity"
              target="_blank"
              icon
              className="socialMediaButton">
              <Icon name="facebook f" className="socialButtonIcon" />
            </Button>
            <Button
              href="https://www.instagram.com/helpinghands_community/"
              target="_blank"
              icon
              className="socialMediaButton">
              <Icon name="instagram" className="socialButtonIcon" />
            </Button>
            <Button
              href="https://twitter.com/hh_community"
              target="_blank"
              icon
              className="socialMediaButton">
              <Icon name="twitter" className="socialButtonIcon" />
            </Button>
            <Button
              href="https://www.youtube.com/channel/UCwzPc3Jhz93nKT3r-BeFDBQ"
              target="_blank"
              icon
              className="socialMediaButton">
              <Icon name="youtube" className="socialButtonIcon" />
            </Button>
          </p>
        </div>
      </Container>
    </div>
  );
}
