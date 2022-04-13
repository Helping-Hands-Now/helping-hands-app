import React, { useState, useEffect } from "react";
import { Grid, Modal } from "semantic-ui-react";
import "semantic-ui-css/semantic.min.css";
import useGlobalState from "../../hooks/useGlobalState";
import { useTranslation } from "react-i18next";
import "./styles.css";

import UIButton from "../UI/UIButton";

/* 
  Example usage of component

<SuccessModal
  open={showSuccessModal}
  onClose={() => {
    setShowSuccessModal(false);
  }}
  title={t("cancelRequest")}
  textArray={[
    t("confirmCancelOrderPrompt1"),
    t("confirmCancelOrderPrompt2"),
  ]}
  primaryButtonText={t("confirmCancelHelpAction")}
  primaryOnClick={() => {}}
  secondaryButtonText={t("stopCancelOrderPrompt")}
  secondaryOnClick={() => {}}
/>
*/

export default function SuccessModal(props) {
  const [showCloseIcon, setShowCloseIcon] = useState(false);

  useEffect(() => {
    setShowCloseIcon(!props.onClose || props.onClose !== null);
  }, [props.onClose]);

  return (
    <Modal
      size="mini"
      className="modal"
      open={props.open}
      closeIcon={showCloseIcon}
      onClose={props.onClose}>
      <Modal.Header>
        <p className="successModalTitle">{props.title}</p>
      </Modal.Header>
      <Modal.Content className="modalContent" image>
        {props.textArray &&
          props.textArray.map((text, index) => (
            <p key={index} className="successText">
              {text}
            </p>
          ))}
        {props.textSection && props.textSection}
      </Modal.Content>
      <div className="successModalActions">
        <Grid className="buttonGrid">
          {props.secondaryButtonText != null &&
            props.secondaryOnClick != null && (
              <UIButton
                secondary
                className="modalButton"
                text={props.secondaryButtonText}
                onClick={props.secondaryOnClick}
              />
            )}
          {props.primaryButtonText != null && props.primaryOnClick != null && (
            <UIButton
              primary
              loading={props.primaryLoading}
              className="modalButton"
              text={props.primaryButtonText}
              onClick={props.primaryOnClick}
            />
          )}
        </Grid>
      </div>
    </Modal>
  );
}
