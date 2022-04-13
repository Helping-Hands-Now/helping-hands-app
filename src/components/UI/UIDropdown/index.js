import React from "react";
import { Dropdown } from "semantic-ui-react";
import "semantic-ui-css/semantic.min.css";
import styled from "styled-components";
import {
  focusedInput,
  unfocusedInput,
  inputTextColor,
  inputError,
  inputHover,
} from "../styles.js";
import UIText from "../UIText";

const Input = styled(Dropdown)({
  width: "100%!important",
  border: `2px solid ${(props) =>
    props.error ? inputError : unfocusedInput}!important`,
  borderRadius: "4px!important",
  paddingLeft: "16px!important",
  paddingRight: "16px!important",
  color: `${inputTextColor}!important`,
  fontSize: "15px!important",
  fontFamily: "AvenirBold!important",
  fontWeight: "600!important",
  outline: "none!important",
  "&::placeholder": {
    color: `${unfocusedInput}!important`,
  },
  "&:focus": {
    border: `2px solid ${(props) =>
      props.error ? inputError : focusedInput}!important`,
  },
  "&:hover": {
    border: `2px solid ${(props) =>
      props.error ? inputError : inputHover}!important`,
  },
  "&:focus:hover": {
    border: `2px solid ${(props) =>
      props.error ? inputError : focusedInput}!important`,
  },
});

const Error = styled.h1`
  font-size: 10px;
  font-family: AvenirRegular;
  margin-top: 5px;
  color: ${(props) => (props.error ? inputError : inputHover)};
`;

const Div = styled.div`
  :focus-within h1 {
    color: ${(props) => (props.error ? inputError : focusedInput)};
  }
`;

export default function UIInput(props) {
  return (
    <div>
      <Div>
        <UIText error={props.error}>{props.label}</UIText>
        <Input
          fluid
          placeholder={props.placeholder}
          onChange={props.hook?.bind(this)}
          value={props.value}
          options={props.options}
          onFocus={props.onFocus}
          onBlur={props.handleBlur}
          onSearchChange={props.onSearchChange}
          search={props.search}
          searchQuery={props.searchQuery}
          selection={props.selection}
        />
        <Error error={props.error}>{props.error}</Error>
      </Div>
    </div>
  );
}
