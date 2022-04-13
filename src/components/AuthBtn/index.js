import React, { useState } from "react";
import "semantic-ui-css/semantic.min.css";
import useGlobalState from "../../hooks/useGlobalState";
import { withRouter, Redirect, Switch } from "react-router-dom";
import firebase from "../../firebase";
import { useHistory } from "react-router-dom";

import Auth from "../Auth";
import UIButton from "../UI/UIButton";
import { useTranslation } from "react-i18next";

function AuthBtn(props) {
  const globalState = useGlobalState();

  const [showAuthModal, setShowAuthModal] = useState(false);
  const [needsSignUp, setNeedsSignUp] = useState(false);
  const [showLoggingInState, setShowLoggingInState] = useState(false);

  if (props.clearState) {
    // set a timeout to prevent too much re-rendering
    // remove the login dialog from spinning
    // TODO we actually want something better here to let
    // user know they're banned or something instead of this
    // setTimeout(() => {
    //   setShowAuthModal(false);
    //   setShowLoggingInState(false);
    // }, 100);
  }

  const history = useHistory();

  const signIn = () => {
    setNeedsSignUp(false);
    setShowAuthModal(true);
  };

  const signOut = () => {
    firebase
      .auth()
      .signOut()
      .then(function () {
        // Sign-out successful.
        setShowAuthModal(false);
        props.logoutCallback();
      })
      .catch(function (error) {
        // An error happened.
      })
      .finally(function () {
        history.push("/");
      });
  };

  // Not in use yet, but will be added soon!
  const sendForgotPasswordEmail = (emailAddress) => {
    firebase
      .auth()
      .sendPasswordResetEmail(emailAddress)
      .then(function () {
        // Email sent.
      })
      .catch(function (error) {
        // An error happened.
      });
  };

  const loginCheckNewUser = (authResult) => {
    setShowLoggingInState(true);
    // If you're a new user, you shouldn't be logging in. So delete the account that was made
    if (authResult.additionalUserInfo.isNewUser) {
      var user = firebase.auth().currentUser;
      user
        .delete()
        .then(function () {
          // User deleted.
        })
        .catch(function (error) {
          // An error happened.
        });
      setNeedsSignUp(true);
      setShowLoggingInState(false);
    } else {
      setShowAuthModal(false);
      setShowLoggingInState(false);
    }
  };

  const { t } = useTranslation();

  return (
    <div>
      {showAuthModal && (
        <Auth
          callback={loginCheckNewUser}
          signup={false}
          showLoggingInState={showLoggingInState}
          needsSignUp={needsSignUp}
          turnOffModal={() => setShowAuthModal(false)}
        />
      )}
      {globalState.user.isAuthed ? (
        <div>
          {globalState.userInfo.needsHelp && (
            <Switch>
              <Redirect exact from="/requests" to="/" />
              <Redirect exact from="/" to="/dashboard" />
            </Switch>
          )}
          {globalState.userInfo.canHelp && (
            <Switch>
              <Redirect exact from="/dashboard" to="/" />
              <Redirect exact from="/" to="/requests" />
            </Switch>
          )}
          {!props.hidden && (
            <UIButton onClick={signOut} text={t("logout")} secondary login />
          )}
        </div>
      ) : (
        <div>
          <Switch>
            <Redirect from="/requests" to="/" />
            <Redirect from="/dashboard" to="/" />
          </Switch>
          {!props.hidden && (
            <UIButton onClick={signIn} text={t("login")} secondary login />
          )}
        </div>
      )}
    </div>
  );
}

export default withRouter(AuthBtn);
