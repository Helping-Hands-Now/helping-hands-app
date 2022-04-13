import React, { useState } from "react";
import { Modal, Button, Icon, Message } from "semantic-ui-react";
import "semantic-ui-css/semantic.min.css";
import { useTranslation } from "react-i18next";
import firebase from "../../firebase.js";
import "./styles.css";

import UIInput from "../UI/UIInput";
import UIButton from "../UI/UIButton";
import AuthBtn from "../AuthBtn";

export default function SwitchAuthModal(props) {
  const { t } = useTranslation();

  const [loading, setLoading] = useState("");

  const [signInEmail, setSignInEmail] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [generalError, setGeneralError] = useState("");

  const linkAuth = (provider) => {
    // [START auth_link_with_popup]
    firebase
      .auth()
      .currentUser.linkWithRedirect(provider)
      .then(function (result) {
        // Accounts successfully linked.
        props.closeCallback();
        // ...
      })
      .catch(function (error) {
        // Handle Errors here.
        setGeneralError(error.message);
      });
    // [END auth_link_with_popup]
  };

  const linkWithEmail = () => {
    setLoading(true);
    var credential = firebase.auth.EmailAuthProvider.credential(
      email,
      password
    );
    firebase
      .auth()
      .currentUser.linkWithCredential(credential)
      .then(function (usercred) {
        var user = usercred.user;
        console.log("Account linking success", user);
        setLoading(false);
        props.closeCallback();
      })
      .catch(function (error) {
        console.log("Account linking error", error);
        if (error.code === "auth/invalid-email") {
          setEmailError(error.message);
        } else if (error.code === "auth/weak-password") {
          setPasswordError(error.message);
        } else {
          setGeneralError(error.message);
        }
        setLoading(false);
      });
  };

  const chooseProvider = (providerString) => {
    var provider;
    switch (providerString) {
      case "google.com":
        provider = new firebase.auth.GoogleAuthProvider();
        break;
      case "email":
        provider = new firebase.auth.EmailAuthProvider();
        break;
      case "facebook.com":
        provider = new firebase.auth.FacebookAuthProvider();
        break;
      default:
        break;
    }
    linkAuth(provider);
  };

  return (
    <Modal size="mini" className="modal" open={true}>
      <Modal.Header>
        <p className="switchAuthModalTitle">{t("updateAuthTitle")}</p>
      </Modal.Header>
      <Modal.Content image>
        <p className="switchAuthText">{t("switchAuthText")}</p>
      </Modal.Content>
      <div className="switchAuthModalActions">
        <Button icon fluid onClick={() => setSignInEmail(!signInEmail)}>
          <Icon name="mail" size="large" />
        </Button>
        {!signInEmail ? (
          <div>
            <br />
            <Button
              icon
              fluid
              className="googleSwitchAuthBtn"
              onClick={() => chooseProvider("google.com")}>
              <Icon name="google" size="large" />
            </Button>
            <br />
            <Button
              icon
              fluid
              className="facebookSwitchAuthBtn"
              onClick={() => chooseProvider("facebook.com")}>
              <Icon name="facebook" size="large" />
            </Button>
          </div>
        ) : (
          <div className="emailFormPadding">
            <UIInput
              placeholder={"Email"}
              label={"Email"}
              hook={(e) => setEmail(e.target.value)}
              value={email}
              error={emailError}
            />
            <UIInput
              type="password"
              placeholder={"Password"}
              label={"Password"}
              hook={(e) => setPassword(e.target.value)}
              value={password}
              error={passwordError}
            />
            <UIButton
              text={t("finish")}
              loading={loading}
              onClick={() => linkWithEmail()}
              primary
            />
          </div>
        )}
        {generalError && (
          <Message negative>
            <Message.Header>{t("error")}</Message.Header>
            <p>{generalError}</p>
            <AuthBtn logoutCallback={() => props.closeCallback()} />
          </Message>
        )}
      </div>
    </Modal>
  );
}
