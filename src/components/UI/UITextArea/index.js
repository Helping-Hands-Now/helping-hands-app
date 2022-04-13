import React from "react";
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

const TextArea = styled.textarea`
  width: 100%;
  border: 2px solid ${(props) => (props.error ? inputError : unfocusedInput)};
  border-radius: 4px;
  padding-top: 10px;
  padding-bottom: 7px;
  padding-left: 16px;
  padding-right: 16px;
  color: ${inputTextColor};
  font-size: 18px;
  font-family: AvenirRegular;
  font-weight: 600;
  outline: none;
  ::placeholder {
    color: ${unfocusedInput};
  }
  :focus {
    border: 2px solid ${(props) => (props.error ? inputError : focusedInput)};
  }
  :hover {
    border: 2px solid ${(props) => (props.error ? inputError : inputHover)};
  }
  :focus:hover {
    border: 2px solid ${(props) => (props.error ? inputError : focusedInput)};
  }
`;

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
      <br />
      <Div error={props.error}>
        <UIText error={props.error}>{props.label}</UIText>
        <TextArea
          fluid
          placeholder={props.placeholder}
          onChange={props.hook.bind(this)}
          value={props.value}
          error={props.error}
          disabled={props.disabled}
          onBlur={props.onBlur}
        />
        <Error error={props.error}>{props.error}</Error>
      </Div>
    </div>
  );
}
