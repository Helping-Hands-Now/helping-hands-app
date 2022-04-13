import React from "react";
import "semantic-ui-css/semantic.min.css";
import { Container } from "semantic-ui-react";

import { useTranslation } from "react-i18next";

export default function OurMission(props) {
  const { t } = useTranslation();

  return (
    <Container>
      <h1>Our Mission</h1>
    </Container>
  );
}
