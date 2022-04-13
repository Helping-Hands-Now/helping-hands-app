import React from "react";
import { Modal, Message, Dimmer, Loader } from "semantic-ui-react";
import "semantic-ui-css/semantic.min.css";
import StyledFirebaseAuth from "react-firebaseui/StyledFirebaseAuth";
import firebase, { newUiConfig, oldUiConfig } from "../../firebase.js";
import { useTranslation } from "react-i18next";
import { useHistory } from "react-router-dom";
import UIButton from "../UI/UIButton";
import "./styles.css";

export default function Auth(props) {
  const history = useHistory();

  newUiConfig.callbacks = {
    signInSuccessWithAuthResult: (authResult) => {
      props.callback(authResult);
    },
  };

  oldUiConfig.callbacks = {
    signInSuccessWithAuthResult: (authResult) => {
      props.callback(authResult);
    },
  };

  const { t } = useTranslation();

  const navigate = (path) => {
    props.turnOffModal();
    history.push(path);
  };

  return (
    <Modal
      size="mini"
      className="modal"
      closeIcon={!props.showLoggingInState}
      open={true}
      onClose={props.turnOffModal}>
      <Modal.Header>
        <p className="authTitle">
          {props.signup ? t("authSignup") : t("authLogin")}
        </p>
      </Modal.Header>
      {props.showLoggingInState ? (
        <Modal.Content>
          <Dimmer active>
            <Loader active inverted>
              {t("loading")}
            </Loader>
          </Dimmer>
        </Modal.Content>
      ) : (
        <Modal.Content image>
          <p className="authText">
            {props.signup ? t("authSignupPhrase") : t("authLoginPhrase")}
          </p>
        </Modal.Content>
      )}
      <StyledFirebaseAuth
        uiConfig={props.signup ? newUiConfig : oldUiConfig}
        firebaseAuth={firebase.auth()}
      />
      {props.needsSignUp && (
        <div style={{ padding: "10px" }}>
          <Message
            error
            header={t("authSignupFirst")}
            content={t("authClickBelow")}
          />
          <UIButton
            onClick={() => navigate("/volunteer")}
            text={t("tabCanHelp")}
            secondary
          />
        </div>
      )}
    </Modal>
  );
}
