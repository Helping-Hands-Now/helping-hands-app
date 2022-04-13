import React from "react";
import { Label, Button } from "semantic-ui-react";
import "semantic-ui-css/semantic.min.css";
import styled from "styled-components";
import { primaryColorDefault } from "../styles.js";

const StyledTab = styled(Button)({
  height: "100%",
  backgroundColor: "#FFFFFF!important",
  fontFamily: "AvenirBold",
});

const Text = styled.h1`
  font-size: 18px;
  font-family: AvenirBold;
  margin-bottom: 5px;
  color: ${(props) =>
    props.currentIndex === props.index ? "#000000" : "#575E7A"};
`;

const Div = styled.div`
  border-bottom: 4px solid
    ${(props) =>
      props.currentIndex === props.index ? primaryColorDefault : "#FFFFFF"};
`;

export default function UITab(props) {
  return (
    <Div currentIndex={props.currentIndex} index={props.index}>
      <StyledTab onClick={props.onClick}>
        <div>
          <Text currentIndex={props.currentIndex} index={props.index}>
            {props.title} {props.showLabel && <Label>{props.label}</Label>}
          </Text>
        </div>
      </StyledTab>
    </Div>
  );
}
