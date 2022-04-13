import React from "react";
import "semantic-ui-css/semantic.min.css";
import { Container } from "semantic-ui-react";
import {
  EmailShareButton,
  EmailIcon,
  FacebookShareButton,
  FacebookIcon,
  TwitterShareButton,
  TwitterIcon,
} from "react-share";
import "./styles.css";

import { useTranslation } from "react-i18next";

export default function Share(props) {
  const { t } = useTranslation();

  return (
    <div>
      {props.helper && (
        <Container>
          <FacebookShareButton
            url={"https://www.helpinghands.community"}
            quote={t("shareFacebookHelper")}
            className="shareHHIcon">
            <FacebookIcon size={32} round />
          </FacebookShareButton>
          <TwitterShareButton
            url={"https://bit.ly/2UEREjy"}
            title={t("shareTwitterHelper")}
            className="shareHHIcon">
            <TwitterIcon size={32} round />
          </TwitterShareButton>
          <EmailShareButton
            url={"https://www.helpinghands.community"}
            subject={"helpinghands.community"}
            body={t("shareFacebookHelper")}
            className="shareHHIcon">
            <EmailIcon size={32} round />
          </EmailShareButton>
        </Container>
      )}
      {props.requester && (
        <Container>
          <FacebookShareButton
            url={"https://www.helpinghands.community"}
            quote={t("shareFacebookRequester")}
            className="shareHHIcon">
            <FacebookIcon size={32} round />
          </FacebookShareButton>
          <TwitterShareButton
            url={"https://bit.ly/2UEREjy"}
            title={t("shareTwitterRequester")}
            className="shareHHIcon">
            <TwitterIcon size={32} round />
          </TwitterShareButton>
          <EmailShareButton
            url={"https://www.helpinghands.community"}
            subject={"Check out helpinghands.community!"}
            body={t("shareFacebookRequester")}
            className="shareHHIcon">
            <EmailIcon size={32} round />
          </EmailShareButton>
        </Container>
      )}
    </div>
  );
}
