import React, { useState } from "react";
import { Button, Icon } from "semantic-ui-react";
import "./styles.css";

function RequestButton(props) {
  let [toggled, setToggle] = useState(props.initState);

  function clickHandler() {
    setToggle(!toggled);
    props.onClick();
  }
  return (
    <Button color={props.color} basic={!toggled} onClick={() => clickHandler()}>
      {toggled && <Icon name="check" />}
      {props.name}
    </Button>
  );
}

export default RequestButton;
