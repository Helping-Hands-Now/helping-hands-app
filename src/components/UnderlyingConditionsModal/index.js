import React from "react";
import "semantic-ui-css/semantic.min.css";
import { Modal } from "semantic-ui-react";

import { Trans } from "react-i18next";

export default function underlyingConditionsModal(props) {
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
          {
            <Trans i18nKey="underlyingConditionsModalLink">
              underlying medical or health conditions
            </Trans>
          }
        </a>
      }>
      <Modal.Header>
        <h1 className="TOSTitle">Underlying medical or health conditions</h1>
      </Modal.Header>
      <Modal.Content>
        <p>
          This may include asthma or lung condition, diabetes, heart or kidney
          disease, or undergoing dialysis. Many conditions and treatments can
          cause a weakened immune system, including cancer treatment, bone
          marrow or organ transplantation, immune deficiencies, HIV, or
          prolonged use of immune weakening medications (e.g., corticosteroids).
        </p>
        <p>
          See the{" "}
          <a
            href="https://www.cdc.gov/coronavirus/2019-ncov/need-extra-precautions/groups-at-higher-risk.html"
            target="_blank"
            rel="noopener noreferrer">
            CDC website for more details
          </a>
          .
        </p>
      </Modal.Content>
    </Modal>
  );
}
