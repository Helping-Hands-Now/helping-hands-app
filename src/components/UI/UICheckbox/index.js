import React from "react";
import { Button } from "semantic-ui-react";
import "semantic-ui-css/semantic.min.css";
import styled from "styled-components";
import { inputError, unfocusedInput, inputHover } from "../styles.js";

const StyledCheckbox = styled(Button)((props) => ({
  minWidth: "25px!important",
  width: "25px!important",
  height: "25px!important",
  paddingTop: "0px!important",
  paddingBottom: "0px!important",
  paddingLeft: "0px!important",
  paddingRight: "0px!important",
  backgroundColor: `${props.checked ? "#42B6E9" : "#FFFFFF"}!important`,
  border: `2px solid ${unfocusedInput}!important`,
  display: "inline-block!important",
  "&:hover": {
    border: `2px solid ${inputHover}!important`,
  },
}));

const Text = styled.h1`
  font-size: 18px;
  font-family: AvenirRegular;
  color: #0000000;
  display: inline-block;
  margin-left: 10px;
`;

const Error = styled.h1`
  font-size: 10px;
  font-family: AvenirRegular;
  margin-top: 5px;
  color: ${(props) => (props.error ? inputError : null)};
`;

export default function UICheckbox(props) {
  return (
    <div>
      <div style={props.style || { display: "flex", alignItems: "center" }}>
        <StyledCheckbox onClick={props.onChange} checked={props.checked} />
        <Text onClick={props.onChange} style={props.textStyle}>
          {props.label}
        </Text>
      </div>
      <Error error={props.error}>{props.error}</Error>
    </div>
  );
}
