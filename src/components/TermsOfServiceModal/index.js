import React from "react";
import "semantic-ui-css/semantic.min.css";
import { Modal } from "semantic-ui-react";

import { useTranslation } from "react-i18next";
import TermsOfService from "../TermsOfService";

export default function TermsOfServiceModal(props) {
  const { t } = useTranslation();

  return (
    <Modal
      className="modal"
      closeIcon
      trigger={<a style={{ cursor: "pointer" }}>{t("termsOfService")}</a>}>
      <Modal.Content>
        <TermsOfService />
      </Modal.Content>
    </Modal>
  );
}
