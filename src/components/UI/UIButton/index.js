import React from "react";
import { Button, Icon } from "semantic-ui-react";
import "semantic-ui-css/semantic.min.css";
import styled from "styled-components";
import {
  primaryColorDefault,
  primaryColorHover,
  primaryColorActive,
  secondaryColorDefault,
  secondaryColorHover,
  secondaryColorActive,
  secondaryColorActiveText,
  secondaryLoginColorHover,
  destructiveColorDefault,
  destructiveColorHover,
  destructiveColorActive,
  disabledColorDefault,
  disabledColorDefaultText,
  secondaryActionCard,
  secondaryActionCardHover,
  secondaryActionCardActive,
} from "../styles.js";

const StyledButton = styled(Button)({
  borderRadius: "100px!important",
  paddingTop: "16px!important",
  paddingBottom: "13px!important",
  paddingLeft: "24px!important",
  paddingRight: "24px!important",
  fontWeight: "bold!important",
  fontSize: "18px!important",
  lineHeight: "24px!important",
  textAlign: "center!important",
  color: "#FFFFFF!important",
  fontFamily: "AvenirBold!important",
});

const StyledButtonSmall = styled(Button)((props) => ({
  borderRadius: "75px!important",
  paddingTop: "12px!important",
  paddingBottom: "9px!important",
  paddingLeft: "16px!important",
  paddingRight: "16px!important",
  fontWeight: "bold!important",
  fontSize: "16px!important",
  lineHeight: "16px!important",
  textAlign: "center!important",
  color: "#FFFFFF!important",
  fontFamily: "AvenirBold!important",
  backgroundColor: `${props.color ? props.color : "#FFFFFF"}!important`,
  border: "3px solid!important",
  borderColor: secondaryColorDefault,
  color: secondaryColorDefault,
  "&:hover": { borderColor: secondaryColorHover, color: secondaryColorHover },
  "&:active": {
    backgroundColor: secondaryColorActive,
    color: secondaryColorActiveText,
  },
}));

const StyledButtonSmallDisabled = styled(Button)((props) => ({
  borderRadius: "75px!important",
  paddingTop: "12px!important",
  paddingBottom: "9px!important",
  paddingLeft: "16px!important",
  paddingRight: "16px!important",
  fontWeight: "bold!important",
  fontSize: "16px!important",
  lineHeight: "16px!important",
  textAlign: "center!important",
  fontFamily: "AvenirBold!important",
  backgroundColor: disabledColorDefault,
  color: disabledColorDefaultText,
}));

const Primary = styled(StyledButton)({
  backgroundColor: primaryColorDefault,
  "&:hover": { backgroundColor: primaryColorHover },
  "&:active": { backgroundColor: primaryColorActive },
});

const PrimaryPurple = styled(StyledButton)({
  backgroundColor: secondaryActionCard,
  "&:hover": { backgroundColor: secondaryActionCardHover },
  "&:active": { backgroundColor: secondaryActionCardActive },
});

const Secondary = styled(StyledButton)({
  backgroundColor: "#FFFFFF!important",
  border: "3px solid!important",
  borderColor: secondaryColorDefault,
  color: secondaryColorDefault,
  "&:hover": { borderColor: secondaryColorHover, color: secondaryColorHover },
  "&:active": {
    backgroundColor: secondaryColorActive,
    color: secondaryColorActiveText,
  },
});

const SecondaryLogin = styled(StyledButton)({
  backgroundColor: "#FFFFFF!important",
  border: "none",
  color: "#000000!important",
  "&:hover": {
    color: secondaryLoginColorHover,
  },
});

const Destructive = styled(StyledButton)({
  backgroundColor: destructiveColorDefault,
  "&:hover": { backgroundColor: destructiveColorHover },
  "&:active": { backgroundColor: destructiveColorActive },
});

const Disabled = styled(StyledButton)({
  backgroundColor: disabledColorDefault,
  color: disabledColorDefaultText,
});

const StyledButtonLarge = styled(Button)((props) => ({
  borderRadius: "100px!important",
  paddingTop: "18px!important",
  paddingBottom: "15px!important",
  paddingLeft: "32px!important",
  paddingRight: "32px!important",
  fontWeight: "bold!important",
  fontSize: "32px!important",
  lineHeight: "36px!important",
  textAlign: "center!important",
  fontFamily: "AvenirBold!important",
  border: "3px solid!important",
  color: "#FFFFFF!important",
  backgroundColor: `${props.primary ? "#42B6E9" : "#9377B6"}!important`,
  borderColor: `#FFFFFF!important`,
  "&:hover": { borderColor: secondaryColorHover, color: secondaryColorHover },
  "&:active": {
    backgroundColor: secondaryColorActive,
    color: secondaryColorActiveText,
  },
}));

export default function UIButton(props) {
  return (
    <div>
      {props.loading || props.disabled ? (
        props.small ? (
          <div>
            {
              <StyledButtonSmallDisabled loading={props.loading}>
                {props.text}
              </StyledButtonSmallDisabled>
            }
          </div>
        ) : (
          <div>{<Disabled loading={props.loading}>{props.text}</Disabled>}</div>
        )
      ) : (
        <div>
          {props.primary && !props.large && (
            <Primary className={props.className} onClick={props.onClick}>
              {props.text}
            </Primary>
          )}
          {props.primaryPurple && !props.large && (
            <PrimaryPurple className={props.className} onClick={props.onClick}>
              {props.text}
            </PrimaryPurple>
          )}
          {props.secondary && !props.large && !props.login && (
            <Secondary className={props.className} onClick={props.onClick}>
              {props.text}
            </Secondary>
          )}
          {props.secondary && !props.large && props.login && (
            <SecondaryLogin className={props.className} onClick={props.onClick}>
              {props.text}
            </SecondaryLogin>
          )}
          {props.destructive && !props.large && (
            <Destructive className={props.className} onClick={props.onClick}>
              {props.text}
            </Destructive>
          )}
          {props.large && (
            <StyledButtonLarge
              className={props.className}
              onClick={props.onClick}
              primary={props.primary}
              secondary={props.secondary}>
              {props.text}
              <Icon
                name="long arrow alternate right"
                style={{ marginLeft: "-5px" }}
              />
            </StyledButtonLarge>
          )}
          {props.small && (
            <StyledButtonSmall
              color={props.color}
              className={props.className}
              data-lng={props.dataLng}
              onClick={(e) => props.onClick(e)}>
              {props.text}
            </StyledButtonSmall>
          )}
        </div>
      )}
    </div>
  );
}
