import React, { useState } from "react";
import { Grid, Container } from "semantic-ui-react";
import "semantic-ui-css/semantic.min.css";
import useGlobalState from "../../hooks/useGlobalState";
import { useHistory } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { createProfile } from "../../firebase";
import GA from "../../utils/GoogleAnalytics";
import "./styles.css";
import firebase from "../../firebase";

// Components
import Auth from "../Auth";
import ProfileForm from "../ProfileForm";

export default function GiveHelp() {
  const history = useHistory();
  const globalState = useGlobalState();

  const [showAuthModal, setShowAuthModal] = useState(false);
  const [profileData, setProfileData] = useState({});
  const [loading, setLoading] = useState(false);
  const [showLoggingInState, setShowLoggingInState] = useState(false);

  const { t } = useTranslation();

  const callback = (authResult) => {
    var profile = {
      firstName: profileData.firstName,
      lastName: profileData.lastName,
      gender: profileData.gender,
      street: profileData.street,
      city: profileData.city,
      state: profileData.state,
      zipCode: profileData.zipCode,
      apartment: profileData.apartment,
      phoneNumber: profileData.phoneNumber,
      geohash: profileData.geohash,
      placeId: profileData.placeId,
      languages: profileData.languages,
      photoUrl: authResult.user.photoURL,
      needsHelp: false,
      canHelp: true,
      isBeneficiaryProfile: false,
      aboutUser: profileData.aboutUser,
    };

    setShowLoggingInState(true);

    createProfile(profile)
      .then((result) => {
        GA.sendEvent({
          category: "interaction",
          action: "button_press",
          label: "create_profile",
        });
        // TODO: this is intentional
        history.push("/give");
        history.push("/requests");
      })
      .catch(function (error) {
        setShowLoggingInState(false);
        setShowAuthModal(false);
        if (error.details) {
          if (
            error.details.label === "profile-exists" ||
            error.details.label === "phone-used" ||
            error.details.label === "invalid-phone"
          ) {
            firebase
              .auth()
              .signOut()
              .then(function () {})
              .finally(() => {
                history.push("/");
                globalState.setError({ msg: error.message });
              });
          }
        }
      })
      .finally(() => {
        setLoading(false);
      });
  };

  const handleProfileCreate = (profData) => {
    setLoading(true);
    setProfileData(profData);
    setShowAuthModal(true);
  };

  const handleAuthModalClose = () => {
    setShowAuthModal(false);
    setLoading(false);
  };

  return (
    <div>
      <div className="giveContainer">
        <Grid stackable padded>
          <Grid.Row>
            <Grid.Column width={7}>
              <div className="instructionsContainer">
                <h1 className="instructions instrHeader">
                  {t("createAccountHelper")}
                </h1>
                <h3 className="instructions">
                  {t("createAccountGiveInstructions")}
                </h3>
              </div>
            </Grid.Column>

            <Grid.Column className="formContainer" width={9}>
              <ProfileForm
                loading={loading}
                setLoading={setLoading}
                initialRegistration={true}
                profileType={"helper"}
                submitCallback={handleProfileCreate}
              />
            </Grid.Column>
          </Grid.Row>
        </Grid>
        {showAuthModal && (
          <Auth
            callback={callback}
            signup={true}
            needsSignUp={false}
            turnOffModal={handleAuthModalClose}
            showLoggingInState={showLoggingInState}
          />
        )}
      </div>
      <div className="instrContainer">
        <Container padded>
          <h2 className="instrSmallHeader">{t("howItWorksNew")}</h2>
          <h3 className="instr">{t("helpInstrNew1")}</h3>
          <h3 className="instr">{t("helpInstrNew2")}</h3>
          <h3 className="instr">{t("helpInstrNew3")}</h3>

          <ul>
            <li>
              <h3 className="instr">{t("helpInstrNew4")}</h3>
            </li>
            <li>
              <h3 className="instr">{t("helpInstrNew5")}</h3>
            </li>
            <li>
              <h3 className="instr">{t("helpInstrNew6")}</h3>
            </li>
            <li>
              <h3 className="instr">{t("helpInstrNew7")}</h3>
            </li>
            <li>
              <h3 className="instr">{t("helpInstrNew8")}</h3>
            </li>
          </ul>
        </Container>
      </div>
    </div>
  );
}
