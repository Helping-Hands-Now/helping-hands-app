import React from "react";
import "semantic-ui-css/semantic.min.css";
import { Modal } from "semantic-ui-react";

import { Trans } from "react-i18next";

export default function Covid19SymptomsModal(props) {
  return (
    <Modal
      className="modal"
      closeIcon
      trigger={
        <a
          style={{ cursor: "pointer" }}
          onClick={(e) => {
            e.stopPropagation(); // Prevents clicking the modal link from checking the associated checkbox
          }}>
          {<Trans i18nKey="covid19SymptomsModalLink">COVID-19 symptoms</Trans>}
        </a>
      }>
      <Modal.Header>
        <h1 className="TOSTitle">COVID-19 symptoms</h1>
      </Modal.Header>
      <Modal.Content>
        <p>
          This may include Fever, Fatigue, Cough, Shortness of breath, Chills,
          Muscle pain, Unexplained headaches, Sore throat, Recent loss of taste
          or smell, Loss of appetite, Abnormal gastrointestinal issues (e.g.
          diarrhea).
        </p>
        <p>
          See the{" "}
          <a
            href="https://www.cdc.gov/coronavirus/2019-ncov/symptoms-testing/symptoms.html"
            target="_blank"
            rel="noopener noreferrer">
            CDC website for the latest list of symptoms
          </a>
          .
        </p>
      </Modal.Content>
    </Modal>
  );
}
