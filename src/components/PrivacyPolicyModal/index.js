import React from "react";
import "semantic-ui-css/semantic.min.css";
import { Modal } from "semantic-ui-react";

import { useTranslation } from "react-i18next";
import Privacy from "../Privacy";

export default function PrivacyPolicyModal(props) {
  const { t } = useTranslation();

  return (
    <Modal
      className="modal"
      closeIcon
      trigger={<a style={{ cursor: "pointer" }}>{t("privacyPolicyHeader")}</a>}>
      <Modal.Content>
        <Privacy />
      </Modal.Content>
    </Modal>
  );
}
