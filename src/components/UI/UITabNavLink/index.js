import React from "react";
import { Button } from "semantic-ui-react";
import "semantic-ui-css/semantic.min.css";
import styled from "styled-components";
import { NavLink } from "react-router-dom";

const StyledTab = styled(Button)({
  height: "100%",
  backgroundColor: "#FFFFFF!important",
  fontFamily: "AvenirBold",
});

const Text = styled.h1`
  font-size: 18px;
  font-family: AvenirBold;
  margin-bottom: 5px;
  color: #575e7a;
`;

const Div = styled.div`
  border-bottom: 4px solid;
  border-bottom-color: #ffffff;
`;

export function UITabNavLink(props) {
  return (
    <NavLink to={props.to} activeClassName="activeStyledNavLink">
      <Div>
        <StyledTab onClick={props.onClick}>
          <Text>{props.title}</Text>
        </StyledTab>
      </Div>
    </NavLink>
  );
}
