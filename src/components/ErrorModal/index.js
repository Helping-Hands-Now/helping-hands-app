import React from "react";
import { Modal } from "semantic-ui-react";
import "semantic-ui-css/semantic.min.css";
import useGlobalState from "../../hooks/useGlobalState";
import { useTranslation } from "react-i18next";
import "./styles.css";

import UIButton from "../UI/UIButton";

export default function ErrorModal(props) {
  const { t } = useTranslation();
  const globalState = useGlobalState();

  return (
    <Modal size="mini" className="modal" open={true}>
      <Modal.Header>
        <p className="errorModalTitle">{t("error")}</p>
      </Modal.Header>
      <Modal.Content image>
        <p className="errorText">{globalState.error.msg}</p>
      </Modal.Content>
      <div className="errorModalActions">
        <UIButton
          destructive
          text={t("okay")}
          onClick={() => globalState.setError("")}
        />
      </div>
    </Modal>
  );
}
