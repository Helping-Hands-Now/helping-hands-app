import React from "react";
import "semantic-ui-css/semantic.min.css";
import { Button, Container, Icon } from "semantic-ui-react";

import { useTranslation } from "react-i18next";
import "./styles.css";

export default function About(props) {
  const { t } = useTranslation();

  return (
    <div className="contentContainer">
      <Container>
        <h1 className="headPage">{t("contactUs")}</h1>

        <p className="contentDesc" href="">
          {t("contactUs1")}
        </p>

        <div className="contactContainer">
          <p>
            <a
              className="contentLink"
              href="mailto:info@helpinghands.community">
              info@helpinghands.community
            </a>
          </p>
          <p className="contentDesc" href="">
            {t("contactUs2")}
          </p>
        </div>

        <div className="contactContainer">
          <p>
            <a
              className="contentLink"
              href="mailto:partners@helpinghands.community">
              partners@helpinghands.community
            </a>
          </p>
          <p className="contentDesc" href="">
            {t("contactUs4")}
          </p>
          <p className="contentDesc" href="">
            {t("contactUs5")}
          </p>
        </div>

        <div className="contactContainer">
          <p>
            <a
              className="contentLink"
              href="mailto:volunteer@helpinghands.community">
              volunteer@helpinghands.community
            </a>
          </p>
          <p className="contentDesc" href="">
            {t("contactUs3")}
          </p>
        </div>

        <div className="contactContainer">
          <p>
            <a
              className="contentLink"
              href="mailto:joinus@helpinghands.community">
              joinus@helpinghands.community
            </a>
          </p>
          <p className="contentDesc" href="">
            {t("contactUs7")}
          </p>
        </div>

        <div className="contactContainer">
          <p>
            <a
              className="contentLink"
              href="mailto:press@helpinghands.community">
              press@helpinghands.community
            </a>
          </p>
          <p className="contentDesc" href="">
            {t("contactUs8")}
          </p>
        </div>

        <div className="contactContainer">
          <p>
            <a
              className="contentLink"
              href="mailto:feedback@helpinghands.community">
              feedback@helpinghands.community
            </a>
          </p>
          <p className="contentDesc" href="">
            {t("contactUs9")}
          </p>
        </div>

        <p className="contactButtonsIcons">
          <Button
            className="contactButtonsIcons"
            href="https://www.facebook.com/findhelpinghandscommunity"
            icon>
            <Icon className="contactButtonsIcons" name="facebook" />
          </Button>
          <Button
            className="contactButtonsIcons"
            href="https://www.instagram.com/helpinghands_community/"
            icon>
            <Icon className="contactButtonsIcons" name="instagram" />
          </Button>
          <Button
            className="contactButtonsIcons"
            href="https://twitter.com/hh_community"
            icon>
            <Icon className="contactButtonsIcons" name="twitter" />
          </Button>
          <Button
            className="contactButtonsIcons"
            href="https://www.youtube.com/channel/UCwzPc3Jhz93nKT3r-BeFDBQ"
            icon>
            <Icon className="contactButtonsIcons" name="youtube" />
          </Button>
        </p>
      </Container>
    </div>
  );
}
