import React, { useState } from "react";
import { Container } from "semantic-ui-react";
import "semantic-ui-css/semantic.min.css";
import useGlobalState from "../../hooks/useGlobalState";
import { updateProfile } from "../../firebase";
import { useHistory } from "react-router-dom";

// Components
import ProfileForm from "../ProfileForm";
import UIButton from "../UI/UIButton";

export default function Profile() {
  const history = useHistory();
  const globalState = useGlobalState();

  const [loading, setLoading] = useState(false);

  const handleSubmit = (profileData) => {
    setLoading(true);
    updateProfile(profileData)
      .then((result) => {
        setLoading(false);
        goBack();
      })
      .catch((error) => {
        if (error.details) {
          if (
            error.details.label === "phone-used" ||
            error.details.label === "invalid-phone"
          ) {
            globalState.setError({ msg: error.message });
          }
        }
      });
  };

  const goBack = () => {
    history.push("/");
  };

  return (
    <Container>
      <UIButton secondary onClick={goBack} text={"Back"} />
      <ProfileForm
        loading={loading}
        setLoading={setLoading}
        submitCallback={handleSubmit}
        profileType={globalState.userInfo.needsHelp ? "requester" : "helper"}
        initialRegistration={false}
        profile
      />
    </Container>
  );
}
