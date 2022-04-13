import React from "react";
import "semantic-ui-css/semantic.min.css";
import styled from "styled-components";
import { focusedInput, inputError, inputHover } from "../UI/styles.js";
import "./styles.css";
import UIText from "../UI/UIText";

import { CardElement } from "@stripe/react-stripe-js";

export const Error = styled.h1`
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

export default function StripeCardInput(props) {
  return (
    <div>
      <Div error={props.error}>
        <UIText error={props.error}>{props.label}</UIText>
        <CardElement
          className="stripeCardInput"
          options={{ hidePostalCode: true }}
        />
        <Error error={props.error}>{props.error}</Error>
      </Div>
    </div>
  );
}
