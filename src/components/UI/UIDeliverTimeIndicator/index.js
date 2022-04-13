import React from "react";
import "semantic-ui-css/semantic.min.css";
import styled from "styled-components";
import { useTranslation } from "react-i18next";
import {} from "../styles.js";

const Indicator = styled.div`
  padding-left: 10px;
  padding-right: 10px;
  padding-top: 10px;
  padding-bottom: 5px;
  border-radius: 4px;
  background-color: ${(props) => props.green && "#80C781"};
  background-color: ${(props) => props.yellow && "#FDE07B"};
  background-color: ${(props) => props.red && "#F26768"};
  text-align: center;
`;

const Text = styled.h1`
  font-size: 15px;
  font-family: AvenirRegular;
  color: ${(props) => (props.yellow ? "#000000" : "#FFFFFF")};
`;

export default function UIDeliverTimeIndicator(props) {
  const { t } = useTranslation();

  return (
    <Indicator
      green={props.pendingConfirmation || props.hoursTillExpired > 24}
      yellow={
        !props.pendingConfirmation &&
        24 >= props.hoursTillExpired &&
        props.hoursTillExpired > 2
      }
      red={!props.pendingConfirmation && props.hoursTillExpired <= 2}>
      {props.pendingConfirmation ? (
        <div>
          <Text>{t("pendingConfirmation")}</Text>
        </div>
      ) : props.hoursTillExpired <= 2 ? (
        <div>
          <Text
            yellow={12 >= props.hoursTillExpired && props.hoursTillExpired > 2}>
            {props.minutesTillExpired}
            {t("minToDeliver")}
          </Text>
        </div>
      ) : props.hoursTillExpired > 24 ? (
        <div>
          <Text>2 {t("daysToDeliver")}</Text>
        </div>
      ) : (
        <div>
          <Text
            yellow={24 >= props.hoursTillExpired && props.hoursTillExpired > 2}>
            {props.hoursTillExpired}
            {t("hoursToDeliver")}
          </Text>
        </div>
      )}
    </Indicator>
  );
}
