import React from "react";
import { Modal } from "semantic-ui-react";
import "semantic-ui-css/semantic.min.css";
import "./styles.css";

import UIInput from "../UI/UIInput";
import UIButton from "../UI/UIButton";

export default function InputModal(props) {
  return (
    <Modal
      className="modal"
      size="mini"
      open={props.open}
      closeIcon
      onClose={props.onClose}>
      <Modal.Content>
        <p className="inputText">{props.text}</p>
      </Modal.Content>
      <div className="inputModalActions">
        <UIInput
          placeholder={props.placeholder}
          label={props.label}
          hook={props.hook}
          value={props.value}
          error={props.error}
        />
      </div>
      <div className="inputModalActions">
        <UIButton primary text={props.buttonText} onClick={props.onClick} />
      </div>
    </Modal>
  );
}
